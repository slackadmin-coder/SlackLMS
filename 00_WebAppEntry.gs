/**
 * Host dependency wiring and DB client bootstrap.
 */

function createHostDbClient(config) {
  var cfg = config || ConfigBootstrap.load();
  var db = SheetDb.createClient({ spreadsheetId: cfg.spreadsheetId });
  var schema = function(columns) { return { columns: columns, fields: {} }; };

  db.schema('learners', schema(['id', 'slackUserId', 'email', 'name', 'status', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('enrollment', schema(['id', 'learnerId', 'courseId', 'track', 'status', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('lessons', schema(['id', 'courseId', 'track', 'title', 'contentRef', 'active', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('learner_progress', schema(['id', 'learnerId', 'lessonId', 'state', 'dueAt', 'completedAt', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('submission_log', schema(['id', 'learnerId', 'lessonId', 'submitKey', 'payload', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('delivery_queue', schema(['id', 'learnerId', 'lessonId', 'status', 'runAt', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('retry_queue', schema(['id', 'jobType', 'payload', 'attempts', 'nextRunAt', 'status', 'lastError', 'createdAt', 'updatedAt', 'deletedAt']));
  db.schema('audit_log', schema(['id', 'actor', 'action', 'resourceType', 'resourceId', 'status', 'message', 'metadata', 'createdAt', 'updatedAt', 'deletedAt']));

  return db;
}

function createHostRouter() {
  return SlackRouter;
}

function createHostDependencies(config) {
  var cfg = config || ConfigBootstrap.load();
  var db = createHostDbClient(cfg);
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
    deps.blockKitBuilder
  );

  return deps;
}
