var DbSchema = {
  LEARNERS:              { TABLE: 'learners',              PK: 'id' },
  ENROLLMENT:            { TABLE: 'enrollment',            PK: 'id' },
  LESSONS:               { TABLE: 'lessons',               PK: 'id' },
  LEARNER_PROGRESS:      { TABLE: 'learner_progress',      PK: 'id' },
  SUBMISSION_LOG:        { TABLE: 'submission_log',        PK: 'id' },
  DELIVERY_QUEUE:        { TABLE: 'delivery_queue',        PK: 'id' },
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
