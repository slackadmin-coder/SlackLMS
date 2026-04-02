# Runbook

## 1. System Overview (Ops View)
### What runs daily
- `runDailyLessonDelivery()` delivers queued lessons.

### What runs hourly
- `runHourlyReminderCheck()` sends reminders for overdue learners.

### What runs on-demand
- Slack ingress via `doPost(e)` for slash commands, events, and interactivity.
- `runWeeklyAdminReport()` and `runHealthCheck()` can be manually executed.
- Host harness functions can be run from script editor for diagnostics.

## 2. Daily Operations
1. Monitor lesson delivery run result (`runDailyLessonDelivery`).
2. Check `audit_log` for failed/denied request patterns.
3. Verify Slack send success from API result patterns and retry queue growth.
4. Review `delivery_queue` for rows stuck in `queued` unexpectedly.

## 3. Hourly Operations
1. Validate reminder job executed (`runHourlyReminderCheck`).
2. Check `retry_queue` depth and age distribution.
3. Review recent Slack API failures from health/audit entries.
4. Confirm no sustained backlog in overdue learner reminders.

## 4. Weekly Operations
1. Run/validate `runWeeklyAdminReport` output.
2. Check cohort progress consistency (`completed`, `submitted`, `overdue`).
3. Data integrity checks:
   - learner records have valid `slackUserId`
   - enrollment rows align to learner IDs
   - progress rows map to known lessons

## 5. Incident Response Playbooks

### Slack Not Responding
1. Verify Apps Script deployment URL is active.
2. Confirm Slack app is installed in workspace.
3. Check Apps Script executions/logs for incoming requests.
4. Re-deploy web app if deployment was revoked or outdated.

### Slash Command Fails
1. Verify slash command endpoint in Slack app settings.
2. Check Script Properties required keys.
3. Inspect parser output using host harness slash tests.
4. Validate security verification path (signature or fallback token).

### Interactivity Timeout
1. Ensure interactivity responses return quickly (<3s).
2. Check router dispatch for `interactivity` route.
3. Verify payload parse and action/callback/type handling.
4. Offload heavy logic to queue/scheduler path where needed.

### Bot Cannot DM User
1. Ensure user has interacted with bot / app installed scope is valid.
2. Validate `conversations.open` response in `SlackApiClient.openDm`.
3. Confirm Slack scopes include required IM/chat permissions.

### Scheduler Not Running
1. Check trigger list in Apps Script project.
2. Re-run `setupTriggers()`.
3. Verify Apps Script permissions/authorization for trigger owner.
4. Confirm lock contention is not blocking recurring jobs.

### Duplicate Lessons Sent
1. Inspect `delivery_queue` and duplicate queued rows.
2. Check idempotency strategy for queue insertion and submit keys.
3. Verify state transitions in `LearnerProgressStateMachine`.

### Data Not Updating
1. Verify runtime sheet tab names exist and are writable.
2. Confirm `SPREADSHEET_ID` targets expected sheet.
3. Check `SheetDb` client initialization and table schema registration.
4. Verify script execution identity has edit access.

## 6. Retry and Recovery
- Retry policy is centralized in `RetryResolver`.
- Retryable Slack/API failures are queued through `scheduleRetry`.
- Manual reprocess pattern:
  1. Inspect due rows (`resolveDueRetries`).
  2. Re-run job payload through appropriate service.
  3. Update attempts/status via `markAttempt`.
- Stuck jobs can be moved to dead-letter status after max attempts.

## 7. Manual Overrides
- Manually trigger lesson delivery: run `runDailyLessonDelivery()`.
- Manually mark lesson complete: update `learner_progress` row carefully (Verify in code).
- Manually enroll learner: run enrollment service path through command/harness and verify `learners` + `enrollment` rows.

## 8. Logs and Observability
- **Apps Script execution logs:** ingress and function execution traces.
- **`audit_log` table:** structured operations and status metadata.
- **Queue tables:** `delivery_queue`, `retry_queue` for asynchronous state visibility.
- Request tracing approach:
  - correlate by row IDs (audit/submission/queue IDs) and timestamps.
  - Verify in code if additional correlation key is introduced.

## 9. Health Monitoring
Check these metrics regularly:
- failed Slack API calls
- queue backlog (`delivery_queue`, `retry_queue`)
- overdue learner count
- scheduler run success/failure
- config validation + SheetDb health snapshot

Use `runHealthCheck()` / `HealthMonitor.getSnapshot()` for consolidated status.

## 10. Maintenance Tasks
- Clean old audit/queue logs based on retention policy.
- Rotate secrets in Script Properties:
  - `SLACK_BOT_TOKEN`
  - `SLACK_SIGNING_SECRET`
  - optional fallback token
- Re-run trigger setup after ownership/permission changes.
- Review optional config defaults (`DEFAULT_COURSE_ID`, `DEFAULT_TRACK`).

## 11. Safe Update Procedure
1. Apply minimal scoped change in branch.
2. Run syntax checks and host harness smoke tests.
3. Deploy new web app version.
4. Validate `/learn`, `/submit`, `/progress`, app mention, and interactivity.
5. Monitor logs/queues for 30-60 minutes.
6. Roll back to prior Apps Script deployment if error rate increases.

## 12. Escalation Path
When escalating, include:
- incident start time + timezone
- affected workflow(s): slash/event/interactivity/scheduler
- sample payload metadata (redacted)
- relevant audit row IDs and timestamps
- retry queue sample rows
- recent deployment or config changes

Notify:
- Slack app owner/admin
- Apps Script owner
- LMS operations owner

If ownership is unclear, **Verify in code/repo ownership records**.
