# Slack LMS Automation

## 1. Overview
This repository implements a Slack LMS automation host on Google Apps Script and Google Sheets, with shared utilities provided by `LMSLibrary` (`sheet_db_lib`). Slack commands, events, and interactivity all enter through one Apps Script endpoint and are dispatched through modular parser/security/router/service layers.

## 2. Features
- Single-ingress Slack webhook host (`doPost(e)`).
- Slash command routing for:
  - `/learn`
  - `/submit`
  - `/progress`
  - `/report`
  - `/onboard`
- Event callback routing for:
  - `message.im`
  - `app_mention`
- Interactivity payload routing.
- Runtime data persistence in Google Sheets tables.
- Slack API wrapper with retry-friendly error shape.
- Installable scheduler jobs for delivery, reminders, and reporting.
- Health and retry scaffolds for operations.

## 3. Architecture Summary
High-level flow:

`Slack -> manifest.json endpoint -> code.gs#doPost -> SlackPayloadParser -> SlackSecurity -> SlackRouter -> SlackService + domain services -> SheetDb + SlackApiClient`

Key principle: keep ingress thin and move behavior into modular services.

## 4. Repo Structure
- `code.gs` — anchor web app entrypoint (thin host shell).
- `00_WebAppEntry.gs` — dependency and DB bootstrap.
- `01`–`04` — router/parser/security/dispatch layers.
- Domain services — `09_LmsEnrollmentService.gs`, `12_LmsLessonService.gs`, `13_LmsProgressService.gs`, `13a_LmsCompletionService.gs`, `14_LmsReminderService.gs`, `ReportService.gs`.
- Integrations/state — `11_SlackApiClient.gs`, `12_SlackBlockKitBuilder.gs`, `13_LearnerProgressStateMachine.gs`.
- Ops/support — `14_Scheduler.gs`, `15_SheetsDataSync.gs`, `16_ConfigBootstrap.gs`, `17_HealthMonitor.gs`, `18_RetryResolver.gs`, `19_HostTestHarness.gs`.
- `manifest.json` — Slack app manifest.
- `sheet_db_lib/` — shared library (DB/config/audit helpers).
- `md_mirror/`, `pdf_mirror/` — mirrored reference docs.

### Canonical Module Ownership (`00`–`21`)
The canonical module contract is maintained in `docs/scaffold_traceability.md`:

- `00` `00_WebAppEntry.gs` — host entry wiring.
- `01` `01_SlackRouter.gs` — route dispatch.
- `02` `02_SlackPayloadParser.gs` — payload normalization.
- `03` `03_SlackService.gs` — slash/event/interactivity dispatch.
- `04` `04_SlackSecurity.gs` — request verification.
- `05` `05_AppSheetWebhook.gs` — workflow webhook bridge.
- `06` `14_Scheduler.gs` — automation orchestration jobs.
- `07` `07_AuditLogger_Sheets.gs` — audit sink wiring.
- `08` `12_SlackBlockKitBuilder.gs` — response/block formatting.
- `09` `09_LmsEnrollmentService.gs` — enrollment + onboarding.
- `10` `16_ConfigBootstrap.gs` — runtime/script configuration.
- `11` `19_HostTestHarness.gs` — host harness entrypoints.
- `12` `08_DbSchema.gs` — runtime schema contract.
- `13` `13_LearnerProgressStateMachine.gs` — state transition policy.
- `14` `12_LmsLessonService.gs` — lesson delivery domain logic.
- `15` `13_LmsProgressService.gs` — progress summary logic.
- `16` `13a_LmsCompletionService.gs` — submission/completion logic.
- `17` `14_LmsReminderService.gs` — reminder workflow logic.
- `18` `17_HealthMonitor.gs` — health checks and telemetry snapshots.
- `19` `18_RetryResolver.gs` — retry queue processing.
- `20` `20_Errors.gs` — error taxonomy.
- `21` `21_Util.gs` — shared utility helpers.

## 5. Workflows
Supported runtime workflows:
- onboarding/enrollment scaffold
- `/learn`
- `/submit`
- `/progress`
- interactivity handling scaffold
- `message.im` and `app_mention` events
- scheduled daily lesson delivery
- hourly reminders
- weekly reporting

See `architecture.md` for the full workflow map.

## 6. Tech Stack
- Google Apps Script (V8 runtime)
- Google Sheets (runtime DB)
- Slack App + Events API + Interactivity
- Shared in-repo LMS library utilities (`SheetDb`, `23_Config.gs` DB config, script props helper, audit/transactions)

## 7. Configuration
Set Script Properties in Apps Script (loaded via `16_ConfigBootstrap.gs`):
- Required:
  - `SLACK_BOT_TOKEN`
  - `SLACK_SIGNING_SECRET`
  - `SPREADSHEET_ID`
- Optional:
  - `SLACK_VERIFICATION_TOKEN`
  - `ADMIN_USER_IDS`
  - `DEFAULT_COURSE_ID`
  - `DEFAULT_TRACK`
  - `OPS_ALERT_CHANNEL`

## 8. Deployment
Use `deployment.md` for the full deployment process:
1. Configure script properties.
2. Deploy Apps Script Web App.
3. Wire Slack manifest URLs to deployment URL.
4. Run `setupTriggers()`.
5. Execute smoke tests.

## 9. Testing
Use host test harness functions in `19_HostTestHarness.gs`:
- `hostTest_fakeSlashLearn`
- `hostTest_fakeSlashSubmit`
- `hostTest_fakeSlashProgress`
- `hostTest_fakeInteractive`
- `hostTest_fakeAppMention`
- `hostTest_fakeMessageIm`
- `hostTest_reminderSmoke`
- `hostTest_dailyDeliverySmoke`

Also run syntax checks before deployment.

## 10. Extending
- Add new slash commands in `03_SlackService.gs` registry.
- Extend event/interactivity branching in `SlackService`.
- Implement final lesson sequencing and authored-content sync in `15_SheetsDataSync.gs`.
- Add richer retry/dead-letter policies in `18_RetryResolver.gs`.

## 11. Docs Index
- `architecture.md` — architecture, workflow/data/tool maps.
- `deployment.md` — deployment and smoke tests.
- `runbook.md` — production operations and incident response.
- `README.md` — this overview.

## 12. Status Notes
- This repository currently provides scaffold-complete operational structure.
- Some business-specific mapping and sequencing are placeholders marked with next-phase.
- For uncertain behavior, follow “Verify in code” notes in `architecture.md`.
