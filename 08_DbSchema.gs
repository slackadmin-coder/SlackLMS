var DbSchema = {
  LEARNERS:              { TABLE: 'learners',              PK: 'id' },
  ENROLLMENT:            { TABLE: 'enrollment',            PK: 'id' },
  LESSONS:               { TABLE: 'lessons',               PK: 'id' },
  LEARNER_PROGRESS:      { TABLE: 'learner_progress',      PK: 'id' },
  SUBMISSION_LOG:        { TABLE: 'submission_log',        PK: 'id' },
  DELIVERY_QUEUE:        { TABLE: 'delivery_queue',        PK: 'id' },
  INGRESS_JOBS:          { TABLE: 'ingress_jobs',          PK: 'id' },
  RETRY_QUEUE:           { TABLE: 'retry_queue',           PK: 'id' },
  AUDIT_LOG:             { TABLE: 'audit_log',             PK: 'id' },
  COURSES:               { TABLE: 'courses',               PK: 'id' },
  MODULES:               { TABLE: 'modules',               PK: 'id' },
  ONBOARDING_REQUESTS:   { TABLE: 'onboarding_requests',   PK: 'id' },
  ONBOARDING_CHECKLISTS: { TABLE: 'onboarding_checklists', PK: 'id' },
  ONBOARDING_TASK_LOG:   { TABLE: 'onboarding_task_log',   PK: 'id' },
  LESSON_QA_RECORDS:     { TABLE: 'lesson_qa_records',     PK: 'id' },
  APP_CONFIG:            { TABLE: 'app_config',            PK: 'id' }
};

DbSchema.WAVE1 = {
  LESSONS_COLUMNS: [
    'id', 'courseId', 'moduleId', 'sequenceNumber', 'track',
    'title', 'topic', 'objective', 'difficulty',
    'hook', 'coreContent', 'insight', 'takeaway',
    'mission', 'missionType', 'missionDuration', 'verification', 'submitBlock',
    'contentRef', 'slackPayload', 'active',
    'lessonType', 'estimatedMinutes', 'prerequisites', 'tags',
    'deliveryChannel', 'releaseAt', 'sunsetAt', 'locale',
    'owner', 'status', 'version', 'qaStatus', 'qaScore', 'qaReviewer', 'qaDate',
    'sourceRef', 'migrationNotes',
    'createdAt', 'updatedAt', 'deletedAt'
  ],
  LEARNER_PROGRESS_COLUMNS: ['id', 'learnerId', 'lessonId', 'state', 'dueAt', 'completedAt', 'createdAt', 'updatedAt', 'deletedAt'],
  DELIVERY_QUEUE_COLUMNS: ['id', 'learnerId', 'lessonId', 'status', 'runAt', 'priority', 'attempts', 'availableAt', 'conditionExpr', 'createdAt', 'updatedAt', 'deletedAt'],
  AUDIT_LOG_COLUMNS: ['id', 'actor', 'action', 'resourceType', 'resourceId', 'status', 'message', 'metadata', 'createdAt', 'updatedAt', 'deletedAt'],
  LEARNER_PROGRESS_STATES: ['not_started', 'in_progress', 'submitted', 'completed']
};

DbSchema.WAVE1.REQUIRED_TABLES = (function() {
  var tableDefs = {};
  tableDefs[DbSchema.LEARNERS.TABLE] = ['id', 'slackUserId', 'email', 'name', 'status', 'createdAt', 'updatedAt', 'deletedAt'];
  tableDefs[DbSchema.ENROLLMENT.TABLE] = ['id', 'learnerId', 'courseId', 'track', 'status', 'createdAt', 'updatedAt', 'deletedAt'];
  tableDefs[DbSchema.LESSONS.TABLE] = DbSchema.WAVE1.LESSONS_COLUMNS.slice();
  tableDefs[DbSchema.LEARNER_PROGRESS.TABLE] = DbSchema.WAVE1.LEARNER_PROGRESS_COLUMNS.slice();
  tableDefs[DbSchema.SUBMISSION_LOG.TABLE] = ['id', 'learnerId', 'lessonId', 'submitKey', 'payload', 'createdAt', 'updatedAt', 'deletedAt'];
  tableDefs[DbSchema.DELIVERY_QUEUE.TABLE] = DbSchema.WAVE1.DELIVERY_QUEUE_COLUMNS.slice();
  tableDefs[DbSchema.INGRESS_JOBS.TABLE] = ['id', 'routeType', 'jobType', 'idempotencyKey', 'status', 'payload', 'requestMeta', 'attempts', 'availableAt', 'lastError', 'processedAt', 'createdAt', 'updatedAt', 'deletedAt'];
  tableDefs[DbSchema.RETRY_QUEUE.TABLE] = ['id', 'jobType', 'payload', 'attempts', 'nextRunAt', 'status', 'lastError', 'correlationId', 'createdAt', 'updatedAt', 'deletedAt'];
  tableDefs[DbSchema.AUDIT_LOG.TABLE] = DbSchema.WAVE1.AUDIT_LOG_COLUMNS.slice();
  tableDefs[DbSchema.COURSES.TABLE] = ['id', 'courseTitle', 'brandScope', 'moduleOrder', 'durationMonths', 'status', 'createdAt', 'updatedAt', 'deletedAt'];
  tableDefs[DbSchema.MODULES.TABLE] = ['id', 'courseId', 'moduleTitle', 'monthNumber', 'lessonCount', 'status', 'createdAt', 'updatedAt', 'deletedAt'];
  tableDefs[DbSchema.ONBOARDING_REQUESTS.TABLE] = ['id', 'requestorUserId', 'targetEmail', 'targetName', 'targetBrand', 'targetRole', 'courseId', 'source', 'status', 'createdAt', 'updatedAt', 'deletedAt'];
  tableDefs[DbSchema.ONBOARDING_CHECKLISTS.TABLE] = ['id', 'learnerId', 'taskTitle', 'taskOwner', 'dueDate', 'status', 'createdAt', 'updatedAt', 'deletedAt'];
  tableDefs[DbSchema.ONBOARDING_TASK_LOG.TABLE] = ['id', 'checklistItemId', 'learnerId', 'eventType', 'eventBy', 'note', 'createdAt', 'updatedAt', 'deletedAt'];
  tableDefs[DbSchema.LESSON_QA_RECORDS.TABLE] = ['id', 'lessonId', 'qaStatus', 'qaScore', 'qaReviewer', 'qaDate', 'qaNotes', 'createdAt', 'updatedAt', 'deletedAt'];
  tableDefs[DbSchema.APP_CONFIG.TABLE] = ['id', 'configKey', 'configValue', 'description', 'updatedBy', 'createdAt', 'updatedAt', 'deletedAt'];
  return tableDefs;
})();
