# Wave 1 Requirement Traceability Matrix

This document maps each Wave 1 requirement group to implementation modules, verification tests, and explicit coverage for schema, state machine, workflow queueing, and test harness obligations.

## Requirement Group Mapping

| Wave 1 Requirement ID | Requirement Group | Implementing files/modules | Verification tests (function names) |
|---|---|---|---|
| **W1-SCHEMA** | Runtime schema registration and table contracts | `00_WebAppEntry.gs` (`createHostDbClient`, schema registration), `08_DbSchema.gs` (table constants), `25_SchemaRegistry.gs`, `29_DbClient.gs`, `26_TableRepository.gs` | `hostTest_fakeSlashLearn`, `hostTest_fakeSlashSubmit`, `hostTest_workflowWebhookEnroll`, `hostTest_fakeSlashAudit` |
| **W1-STATE** | Learner progress state machine canonicalization and transitions | `13_LearnerProgressStateMachine.gs` (`normalizeState`, `transition`, `migrateLegacyStatesInDb`), `13a_LmsCompletionService.gs` (`advanceLessonState`), `09_LmsEnrollmentService.gs` (`_queueFirstLesson`) | `hostTest_fakeSlashSubmit`, `hostTest_duplicateSubmissionEdgeCase`, `hostTest_missingLearnerEdgeCase` |
| **W1-QUEUE** | Workflow queueing for lesson delivery and retry processing | `09_LmsEnrollmentService.gs` (`_queueFirstLesson`), `13a_LmsCompletionService.gs` (`queueNextLesson`), `18_RetryResolver.gs` (`enqueue`, `resolveDue`, `markAttempt`), `11_OnboardingService.gs` (queue cancellation during offboarding) | `hostTest_workflowWebhookEnroll`, `hostTest_fakeSlashSubmit`, `hostTest_fakeSlashMix`, `hostTest_fakeSlashReinforce`, `hostTest_fakeSlashOffboard` |
| **W1-HARNESS** | Host test harness coverage for end-to-end command/workflow routes | `19_HostTestHarness.gs` (all hostTest entrypoints), `code.gs` (`doPost` ingress), `01_SlackRouter.gs`, `03_SlackService.gs` | `hostTest_fakeSlashLearn`, `hostTest_fakeSlashSubmit`, `hostTest_fakeSlashProgress`, `hostTest_workflowWebhookEnroll`, `hostTest_fakeInteractive`, `hostTest_fakeAppMention`, `hostTest_fakeMessageIm`, `hostTest_invalidPayloadEdgeCase` |

---

## Coverage Section: Schema Requirements (W1-SCHEMA)

- **Registration source of truth:** `createHostDbClient()` registers all host tables via `db.schema(...)` and initializes dependencies against that contract.
- **Schema-backed repositories:** the repository and SheetDb layers enforce column order/field normalization during CRUD.
- **Host + library alignment:** `08_DbSchema.gs` constants reflect queue/audit/onboarding table names used by services and workflows.

## Coverage Section: State Machine Requirements (W1-STATE)

- **Canonical states:** learner progress is normalized into canonical values (`not_started`, `in_progress`, `submitted`, `completed`).
- **Transition guardrails:** state transitions are constrained through allowed transition maps.
- **Legacy migration path:** legacy states (`queued`, `delivered`, `started`, `overdue`) are normalized and migrated in-db via `migrateLegacyStatesInDb`.

## Coverage Section: Workflow Queueing Requirements (W1-QUEUE)

- **Delivery queue writes:** onboarding/enrollment and submission completion paths insert rows into `delivery_queue` for next-lesson orchestration.
- **Retry queue operations:** retry resolver manages insertion, due-item lookup, and attempt/status updates in `retry_queue`.
- **Queue lifecycle controls:** offboarding cleanup explicitly cancels pending delivery/retry items tied to a learner.

## Coverage Section: Test Harness Requirements (W1-HARNESS)

- **Command-route harness tests:** slash-command harness functions exercise learning, submission, progress, and admin flows through the full host router path.
- **Workflow harness tests:** webhook harness functions validate workflow ingestion and enrollment automation route behavior.
- **Edge-case harness tests:** invalid payload, duplicate submission, and missing learner helpers provide deterministic regression checks for safety paths.

## Notes for Auditability

- Requirement IDs in this matrix are the Wave 1 group IDs used for implementation traceability: `W1-SCHEMA`, `W1-STATE`, `W1-QUEUE`, `W1-HARNESS`.
- Verification tests are listed by callable Apps Script harness function name to simplify manual and scripted audit execution.
