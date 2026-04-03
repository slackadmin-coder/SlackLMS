/**
 * Host dependency wiring and DB client bootstrap.
 */

function resolveHostConfig(config) {
  var base = ConfigBootstrap.load();
  if (!config) return base;

  var merged = {};
  Object.keys(base).forEach(function(key) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      merged[key] = config[key];
    } else {
      merged[key] = base[key];
    }
  });

  return merged;
}

function createHostDbClient(config) {
  var cfg = resolveHostConfig(config);
  var db = SheetDb.createClient({ spreadsheetId: cfg.spreadsheetId });
  var schema = function(columns, fields) { return { columns: columns, fields: fields || {} }; };

  db.schema('learners', schema(['id', 'slackUserId', 'email', 'name', 'status', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('enrollment', schema(['id', 'learnerId', 'courseId', 'track', 'status', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('lessons', schema(
    [
      'id', 'courseId', 'moduleId', 'sequenceNumber', 'track',
      'title', 'topic', 'objective', 'difficulty',
      'hook', 'coreContent', 'insight', 'takeaway',
      'mission', 'missionType', 'missionDuration', 'verification', 'submitBlock',
      'contentRef', 'slackPayload', 'active', 'createdAt', 'updatedAt', 'deletedAt'
    ]
  ));
  db.schema('learner_progress', schema(['id', 'learnerId', 'lessonId', 'state', 'dueAt', 'completedAt', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('submission_log', schema(['id', 'learnerId', 'lessonId', 'submitKey', 'payload', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('delivery_queue', schema(['id', 'learnerId', 'lessonId', 'status', 'runAt', 'priority', 'attempts', 'availableAt', 'conditionExpr', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('retry_queue', schema(['id', 'jobType', 'payload', 'attempts', 'nextRunAt', 'status', 'lastError', 'correlationId', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('audit_log', schema(['id', 'actor', 'action', 'resourceType', 'resourceId', 'status', 'message', 'metadata', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('courses', schema(['id', 'courseTitle', 'brandScope', 'moduleOrder', 'durationMonths', 'status', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('modules', schema(['id', 'courseId', 'moduleTitle', 'monthNumber', 'lessonCount', 'status', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('onboarding_requests', schema(['id', 'requestorUserId', 'targetEmail', 'targetName', 'targetBrand', 'targetRole', 'courseId', 'source', 'status', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('onboarding_checklists', schema(['id', 'learnerId', 'taskTitle', 'taskOwner', 'dueDate', 'status', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('onboarding_task_log', schema(['id', 'checklistItemId', 'learnerId', 'eventType', 'eventBy', 'note', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('lesson_qa_records', schema(['id', 'lessonId', 'qaStatus', 'qaScore', 'qaReviewer', 'qaDate', 'qaNotes', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('app_config', schema(['id', 'configKey', 'configValue', 'description', 'updatedBy', 'createdAt', 'updatedAt', 'deletedAt']));

  return db;
}

function createHostRouter() {
  return SlackRouter;
}

function createHostDependencies(config) {
  var cfg = resolveHostConfig(config);
  var db = createHostDbClient(cfg);
  var dbAdapter = new SheetsDBAdapter(db);
  var sheetsAudit = createSheetsAuditLogger(db);
  db._audit = sheetsAudit;

  var blocks = new SlackBlockKitBuilder();
  var stateMachine = new LearnerProgressStateMachine();
  var configRepo = new ConfigRepository(db);
  var workflow = new WorkflowEngine(function(action, metadata) { db.audit(action, 'workflow', metadata || {}); });
  var repositories = {
    learnerRepo: new LearnerRepository(db),
    progressRepo: new ProgressRepository(db),
    lessonRepo: new LessonRepository(db),
    configRepo: configRepo
  };

  var retryResolver = new RetryResolver(db, cfg, configRepo);
  var slackApi = new SlackApiClient(cfg, retryResolver);

  var deps = {
    config: cfg,
    db: db,
    dbAdapter: dbAdapter,
    parser: SlackPayloadParser,
    security: SlackSecurity,
    router: createHostRouter(),
    slackApiClient: slackApi,
    blockKitBuilder: blocks,
    stateMachine: stateMachine,
    repositories: repositories,
    enrollmentService: new LmsEnrollmentService(db, slackApi, blocks, stateMachine, cfg, repositories, workflow, SecurityService),
    lessonService: new LmsLessonService(db, slackApi, blocks, stateMachine, cfg, repositories, workflow),
    progressService: new LmsProgressService(db, slackApi, blocks, cfg, repositories, workflow),
    completionService: new LmsCompletionService(db, slackApi, blocks, stateMachine, cfg, repositories, workflow, SecurityService),
    reminderService: new LmsReminderService(db, slackApi, blocks, cfg),
    reportService: new ReportService(db, cfg, repositories),
    onboardingService: new OnboardingService(db, slackApi, blocks, cfg),
    backupService: new BackupService(db, cfg),
    healthMonitor: new HealthMonitor(db, cfg),
    retryResolver: retryResolver,
    audit: function(action, metadata) {
      db.table('audit_log').insert({
        actor: 'system',
        action: action,
        resourceType: 'slack_host',
        resourceId: '',
        status: 'info',
        message: action,
        metadata: JSON.stringify(metadata || {})
      });
      db.audit(action, 'audit_log', metadata || {});
    }
  };

  deps.slackService = new SlackService({
    lessonService: deps.lessonService,
    completionService: deps.completionService,
    progressService: deps.progressService,
    enrollmentService: deps.enrollmentService,
    reportService: deps.reportService,
    onboardingService: deps.onboardingService
  }, deps.blockKitBuilder, deps.config, SecurityService, configRepo);

  return deps;
}


function migrateLearnerProgressStates() {
  var deps = createHostDependencies();
  return deps.stateMachine.migrateLegacyStatesInDb(deps.db);
}
