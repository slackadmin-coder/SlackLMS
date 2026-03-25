/**
 * Host dependency wiring and DB client bootstrap.
 */

function createHostDbClient(config) {
  var cfg = config || ConfigBootstrap.load();
  var db = SheetDb.createClient({ spreadsheetId: cfg.spreadsheetId });
  var schema = function(columns, fields) { return { columns: columns, fields: fields || {} }; };

  db.schema('learners', schema(['id', 'slackUserId', 'email', 'name', 'status', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('enrollment', schema(['id', 'learnerId', 'courseId', 'track', 'status', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('lessons', schema(
    ['id', 'courseId', 'moduleId', 'sequenceNumber', 'track', 'title', 'contentRef', 'active', 'createdAt', 'updatedAt', 'deletedAt'],
    {
      moduleId: { type: 'string', required: false, defaultValue: '' },
      sequenceNumber: { type: 'string', required: false, defaultValue: '0' }
    }
  ));
  db.schema('learner_progress', schema(['id', 'learnerId', 'lessonId', 'state', 'dueAt', 'completedAt', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('submission_log', schema(['id', 'learnerId', 'lessonId', 'submitKey', 'payload', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('delivery_queue', schema(['id', 'learnerId', 'lessonId', 'status', 'runAt', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('retry_queue', schema(['id', 'jobType', 'payload', 'attempts', 'nextRunAt', 'status', 'lastError', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('audit_log', schema(['id', 'actor', 'action', 'resourceType', 'resourceId', 'status', 'message', 'metadata', 'createdAt', 'updatedAt', 'deletedAt']));

  db.schema('courses', schema([
    'id', 'courseTitle', 'brandScope', 'moduleOrder', 'durationMonths',
    'status', 'createdAt', 'updatedAt', 'deletedAt'
  ]));
  db.schema('modules', schema([
    'id', 'courseId', 'moduleTitle', 'monthNumber', 'lessonCount',
    'status', 'createdAt', 'updatedAt', 'deletedAt'
  ]));
  db.schema('onboarding_requests', schema([
    'id', 'requestorUserId', 'targetEmail', 'targetName', 'targetBrand',
    'targetRole', 'courseId', 'source', 'status', 'createdAt', 'updatedAt', 'deletedAt'
  ]));
  db.schema('onboarding_checklists', schema([
    'id', 'learnerId', 'taskTitle', 'taskOwner', 'dueDate', 'status',
    'createdAt', 'updatedAt', 'deletedAt'
  ]));
  db.schema('onboarding_task_log', schema([
    'id', 'checklistItemId', 'learnerId', 'eventType', 'eventBy',
    'note', 'createdAt', 'updatedAt', 'deletedAt'
  ]));
  db.schema('lesson_qa_records', schema([
    'id', 'lessonId', 'qaStatus', 'qaScore', 'qaReviewer', 'qaDate',
    'qaNotes', 'createdAt', 'updatedAt', 'deletedAt'
  ]));
  db.schema('app_config', schema([
    'id', 'configKey', 'configValue', 'description', 'updatedBy',
    'createdAt', 'updatedAt', 'deletedAt'
  ]));

  return db;
}

function createHostRouter() {
  return SlackRouter;
}

function createHostDependencies(config) {
  var cfg = config || ConfigBootstrap.load();
  var db = createHostDbClient(cfg);
  var sheetsAudit = createSheetsAuditLogger(db);
  db._audit = sheetsAudit;

  var blocks = new SlackBlockKitBuilder();
  var stateMachine = new LearnerProgressStateMachine();
  var retryResolver = new RetryResolver(db, cfg);
  var slackApi = new SlackApiClient(cfg, retryResolver);

  var deps = {
    config: cfg,
    db: db,
    parser: SlackPayloadParser,
    security: SlackSecurity,
    router: createHostRouter(),
    slackApiClient: slackApi,
    blockKitBuilder: blocks,
    stateMachine: stateMachine,
    enrollmentService: new LmsEnrollmentService(db, slackApi, blocks, cfg),
    lessonService: new LmsLessonService(db, slackApi, blocks, stateMachine, cfg),
    progressService: new LmsProgressService(db, slackApi, blocks, cfg),
    completionService: new LmsCompletionService(db, slackApi, blocks, stateMachine, cfg),
    reminderService: new LmsReminderService(db, slackApi, blocks, cfg),
    reportService: new LmsReportService(db, cfg),
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

  deps.slackService = new SlackService(
    deps.lessonService,
    deps.completionService,
    deps.progressService,
    deps.enrollmentService,
    deps.reportService,
    deps.blockKitBuilder,
    deps.onboardingService,
    deps.config
  );

  return deps;
}
