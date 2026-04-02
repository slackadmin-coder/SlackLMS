# RWR LMS CSV and SheetDb Schema Inventory

## Section 1 — CSV File Inventory

### CSV file scan result
- No physical `*.csv` files were originally present in the repository; generated header-only CSV artifacts now live under `docs/generated_csv/`.
- The codebase is sheet-backed: tab names are registered through `db.schema(...)` and materialized through `SheetsGateway.ensureTable(...)` / `SpreadsheetApp.getSheetByName(...)`.
- No `headers.indexOf(...)`-driven dynamic CSV parsing was found.
- No direct `sheet.getDataRange().getValues()` consumers outside the shared `SheetsGateway.readTable(...)` helper were found.

## Section 2 — Sheet / Table Inventory

### Discovery summary
Unique sheet-backed tables found across the repo:
- Main RWR LMS runtime: `learners`, `enrollment`, `lessons`, `learner_progress`, `submission_log`, `delivery_queue`, `retry_queue`, `audit_log`
- Split Slack host example app: `students`, `enrollments`, `automations`, `audit_logs`

### Generated CSV artifacts
- Header-only CSV files were generated for every discovered table under `docs/generated_csv/` so the sheet/tab schemas can be copied directly into spreadsheet imports or seed workflows.

### Table: `learners`
- **Origin:** `db.schema()`
- **Sheet/tab name:** `learners`
- **Column order confidence:** exact from schema registration
- **Columns (ordered):**
  1. `id`
  2. `slackUserId`
  3. `email`
  4. `name`
  5. `status`
  6. `createdAt`
  7. `updatedAt`
  8. `deletedAt`
- **Column details:**
  - `id`: String, required at persistence level, primary key. Auto-generated with `Util.generateId('learners')` when omitted.
  - `slackUserId`: String, effectively required by application flow because lookups/enrollment depend on it.
  - `email`: String, optional, defaults to empty string in `ensureLearnerRecord()`.
  - `name`: String, optional, defaults to empty string in `ensureLearnerRecord()`.
  - `status`: String, required by business flow on insert, observed enum values: `active`.
  - `createdAt`: DateTime, auto-populated on insert.
  - `updatedAt`: DateTime, auto-populated on insert/update.
  - `deletedAt`: DateTime, optional, soft-delete marker used by the repository filter.
- **Foreign keys:** none.
- **Soft delete:** `{ enabled: true, column: 'deletedAt', archivedValue: '<timestamp set on remove>' }`
- **Observed active-record filter:** implicit in `TableRepository.findAll()` because rows with blank `deletedAt` only are returned.
- **AppSheet consumer evidence:** none found.

### Table: `enrollment`
- **Origin:** `db.schema()`
- **Sheet/tab name:** `enrollment`
- **Column order confidence:** exact from schema registration
- **Columns (ordered):**
  1. `id`
  2. `learnerId`
  3. `courseId`
  4. `track`
  5. `status`
  6. `createdAt`
  7. `updatedAt`
  8. `deletedAt`
- **Column details:**
  - `id`: String, required at persistence level, primary key. Auto-generated when omitted.
  - `learnerId`: String, required by business flow, foreign key to `learners.id`.
  - `courseId`: String, required by business flow.
  - `track`: String, optional in code path, defaults to configured track or `'ONBOARDING'`.
  - `status`: String, required by business flow, observed enum values: `active`.
  - `createdAt`: DateTime, auto-populated.
  - `updatedAt`: DateTime, auto-populated.
  - `deletedAt`: DateTime, optional soft-delete marker.
- **Foreign keys:** `learnerId -> learners.id`.
- **Soft delete:** enabled via `deletedAt`.
- **Observed active-record filter:** implicit repository `deletedAt` filter; reports also filter `status === 'active'` for active enrollment counts.
- **AppSheet consumer evidence:** none found.

### Table: `lessons`
- **Origin:** `db.schema()`
- **Sheet/tab name:** `lessons`
- **Column order confidence:** exact from schema registration
- **Columns (ordered):**
  1. `id`
  2. `courseId`
  3. `moduleId`
  4. `sequenceNumber`
  5. `track`
  6. `title`
  7. `topic`
  8. `objective`
  9. `difficulty`
  10. `hook`
  11. `coreContent`
  12. `insight`
  13. `takeaway`
  14. `mission`
  15. `missionType`
  16. `missionDuration`
  17. `verification`
  18. `submitBlock`
  19. `contentRef`
  20. `active`
  21. `createdAt`
  22. `updatedAt`
  23. `deletedAt`
- **Column details:**
  - `id`: String, primary key. Auto-generated when omitted, though runtime sync prefers caller-supplied `row.id`.
  - `courseId`: String, optional in sync helper, defaults to empty string.
  - `moduleId`: String, optional module reference for Universal Lesson Canvas grouping.
  - `sequenceNumber`: String-encoded numeric sort index used for next-lesson sequencing.
  - `track`: String legacy routing field, mirrored from `topic` when omitted.
  - `title`: String lesson title from metadata.
  - `topic`: String lesson topic from metadata.
  - `objective`: String lesson objective text.
  - `difficulty`: String level from metadata (default `independent`).
  - `hook`, `coreContent`, `insight`, `takeaway`, `mission`, `verification`: String blocks for sections 01–06 of Universal Lesson Canvas.
  - `missionType`: String mission response format (default `text`).
  - `missionDuration`: String mission duration (default `3 min`).
  - `submitBlock`: String submit instructions block text.
  - `contentRef`: String optional external content pointer.
  - `active`: String/Boolean-like flag. Sync helper persists `String(...)`; observed values: `'true'`, inherited row value.
  - `createdAt`: DateTime, auto-populated.
  - `updatedAt`: DateTime, auto-populated.
  - `deletedAt`: DateTime, optional soft-delete marker.
- **Foreign keys:** none enforced, though `courseId` and `moduleId` behave like curriculum references.
- **Soft delete:** enabled via `deletedAt`.
- **AppSheet consumer evidence:** none found.

### Table: `learner_progress`
- **Origin:** `db.schema()`
- **Sheet/tab name:** `learner_progress`
- **Column order confidence:** exact from schema registration
- **Columns (ordered):**
  1. `id`
  2. `learnerId`
  3. `lessonId`
  4. `state`
  5. `dueAt`
  6. `completedAt`
  7. `createdAt`
  8. `updatedAt`
  9. `deletedAt`
- **Column details:**
  - `id`: String, primary key. Auto-generated when omitted.
  - `learnerId`: String, foreign key to `learners.id`.
  - `lessonId`: String, foreign key to `lessons.id`.
  - `state`: String, required by business logic once rows exist. Observed enum values from state machine and filters: `queued`, `delivered`, `submitted`, `completed`, `overdue`.
  - `dueAt`: DateTime, optional.
  - `completedAt`: DateTime, optional.
  - `createdAt`: DateTime, auto-populated.
  - `updatedAt`: DateTime, auto-populated and also touched by state-machine logic.
  - `deletedAt`: DateTime, optional soft-delete marker.
- **Foreign keys:** `learnerId -> learners.id`, `lessonId -> lessons.id`.
- **Soft delete:** enabled via `deletedAt`.
- **Observed active-record filter:** implicit repository `deletedAt` filter; many flows additionally treat rows where `state !== 'completed'` as active lesson rows.
- **AppSheet consumer evidence:** none found.

### Table: `submission_log`
- **Origin:** `db.schema()`
- **Sheet/tab name:** `submission_log`
- **Column order confidence:** exact from schema registration
- **Columns (ordered):**
  1. `id`
  2. `learnerId`
  3. `lessonId`
  4. `submitKey`
  5. `payload`
  6. `createdAt`
  7. `updatedAt`
  8. `deletedAt`
- **Column details:**
  - `id`: String, primary key. Auto-generated when omitted.
  - `learnerId`: String, foreign key to `learners.id`.
  - `lessonId`: String, foreign key to `lessons.id`.
  - `submitKey`: String, dedupe/business key, computed as `learner.id + ':' + lessonId`.
  - `payload`: String, optional, defaults to empty string.
  - `createdAt`: DateTime, auto-populated.
  - `updatedAt`: DateTime, auto-populated.
  - `deletedAt`: DateTime, optional soft-delete marker.
- **Foreign keys:** `learnerId -> learners.id`, `lessonId -> lessons.id`.
- **Soft delete:** enabled via `deletedAt`.
- **AppSheet consumer evidence:** none found.

### Table: `delivery_queue`
- **Origin:** `db.schema()`
- **Sheet/tab name:** `delivery_queue`
- **Column order confidence:** exact from schema registration
- **Columns (ordered):**
  1. `id`
  2. `learnerId`
  3. `lessonId`
  4. `status`
  5. `runAt`
  6. `createdAt`
  7. `updatedAt`
  8. `deletedAt`
- **Column details:**
  - `id`: String, primary key. Auto-generated when omitted.
  - `learnerId`: String, foreign key to `learners.id`.
  - `lessonId`: String, foreign key to `lessons.id`, but intentionally blank in some queueing flows until next-lesson resolution is implemented.
  - `status`: String, observed enum values: `queued`, `delivered`.
  - `runAt`: DateTime, required by business flow on inserts; populated with `new Date().toISOString()`.
  - `createdAt`: DateTime, auto-populated.
  - `updatedAt`: DateTime, auto-populated.
  - `deletedAt`: DateTime, optional soft-delete marker.
- **Foreign keys:** `learnerId -> learners.id`, `lessonId -> lessons.id`.
- **Soft delete:** enabled via `deletedAt`.
- **Observed active-record filter:** implicit repository `deletedAt` filter; business processing additionally filters `status === 'queued'`.
- **AppSheet consumer evidence:** none found.

### Table: `retry_queue`
- **Origin:** `db.schema()`
- **Sheet/tab name:** `retry_queue`
- **Column order confidence:** exact from schema registration
- **Columns (ordered):**
  1. `id`
  2. `jobType`
  3. `payload`
  4. `attempts`
  5. `nextRunAt`
  6. `status`
  7. `lastError`
  8. `createdAt`
  9. `updatedAt`
  10. `deletedAt`
- **Column details:**
  - `id`: String, primary key. Auto-generated when omitted.
  - `jobType`: String, defaults to `'unknown'`.
  - `payload`: String, JSON-serialized object, defaults to `'{}'` from `JSON.stringify(payload.payload || {})`.
  - `attempts`: Integer-like string. Stored as `String(payload.attempts || 0)` and incremented as strings.
  - `nextRunAt`: DateTime, defaults to current timestamp if omitted.
  - `status`: String, observed enum values: `queued`, `dead_letter`.
  - `lastError`: String, optional, defaults to empty string.
  - `createdAt`: DateTime, auto-populated.
  - `updatedAt`: DateTime, auto-populated.
  - `deletedAt`: DateTime, optional soft-delete marker.
- **Foreign keys:** none.
- **Soft delete:** enabled via `deletedAt`.
- **Observed active-record filter:** implicit repository `deletedAt` filter; retry scheduler additionally filters `status === 'queued'`.
- **AppSheet consumer evidence:** none found.

### Table: `audit_log`
- **Origin:** `db.schema()`
- **Sheet/tab name:** `audit_log`
- **Column order confidence:** exact from schema registration
- **Columns (ordered):**
  1. `id`
  2. `actor`
  3. `action`
  4. `resourceType`
  5. `resourceId`
  6. `status`
  7. `message`
  8. `metadata`
  9. `createdAt`
  10. `updatedAt`
  11. `deletedAt`
- **Column details:**
  - `id`: String, primary key. Auto-generated when omitted.
  - `actor`: String, observed values: `system`, `scheduler`.
  - `action`: String, required by application writes.
  - `resourceType`: String, observed values: `slack_host`, `job`.
  - `resourceId`: String, optional, commonly empty string.
  - `status`: String, observed enum values: `info`, `error` plus caller-supplied job status.
  - `message`: String, optional human-readable audit message.
  - `metadata`: String, JSON-serialized object.
  - `createdAt`: DateTime, auto-populated.
  - `updatedAt`: DateTime, auto-populated.
  - `deletedAt`: DateTime, present in current implementation even though this is an audit/log table.
- **Foreign keys:** none.
- **Soft delete:** implementation supports `deletedAt`, but this table is logically append-only / audit-oriented.
- **Audit/log classification:** yes — should be treated as immutable in downstream design even though current generic repository includes `deletedAt`.
- **AppSheet consumer evidence:** none found.

### Table: `students`
- **Origin:** `db.schema()`
- **Sheet/tab name:** `students`
- **Column order confidence:** exact from schema registration
- **Columns (ordered):**
  1. `id`
  2. `name`
  3. `source`
  4. `createdAt`
  5. `updatedAt`
  6. `deletedAt`
- **Column details:**
  - `id`: String, primary key, explicitly required by schema and caller-supplied in host flows.
  - `name`: String, required by schema.
  - `source`: String, optional with schema default `'slack'`; observed values include `slash_command`, `workflow_webhook`.
  - `createdAt`: DateTime, auto-populated.
  - `updatedAt`: DateTime, auto-populated.
  - `deletedAt`: DateTime, optional soft-delete marker.
- **Foreign keys:** none.
- **Soft delete:** enabled via `deletedAt`.
- **AppSheet consumer evidence:** none found.

### Table: `enrollments`
- **Origin:** `db.schema()`
- **Sheet/tab name:** `enrollments`
- **Column order confidence:** exact from schema registration
- **Columns (ordered):**
  1. `id`
  2. `studentId`
  3. `courseId`
  4. `status`
  5. `source`
  6. `createdAt`
  7. `updatedAt`
  8. `deletedAt`
- **Column details:**
  - `id`: String, primary key. Auto-generated when omitted.
  - `studentId`: String, required by schema, foreign key to `students.id`.
  - `courseId`: String, required by schema.
  - `status`: String, optional with schema default `'enrolled'`; observed enum values: `enrolled` and workflow-provided overrides.
  - `source`: String, optional with schema default `'slack'`; observed values: `slash_command`, `workflow_webhook`.
  - `createdAt`: DateTime, auto-populated.
  - `updatedAt`: DateTime, auto-populated.
  - `deletedAt`: DateTime, optional soft-delete marker.
- **Foreign keys:** `studentId -> students.id`.
- **Soft delete:** enabled via `deletedAt`.
- **AppSheet consumer evidence:** none found.

### Table: `automations`
- **Origin:** `db.schema()`
- **Sheet/tab name:** `automations`
- **Column order confidence:** exact from schema registration
- **Columns (ordered):**
  1. `id`
  2. `requestId`
  3. `workflow`
  4. `eventType`
  5. `state`
  6. `createdAt`
  7. `updatedAt`
  8. `deletedAt`
- **Column details:**
  - `id`: String, primary key. Auto-generated when omitted.
  - `requestId`: String, required by schema.
  - `workflow`: String, required by schema, defaults in service to `'unknown_workflow'` before insert path.
  - `eventType`: String, required by schema, defaults in service to `'workflow_event'` before insert path.
  - `state`: String, optional with schema default `'received'`; observed enum values: `received`, `queued` and payload-driven values.
  - `createdAt`: DateTime, auto-populated.
  - `updatedAt`: DateTime, auto-populated.
  - `deletedAt`: DateTime, optional soft-delete marker.
- **Foreign keys:** none.
- **Soft delete:** enabled via `deletedAt`.
- **AppSheet consumer evidence:** none found.

### Table: `audit_logs`
- **Origin:** `db.schema()`
- **Sheet/tab name:** `audit_logs`
- **Column order confidence:** exact from schema registration
- **Columns (ordered):**
  1. `id`
  2. `requestId`
  3. `source`
  4. `action`
  5. `status`
  6. `message`
  7. `metadata`
  8. `createdAt`
  9. `updatedAt`
  10. `deletedAt`
- **Column details:**
  - `id`: String, primary key. Auto-generated when omitted.
  - `requestId`: String, required by schema.
  - `source`: String, required by schema; observed values include route types such as `slash_command` / `workflow_webhook`.
  - `action`: String, required by schema; observed values include `enrollment_upsert`, `automation_upsert`, route type names.
  - `status`: String, required by schema; observed enum values: `success`, `failure`.
  - `message`: String, optional.
  - `metadata`: String, optional JSON string.
  - `createdAt`: DateTime, auto-populated.
  - `updatedAt`: DateTime, auto-populated.
  - `deletedAt`: DateTime, present in implementation even though this is an audit/log table.
- **Foreign keys:** none.
- **Soft delete:** implementation supports `deletedAt`, but the table is logically append-only / audit-oriented.
- **Audit/log classification:** yes.
- **AppSheet consumer evidence:** none found.

## Section 3 — Cross-cutting Patterns

### Header / column-order reconstruction notes
- All discovered tables had explicit `db.schema(...)` registrations, so column order is known exactly from code.
- No table required fallback reconstruction from `data[0]` or `headers.indexOf(...)`.

### Generic SheetDb persistence behavior
- `id` is the effective primary key for every registered table.
- `createdAt`, `updatedAt`, and `deletedAt` are conventional system columns configured through `Config` / script properties.
- Insert behavior:
  - auto-generates `id` when missing
  - auto-populates `createdAt`
  - always refreshes `updatedAt`
  - initializes `deletedAt` to `''` when omitted
- `findAll()` only returns rows where `deletedAt` is blank, confirming soft-delete behavior is active globally.

### Soft-delete and audit notes
- The current codebase uses `deletedAt`, not `_rowStatus`.
- No table in this repo currently uses `_rowStatus = 'active'` filtering.
- Audit/log tables (`audit_log`, `audit_logs`) still include `deletedAt` because the generic schema scaffold uses the same trailing system columns for all tables. This differs from the requested future rule of avoiding delete fields on audit/log tables.

### AppSheet consumer scan
- No direct AppSheet integration, AppConfig, webhook handler, `_Key` formula column, read-only AppSheet annotations, or formula-column comments were found.
- Therefore no table can be positively flagged as AppSheet-consumed from current code.

## Section 4 — Ready-to-paste SheetDb schema block

```javascript
function registerRwrLmsSchemas(db) {
  db.schema('learners', {
    columns: ['id', 'slackUserId', 'email', 'name', 'status', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      id: { type: 'string' },
      slackUserId: { type: 'string' },
      email: { type: 'string' },
      name: { type: 'string' },
      status: { type: 'string' }
    }
  });

  db.schema('enrollment', {
    columns: ['id', 'learnerId', 'courseId', 'track', 'status', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      id: { type: 'string' },
      learnerId: { type: 'string' },
      courseId: { type: 'string' },
      track: { type: 'string', default: 'ONBOARDING' },
      status: { type: 'string' }
    }
  });

  db.schema('lessons', {
    columns: [
      'id', 'courseId', 'moduleId', 'sequenceNumber', 'track',
      'title', 'topic', 'objective', 'difficulty',
      'hook', 'coreContent', 'insight', 'takeaway',
      'mission', 'missionType', 'missionDuration', 'verification', 'submitBlock',
      'contentRef', 'active', 'createdAt', 'updatedAt', 'deletedAt'
    ],
    fields: {
      id: { type: 'string' },
      courseId: { type: 'string' },
      moduleId: { type: 'string', default: '' },
      sequenceNumber: { type: 'string', default: '0' },
      track: { type: 'string' },
      title: { type: 'string' },
      topic: { type: 'string', default: '' },
      objective: { type: 'string', default: '' },
      difficulty: { type: 'string', default: 'independent' },
      hook: { type: 'string', default: '' },
      coreContent: { type: 'string', default: '' },
      insight: { type: 'string', default: '' },
      takeaway: { type: 'string', default: '' },
      mission: { type: 'string', default: '' },
      missionType: { type: 'string', default: 'text' },
      missionDuration: { type: 'string', default: '3 min' },
      verification: { type: 'string', default: '' },
      submitBlock: { type: 'string', default: '' },
      contentRef: { type: 'string' },
      active: { type: 'string', default: 'true' }
    }
  });

  db.schema('learner_progress', {
    columns: ['id', 'learnerId', 'lessonId', 'state', 'dueAt', 'completedAt', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      id: { type: 'string' },
      learnerId: { type: 'string' },
      lessonId: { type: 'string' },
      state: { type: 'string' },
      dueAt: { type: 'string' },
      completedAt: { type: 'string' }
    }
  });

  db.schema('submission_log', {
    columns: ['id', 'learnerId', 'lessonId', 'submitKey', 'payload', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      id: { type: 'string' },
      learnerId: { type: 'string' },
      lessonId: { type: 'string' },
      submitKey: { type: 'string' },
      payload: { type: 'string', default: '' }
    }
  });

  db.schema('delivery_queue', {
    columns: ['id', 'learnerId', 'lessonId', 'status', 'runAt', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      id: { type: 'string' },
      learnerId: { type: 'string' },
      lessonId: { type: 'string' },
      status: { type: 'string' },
      runAt: { type: 'string' }
    }
  });

  db.schema('retry_queue', {
    columns: ['id', 'jobType', 'payload', 'attempts', 'nextRunAt', 'status', 'lastError', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      id: { type: 'string' },
      jobType: { type: 'string', default: 'unknown' },
      payload: { type: 'string', default: '{}' },
      attempts: { type: 'string', default: '0' },
      nextRunAt: { type: 'string' },
      status: { type: 'string', default: 'queued' },
      lastError: { type: 'string', default: '' }
    }
  });

  db.schema('audit_log', {
    columns: ['id', 'actor', 'action', 'resourceType', 'resourceId', 'status', 'message', 'metadata', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      id: { type: 'string' },
      actor: { type: 'string' },
      action: { type: 'string' },
      resourceType: { type: 'string' },
      resourceId: { type: 'string', default: '' },
      status: { type: 'string' },
      message: { type: 'string' },
      metadata: { type: 'string', default: '{}' }
    }
  });

  db.schema('students', {
    columns: ['id', 'name', 'source', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      id: { required: true, type: 'string' },
      name: { required: true, type: 'string' },
      source: { type: 'string', default: 'slack' }
    }
  });

  db.schema('enrollments', {
    columns: ['id', 'studentId', 'courseId', 'status', 'source', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      id: { type: 'string' },
      studentId: { required: true, type: 'string' },
      courseId: { required: true, type: 'string' },
      status: { type: 'string', default: 'enrolled' },
      source: { type: 'string', default: 'slack' }
    }
  });

  db.schema('automations', {
    columns: ['id', 'requestId', 'workflow', 'eventType', 'state', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      id: { type: 'string' },
      requestId: { required: true, type: 'string' },
      workflow: { required: true, type: 'string' },
      eventType: { required: true, type: 'string' },
      state: { type: 'string', default: 'received' }
    }
  });

  db.schema('audit_logs', {
    columns: ['id', 'requestId', 'source', 'action', 'status', 'message', 'metadata', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      id: { type: 'string' },
      requestId: { required: true, type: 'string' },
      source: { required: true, type: 'string' },
      action: { required: true, type: 'string' },
      status: { required: true, type: 'string' },
      message: { type: 'string' },
      metadata: { type: 'string' }
    }
  });

  return db;
}
```

## Section 5 — Search evidence map

### Search patterns used
- `*.csv`
- `db.schema(`
- `registerTable(`
- `SpreadsheetApp.getSheetByName(`
- `getDataRange().getValues()`
- `headers.indexOf(`
- `db.table(`
- `AppSheet`, `_Key`, `formula`, `_rowStatus`

### Findings summary by requested search class
- **Physical CSV files:** none found.
- **`SheetDb.registerTable()` calls:** library bootstrap registers arbitrary tables, but consuming app code uses `db.schema(...)` rather than direct `registerTable(...)`.
- **`db.schema()` calls:** found in `00_WebAppEntry.gs`, `slack_host/00_WebAppEntry.gs`, and `slack_host/11_HostTestHarness.gs`.
- **`SpreadsheetApp.getSheetByName()` calls:** only in `24_SheetsGateway.gs` and mirrored library copy.
- **`sheet.getDataRange().getValues()` calls:** only in `24_SheetsGateway.gs` and mirrored library copy.
- **`headers.indexOf()` calls:** none found.
- **`db.table('...')` calls:** found across LMS services, health monitoring, retry resolution, Slack host services, and router logic.
