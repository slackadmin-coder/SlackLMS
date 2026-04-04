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
  ONBOARDING_TASK_LOG:   { TABLE: 'onboarding_task_log',   PK: 'id' }
};

function _freezeSchemaContract(contract) {
  Object.keys(contract).forEach(function(key) {
    var value = contract[key];
    if (Array.isArray(value)) {
      Object.freeze(value);
      return;
    }
    if (value && typeof value === 'object') {
      Object.keys(value).forEach(function(nestedKey) {
        if (Array.isArray(value[nestedKey])) Object.freeze(value[nestedKey]);
      });
      Object.freeze(value);
    }
  });
  return Object.freeze(contract);
}

DbSchema.CONTRACT = _freezeSchemaContract({
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
  LEARNER_PROGRESS_STATES: ['not_started', 'in_progress', 'submitted', 'completed'],
  TABLES: {
    learners: ['id', 'slackUserId', 'email', 'name', 'status', 'createdAt', 'updatedAt', 'deletedAt'],
    enrollment: ['id', 'learnerId', 'courseId', 'track', 'status', 'createdAt', 'updatedAt', 'deletedAt'],
    lessons: [
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
    learner_progress: ['id', 'learnerId', 'lessonId', 'state', 'dueAt', 'completedAt', 'createdAt', 'updatedAt', 'deletedAt'],
    submission_log: ['id', 'learnerId', 'lessonId', 'submitKey', 'payload', 'createdAt', 'updatedAt', 'deletedAt'],
    delivery_queue: ['id', 'learnerId', 'lessonId', 'status', 'runAt', 'priority', 'attempts', 'availableAt', 'conditionExpr', 'createdAt', 'updatedAt', 'deletedAt'],
    retry_queue: ['id', 'jobType', 'payload', 'attempts', 'nextRunAt', 'status', 'lastError', 'correlationId', 'createdAt', 'updatedAt', 'deletedAt'],
    audit_log: ['id', 'actor', 'action', 'resourceType', 'resourceId', 'status', 'message', 'metadata', 'createdAt', 'updatedAt', 'deletedAt'],
    courses: ['id', 'courseTitle', 'brandScope', 'moduleOrder', 'durationMonths', 'status', 'createdAt', 'updatedAt', 'deletedAt'],
    modules: ['id', 'courseId', 'moduleTitle', 'monthNumber', 'lessonCount', 'status', 'createdAt', 'updatedAt', 'deletedAt'],
    onboarding_requests: ['id', 'requestorUserId', 'targetEmail', 'targetName', 'targetBrand', 'targetRole', 'courseId', 'source', 'status', 'createdAt', 'updatedAt', 'deletedAt'],
    onboarding_checklists: ['id', 'learnerId', 'taskTitle', 'taskOwner', 'dueDate', 'status', 'createdAt', 'updatedAt', 'deletedAt'],
    onboarding_task_log: ['id', 'checklistItemId', 'learnerId', 'eventType', 'eventBy', 'note', 'createdAt', 'updatedAt', 'deletedAt']
  }
});

DbSchema.WAVE1 = {
  LESSONS_COLUMNS: DbSchema.CONTRACT.LESSONS_COLUMNS,
  LEARNER_PROGRESS_COLUMNS: DbSchema.CONTRACT.TABLES.learner_progress,
  DELIVERY_QUEUE_COLUMNS: DbSchema.CONTRACT.TABLES.delivery_queue,
  AUDIT_LOG_COLUMNS: DbSchema.CONTRACT.TABLES.audit_log,
  LEARNER_PROGRESS_STATES: DbSchema.CONTRACT.LEARNER_PROGRESS_STATES,
  REQUIRED_TABLES: DbSchema.CONTRACT.TABLES
};
