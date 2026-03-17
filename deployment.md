# Deployment Guide

## 1. Purpose
This guide describes how to deploy the Slack LMS Apps Script integration using the current single-endpoint Slack manifest and Google Sheets runtime database.

## 2. Deployment Architecture
- Slack routes `/lesson`, `/submit`, `/progress`, interactivity, `message.im`, and `app_mention` to one Apps Script Web App URL.
- Apps Script host (`code.gs#doPost`) orchestrates parser -> security -> router -> services.
- Runtime persistence is Google Sheets through shared `SheetDb` (`LMSLibrary`) helpers.
- Triggered jobs run lesson delivery, reminders, and reporting.

## 3. Prerequisites
- Google Workspace account with Apps Script deployment permissions.
- Slack app admin access for command/events/interactivity settings.
- Target Google Spreadsheet with edit access for script execution identity.
- Repository code synced into Apps Script project.

## 4. Required Configuration
Set these Script Properties in Apps Script project settings.

| Key | Required | Description |
|---|---|---|
| `SLACK_BOT_TOKEN` | Yes | Bot token used by `SlackApiClient`. |
| `SLACK_SIGNING_SECRET` | Yes | Secret for signature verification. |
| `SPREADSHEET_ID` | Yes | Runtime spreadsheet ID for SheetDb client. |
| `SLACK_VERIFICATION_TOKEN` | Optional | Fallback verification token when headers are unavailable. |
| `ADMIN_USER_IDS` | Optional | CSV of admin users for future gated operations. |
| `DEFAULT_COURSE_ID` | Optional | Default course assignment fallback. |
| `DEFAULT_TRACK` | Optional | Default track assignment fallback. |
| `OPS_ALERT_CHANNEL` | Optional | Escalation target for reminders/incidents. |

## 5. Google Sheets Setup
1. Create/select a Google Spreadsheet for runtime data.
2. Provide its ID via `SPREADSHEET_ID`.
3. Ensure Apps Script execution identity has edit access.
4. First execution of host bootstrap will register required runtime tabs:
   - `learners`
   - `enrollment`
   - `lessons`
   - `learner_progress`
   - `submission_log`
   - `delivery_queue`
   - `retry_queue`
   - `audit_log`

## 6. Apps Script Setup
1. Open/create Apps Script project.
2. Add repository `.gs` files and markdown docs.
3. Confirm `code.gs` is present with `doGet` and `doPost`.
4. Set Script Properties from Section 4.
5. Save project and run a lightweight function (e.g., `ConfigBootstrap.validate`) to verify property access.

## 7. Slack App Setup
Use existing `manifest.json` values:
- Slash commands:
  - `/lesson`
  - `/submit`
  - `/progress`
- Events:
  - `message.im`
  - `app_mention`
- Interactivity: enabled.

If using manifest import/update in Slack:
1. Open Slack app settings -> App Manifest.
2. Paste current `manifest.json` content.
3. Save/apply changes.

## 8. Endpoint Wiring
1. Deploy Apps Script as **Web App**.
2. Copy deployment URL.
3. Ensure Slack manifest command/event/interactivity URLs match this deployment URL.
4. Reinstall/update app in workspace when required by Slack.

## 9. Trigger Setup
After first deploy:
1. Run `setupTriggers()` once from Apps Script editor.
2. Confirm triggers exist for:
   - `runDailyLessonDelivery`
   - `runHourlyReminderCheck`
   - `runWeeklyAdminReport`
3. Verify project timezone matches reporting expectations.

## 10. Smoke Test Procedure
Execute in order:
1. **Health check**: run `runHealthCheck()` manually.
2. **Slash commands**:
   - `/lesson`
   - `/submit <lesson_id>`
   - `/progress`
3. **Interactivity**: submit a test interactive payload (or `hostTest_fakeInteractive`).
4. **Events**:
   - `hostTest_fakeAppMention`
   - `hostTest_fakeMessageIm`
5. **Scheduler jobs**:
   - run `runDailyLessonDelivery`
   - run `runHourlyReminderCheck`
6. Confirm writes in `audit_log`, `submission_log`, queue tables.

## 11. Troubleshooting
- **403/verification errors:** check `SLACK_SIGNING_SECRET`, timestamp skew, and fallback token behavior.
- **No sheet writes:** validate `SPREADSHEET_ID` and spreadsheet permissions.
- **Slack API failures:** inspect retry queue and `SlackApiClient` error shape.
- **Triggers missing:** re-run `setupTriggers()`.
- **Interactivity timeout:** keep router+service response path lightweight (<3s) and offload heavy work to queue/scheduler.

## 12. Production Readiness Checklist
- [ ] Required Script Properties set.
- [ ] Slack endpoint URL matches current deployment.
- [ ] Commands and events enabled in Slack app.
- [ ] Trigger jobs installed.
- [ ] Audit table receiving host events.
- [ ] Retry queue monitored.
- [ ] Runbook shared with operations.
- [ ] Rollback path documented.

## 13. Safe Change Procedure
1. Create branch and apply minimal patch.
2. Run syntax checks and smoke harness functions.
3. Deploy to non-production/staging (if available).
4. Validate slash/event/interactivity flows.
5. Promote deployment and monitor `audit_log` + `retry_queue`.
6. Roll back to prior deployment version if error rate rises.
