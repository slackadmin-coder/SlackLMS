# Scaffold Traceability (Canonical Ownership)

This document defines the **canonical module ownership contract** for modules `00`–`21` and the explicit equivalence mapping for drifted modules in `22_*.gs`–`36_*.gs`.

## 1) Canonical modules (`00`–`21`)

| Canonical Module | Canonical Responsibility | Owning File (exactly one) | Primary Functions / API |
|---|---|---|---|
| 00 | Web app entry + dependency wiring | `00_WebAppEntry.gs` | `resolveHostConfig`, `createHostDbClient`, `createHostDependencies` |
| 01 | Route dispatch | `01_SlackRouter.gs` | `SlackRouter.route` |
| 02 | Slack payload normalization | `02_SlackPayloadParser.gs` | `SlackPayloadParser.parse` |
| 03 | Command/event/interactivity dispatch | `03_SlackService.gs` | `handleSlashCommand`, `handleEventCallback`, `handleInteractivity` |
| 04 | Slack request verification | `04_SlackSecurity.gs` | `SlackSecurity.verify` |
| 05 | External workflow webhook bridge | `05_AppSheetWebhook.gs` | `AppSheetWebhook.verifyToken`, `AppSheetWebhook.route` |
| 06 | Automation orchestration jobs | `14_Scheduler.gs` | `setupTriggers`, `runDailyLessonDelivery`, `runHourlyReminderCheck`, `runWeeklyAdminReport` |
| 07 | Operational audit sink wiring | `07_AuditLogger_Sheets.gs` | `createSheetsAuditLogger` |
| 08 | Slack response/block formatting | `12_SlackBlockKitBuilder.gs` | `buildLessonCard`, `buildProgressSummary`, `buildReminder` |
| 09 | Enrollment + onboarding workflow ownership | `09_LmsEnrollmentService.gs` | `enrollLearner`, `_queueFirstLesson`, `_sendWelcomeDm` |
| 10 | Runtime/script configuration ownership | `16_ConfigBootstrap.gs` | `ConfigBootstrap.load`, `ConfigBootstrap.validate`, `ConfigBootstrap.get` |
| 11 | Host harness + deterministic integration tests | `19_HostTestHarness.gs` | `hostTest_fakeSlashLearn`, `hostTest_fakeSlashSubmit`, `hostTest_workflowWebhookEnroll` |
| 12 | Runtime data schema contract | `08_DbSchema.gs` | `DbSchema.createHostTableDefinitions`, `DbSchema.createHostSchemas` |
| 13 | Learner state transition policy | `13_LearnerProgressStateMachine.gs` | `normalizeState`, `transition`, `migrateLegacyStatesInDb` |
| 14 | Lesson delivery domain service | `12_LmsLessonService.gs` | `handleLesson`, `deliverPendingLessons` |
| 15 | Progress summary domain service | `13_LmsProgressService.gs` | `handleProgress` |
| 16 | Submission/completion domain service | `13a_LmsCompletionService.gs` | `handleSubmit`, `advanceLessonState`, `queueNextLesson` |
| 17 | Reminder domain service | `14_LmsReminderService.gs` | `sendOverdueReminders` |
| 18 | Resiliency and health ownership | `17_HealthMonitor.gs` | `recordJobStatus`, `getQueueDepthReport`, `getSnapshot` |
| 19 | Retry processing ownership | `18_RetryResolver.gs` | `enqueue`, `resolveDue`, `markAttempt` |
| 20 | Error taxonomy ownership | `20_Errors.gs` | `SheetDbError`, `ConfigError`, `SchemaError`, `TransactionError` |
| 21 | Shared utility ownership | `21_Util.gs` | `Util.nowIso`, `Util.generateId`, `Util.assert`, `enforceAuditAppendOnly` |

## 2) Drifted modules (`22_*.gs`–`36_*.gs`) explicit equivalent ownership

No duplicate ownership is allowed in this section: each drifted file maps to one canonical owner module.

| Drifted File | Ownership Status | Canonical Owner Module | Equivalent Responsibility |
|---|---|---|---|
| `22_ScriptProperties.gs` | Equivalent ownership documented | 10 | Script property access and DB/client config projection |
| `23_Config.gs` | Equivalent ownership documented | 10 | DB-scoped configuration contract and validation |
| `24_SheetsGateway.gs` | Equivalent ownership documented | 12 | Sheets storage gateway used by schema-backed persistence |
| `25_SchemaRegistry.gs` | Equivalent ownership documented | 12 | Schema registration/defaulting/validation |
| `26_TableRepository.gs` | Equivalent ownership documented | 12 | CRUD repository bound to canonical schema tables |
| `27_TransactionManager.gs` | Equivalent ownership documented | 19 | Script-lock transaction boundary for retry-safe operations |
| `28_AuditLogger.gs` | Equivalent ownership documented | 07 | Generic audit sink abstraction |
| `29_DbClient.gs` | Equivalent ownership documented | 12 | Table registration/repository lookup/transaction wrapper |
| `30_SheetDb.gs` | Equivalent ownership documented | 12 | Public SheetDb bootstrap/export surface |
| `33_SecurityService.gs` | Equivalent ownership documented | 04 | Alternative security verification/sanitization facade |
| `33_WorkflowEngine.gs` | Equivalent ownership documented | 06 | Workflow step orchestration engine |
| `34_ErrorService.gs` | Equivalent ownership documented | 20 | Structured error envelope creator |
| `35_RepositoryLayer.gs` | Equivalent ownership documented | 12 | Domain repository wrappers over table layer |
| `36_DbAdapter.gs` | Equivalent ownership documented | 12 | Adapter abstraction for DB integration |

## 3) Machine-reviewable contract

Contract test: `tests/traceability_contract_test.py`

The test validates that:
1. every canonical module `00`–`21` appears **exactly once**;
2. every mandatory canonical responsibility is present exactly once (by module ID);
3. every drifted file in range `22_*.gs`–`36_*.gs` appears **exactly once** in explicit equivalence mapping;
4. all drifted files map to a valid canonical module in `00`–`21`.

## 4) Cross-references

- Skill-level ownership and trigger controls: `docs/skills_registry.md`.
- Milestone acceptance/evidence ledger (M6–M10): `docs/milestone_trace_matrix.md`.
- Runtime architectural invariants and enforcement rules: `docs/architecture_guardrails.md`.
- Canonical schema/table contract for owner modules: `docs/schema_contract.md`.
