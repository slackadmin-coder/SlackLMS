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
  var requiredTables = DbSchema.CONTRACT.TABLES;

  Object.keys(requiredTables).forEach(function(tableName) {
    db.schema(tableName, schema(requiredTables[tableName]));
  });

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
    ingressQueueService: new IngressQueueService(db, SecurityService),
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
    onboardingService: deps.onboardingService,
    ingressQueueService: deps.ingressQueueService
  }, deps.blockKitBuilder, deps.config, SecurityService, configRepo);

  deps.queueProcessor = new QueueProcessor(db, {
    enrollmentService: deps.enrollmentService,
    lessonService: deps.lessonService,
    completionService: deps.completionService,
    onboardingService: deps.onboardingService,
    slackApiClient: deps.slackApiClient
  }, deps.ingressQueueService, cfg);

  return deps;
}


function migrateLearnerProgressStates() {
  var deps = createHostDependencies();
  return deps.stateMachine.migrateLegacyStatesInDb(deps.db);
}
