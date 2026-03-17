# Slack LMS Architecture

## 1. System Overview
The Slack LMS system is a single-ingress integration where Slack sends all command, interactivity, and event traffic to one Google Apps Script web app endpoint configured in `manifest.json`. The Apps Script host executes a thin orchestration chain:

`Slack -> doPost(e) -> SlackPayloadParser -> SlackSecurity -> SlackRouter -> SlackService/domain services -> SheetDb runtime tables + Slack API`

The runtime data store is Google Sheets accessed through the shared `SheetDb` / `LMSLibrary` layer. Core operations are audited to `audit_log`, asynchronous follow-up is represented in `delivery_queue` and `retry_queue`, and scheduled operations are invoked through Apps Script installable triggers.

## 2. Core Architecture Pattern
- **Single ingress:** `code.gs#doPost(e)` is the only webhook ingress.
- **Thin host shell:** `doPost(e)` only coordinates parse/verify/route and error response.
- **Registry dispatch:** `03_SlackService.gs` maps slash commands and routes event/interactivity payload types.
- **Domain services:** enrollment, lesson, progress, completion, reminder, and report services own business behavior.
- **Shared library reuse:** `SheetDb` and `ScriptPropertiesHelper` are reused for DB and configuration helpers.
- **Operational modules:** scheduler, retry resolver, health monitor, and test harness are isolated modules.

## 3. Runtime Components
- **Ingress / host shell**
  - `code.gs`: `doGet`, `doPost`, host config/dependency accessors, safe response/log helpers.
- **Dependency bootstrap**
  - `00_WebAppEntry.gs`: DB schema registration and dependency graph wiring.
- **Transport normalization and controls**
  - `02_SlackPayloadParser.gs`: request normalization.
  - `04_SlackSecurity.gs`: signature/timestamp verification with fallback mode.
  - `01_SlackRouter.gs`: route-type dispatch.
- **Application dispatch**
  - `03_SlackService.gs`: slash/interactivity/event/workflow routing.
- **Domain services**
  - `05_LmsEnrollmentService.gs`
  - `06_LmsLessonService.gs`
  - `07_LmsProgressService.gs`
  - `08_LmsCompletionService.gs`
  - `09_LmsReminderService.gs`
  - `10_LmsReportService.gs`
- **Integrations and builders**
  - `11_SlackApiClient.gs`
  - `12_SlackBlockKitBuilder.gs`
- **State, jobs, resiliency**
  - `13_LearnerProgressStateMachine.gs`
  - `14_Scheduler.gs`
  - `18_RetryResolver.gs`
  - `17_HealthMonitor.gs`
- **Configuration and sync/testing helpers**
  - `16_ConfigBootstrap.gs`
  - `15_SheetsDataSync.gs`
  - `19_HostTestHarness.gs`

## 4. Workflow Map (detailed flows)

### 4.1 Onboarding
- **Trigger:** `/enroll` placeholder command flow (or service call path) and explicit enrollment service use.
- **Flow steps:**
  1. Payload parsed and security checked.
  2. Router dispatches to slash handler.
  3. `LmsEnrollmentService.enrollLearner` ensures learner + enrollment, queues first lesson, sends welcome DM.
- **Data reads/writes:**
  - Read `learners`, `enrollment`.
  - Write `learners` (if new), `enrollment` (if new), `delivery_queue`, `audit_log`.
- **Slack output:** welcome DM via `openDm` + `postMessage`.
- **Failure path:** returns structured `{ ok:false, code, message }`; retry may apply for Slack API failures.

### 4.2 `/lesson`
- **Trigger:** slash command `/lesson` from Slack.
- **Flow steps:** parse -> verify -> route `slash_command` -> `SlackService.handleSlashCommand` -> `LmsLessonService.handleLesson`.
- **Data reads/writes:**
  - Read `learners`, `learner_progress`, `lessons`.
  - Optional write to `audit_log` through host audit helper.
- **Slack output:** ephemeral lesson payload with Block Kit lesson card.
- **Failure path:** learner/lesson missing returns ephemeral error text.

### 4.3 `/submit`
- **Trigger:** slash command `/submit <lesson_id>`.
- **Flow steps:** parse -> verify -> route -> `LmsCompletionService.handleSubmit`.
- **Data reads/writes:**
  - Read `learners`, `submission_log`, `learner_progress`.
  - Write `submission_log` with idempotency key, update `learner_progress` state, enqueue `delivery_queue` next lesson.
  - Write audit via DB audit helper.
- **Slack output:** ephemeral submission confirmation.
- **Failure path:** missing args/learner/progress returns structured error response.

### 4.4 `/progress`
- **Trigger:** slash command `/progress`.
- **Flow steps:** parse -> verify -> route -> `LmsProgressService.handleProgress`.
- **Data reads/writes:**
  - Read `learners`, `learner_progress`.
  - No required writes (scaffold).
- **Slack output:** ephemeral progress summary blocks.
- **Failure path:** learner not found -> ephemeral error.

### 4.5 Interactivity
- **Trigger:** Slack interactive payload (`payload` form field).
- **Flow steps:** parse to `interactivity` -> verify -> route -> `SlackService.handleInteractivity`.
- **Data reads/writes:** Verify in code (current scaffold acknowledges payload type/action/callback).
- **Slack output:** ephemeral acknowledgement or view_submission clear action.
- **Failure path:** unsupported interactive payload returns safe fallback response.

### 4.6 `message.im`
- **Trigger:** Slack Events API `message` with `channel_type=im`.
- **Flow steps:** parse JSON -> verify -> route `event_callback` -> `SlackService.handleEventCallback` branch.
- **Data reads/writes:** none required in current scaffold (Verify in code for future enrichment).
- **Slack output:** acknowledgement text payload.
- **Failure path:** unsupported event type returns ignored response.

### 4.7 `app_mention`
- **Trigger:** Slack event `app_mention`.
- **Flow steps:** same event flow as above, mention branch in event handler.
- **Data reads/writes:** none required in scaffold.
- **Slack output:** guidance message to use slash commands.
- **Failure path:** event falls back to ignored.

### 4.8 Scheduled Delivery
- **Trigger:** `runDailyLessonDelivery` installable trigger.
- **Flow steps:** lock acquisition -> dependency bootstrap -> `LmsLessonService.deliverPendingLessons`.
- **Data reads/writes:**
  - Read `delivery_queue`, `learners`.
  - Write `delivery_queue` status updates, possibly `learner_progress` state transitions.
- **Slack output:** DMs for due lessons.
- **Failure path:** lock/contention or Slack failure -> structured error; retry queue can be populated by Slack client.

### 4.9 Reminders
- **Trigger:** `runHourlyReminderCheck` trigger.
- **Flow steps:** lock -> `LmsReminderService.sendOverdueReminders`.
- **Data reads/writes:**
  - Read `learner_progress` overdue rows, `learners`.
  - Optional writes to audit/retry queues.
- **Slack output:** reminder DM blocks.
- **Failure path:** per-learner failure captured in batch result.

### 4.10 Reporting
- **Trigger:** `runWeeklyAdminReport` trigger and optional `/report` command placeholder.
- **Flow steps:** dependency bootstrap -> `LmsReportService` summary methods.
- **Data reads/writes:**
  - Read `learners`, `enrollment`, `learner_progress`.
  - Optional write/audit in future implementation.
- **Slack output:** summary blocks for admin contexts.
- **Failure path:** returns structured report error result.

## 5. Data Architecture

### 5.1 Runtime Tables (Google Sheets)
1. **learners**
   - Purpose: Slack user to LMS learner identity mapping.
   - Typical fields: `id`, `slackUserId`, `email`, `name`, `status`, timestamps.
2. **enrollment**
   - Purpose: learner-to-course/track enrollment state.
   - Typical fields: `id`, `learnerId`, `courseId`, `track`, `status`.
3. **lessons**
   - Purpose: runtime lesson catalog.
   - Typical fields: `id`, `courseId`, `track`, `title`, `contentRef`, `active`.
4. **learner_progress**
   - Purpose: per-learner lesson state machine records.
   - Typical fields: `id`, `learnerId`, `lessonId`, `state`, `dueAt`, `completedAt`.
5. **submission_log**
   - Purpose: submission history and idempotency tracking.
   - Typical fields: `id`, `learnerId`, `lessonId`, `submitKey`, `payload`.
6. **delivery_queue**
   - Purpose: async lesson delivery queue.
   - Typical fields: `id`, `learnerId`, `lessonId`, `status`, `runAt`.
7. **retry_queue**
   - Purpose: retryable failures with attempt metadata.
   - Typical fields: `id`, `jobType`, `payload`, `attempts`, `nextRunAt`, `status`, `lastError`.
8. **audit_log**
   - Purpose: operational trace and change logs.
   - Typical fields: `id`, `actor`, `action`, `resourceType`, `resourceId`, `status`, `message`, `metadata`.

### 5.2 Script Properties Map
- **Required**
  - `SLACK_BOT_TOKEN`
  - `SLACK_SIGNING_SECRET`
  - `SPREADSHEET_ID`
- **Optional**
  - `SLACK_VERIFICATION_TOKEN`
  - `ADMIN_USER_IDS`
  - `DEFAULT_COURSE_ID`
  - `DEFAULT_TRACK`
  - `OPS_ALERT_CHANNEL`

### 5.3 Slack Payload Fields (normalized envelope)
`routeType`, `rawBody`, `body`, `params`, `command`, `payloadType`, `userId`, `channelId`, `teamId`, `triggerId`, `responseUrl`, `slackSignature`, `slackTimestamp`, plus `parseError` / `ok` status.

### 5.4 Audit Fields
- Host and service audit entries include action/status metadata and redacted logs.
- `db.audit(...)` emits structured entries through shared library audit sink.

### 5.5 Correlation IDs
- No dedicated global correlation ID key is hardcoded in current scaffold.
- Recommended operational correlation strategy: use queue row IDs / submission IDs / audit row IDs as trace anchors. **Verify in code** before enforcing additional ID fields.

## 6. Tool / Module Map

### Ingress
- `code.gs#doPost(e)`, `code.gs#doGet()`

### Parser
- `02_SlackPayloadParser.gs` (`SlackPayloadParser.parse`)

### Security
- `04_SlackSecurity.gs` (`SlackSecurity.verify` + HMAC/replay logic)

### Router
- `01_SlackRouter.gs` (`SlackRouter.route`)

### Services
- `03_SlackService.gs` command/event/interactivity registries
- `05`–`10` domain service modules

### DB Layer
- `00_WebAppEntry.gs#createHostDbClient`
- `sheet_db_lib/*` (`SheetDb`, `DbClient`, `TableRepository`, transactions, audit)

### Slack API Client
- `11_SlackApiClient.gs`

### Block Kit Builder
- `12_SlackBlockKitBuilder.gs`

### Scheduler
- `14_Scheduler.gs`

### Retry
- `18_RetryResolver.gs`

### Health
- `17_HealthMonitor.gs`

### Config
- `16_ConfigBootstrap.gs`
- `sheet_db_lib/10_ScriptProperties.gs`

### Test Harness
- `19_HostTestHarness.gs`

### LMSLibrary Reuse
- Reused: DB client creation, health checks, script property helpers, table CRUD, transaction/audit utilities.
- Local wrappers: host-specific dependency graph, Slack domain service contracts.

## 7. Security Model
- **Primary verification:** Slack signing secret via HMAC-SHA256 over `v0:timestamp:rawBody`.
- **Replay protection:** timestamp skew rejection (>5 minutes).
- **Fallback mode:** verification-token check only when signature headers are unavailable in Apps Script request context and optional token is configured.
- **Secret handling:** script properties only; sanitized logging redacts secret/token fields.
- **Failure response:** consistent structured denial payloads from `doPost`.

## 8. Scheduling and Automation
- `setupTriggers()` installs daily/hourly/weekly trigger jobs.
- Jobs use `LockService` to avoid concurrent overlap.
- Daily: pending lesson delivery.
- Hourly: overdue reminders.
- Weekly: admin summary generation.
- Optional: `runHealthCheck()` health snapshot run.

## 9. Extensibility
- Add new slash commands by extending `_slashRegistry` in `03_SlackService.gs`.
- Add event types in `handleEventCallback` without changing ingress flow.
- Expand interactivity routing by `action_id`, `callback_id`, or modal type.
- Plug in richer retry and dead-letter policies in `18_RetryResolver.gs`.
- Promote placeholder TODOs to schema-specific logic in sync and sequencing modules.

## 10. Constraints / Verification Points
- Apps Script header availability for Slack signature is environment-dependent: **Verify in code/runtime logs**.
- Correlation ID standard across all tables not finalized: **Verify in code**.
- Lesson ordering/next-lesson rules are placeholders: **Verify in code**.
- Interactivity business actions are scaffold-level acknowledgements: **Verify in code**.
- Exact authored->runtime lesson sync mapping is pending: **Verify in code**.

## 11. File Reference
- Host shell: `code.gs`
- Host DI/bootstrap: `00_WebAppEntry.gs`
- Router/parser/security/service: `01`–`04`
- Domain services: `05`–`10`
- Integrations/builders/state: `11`–`13`
- Scheduler/sync/config/health/retry/tests: `14`–`19`
- Shared library: `sheet_db_lib/*`
- Slack manifest: `manifest.json`
