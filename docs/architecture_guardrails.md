# Architecture Guardrails (Execution Contract)

This document captures the non-negotiable runtime guardrails for the Slack LMS host.

## 1) Queue-first progression

All learner progression side-effects are queue-first:

- Enrollment schedules first lesson work into `delivery_queue` (`09_LmsEnrollmentService.gs#_queueFirstLesson`).
- Delivery execution drains queue work in controlled scheduler/service paths (`14_Scheduler.gs#runDailyLessonDelivery`, `12_LmsLessonService.gs#deliverPendingLessons`).
- Recoverable failures route through `retry_queue` for delayed retries (`18_RetryResolver.gs`).

**Guardrail:** do not bypass queue tables for direct send/progression writes in command handlers.

## 2) Database-truth (sheets as system of record)

Google Sheets tables are the runtime source of truth for learner/enrollment/progress/submission/queue/audit state.

- Canonical contract: `08_DbSchema.gs#DbSchema.CONTRACT`.
- Host registration: `00_WebAppEntry.gs#createHostDbClient`.
- Contract documentation: `docs/schema_contract.md`.

**Guardrail:** in-memory/request payload state is advisory only; authoritative decisions must re-read persisted records.

## 3) GAS write ownership boundaries

Mutations are restricted to service owners:

- Enrollment lifecycle writes: `09_LmsEnrollmentService.gs`.
- Submission + progression writes: `13a_LmsCompletionService.gs`.
- Delivery queue + send outcomes: `12_LmsLessonService.gs`.
- Offboarding writes/cancellations: `11_OnboardingService.gs`.
- Reporting (`ReportService.gs`) is read-only.

**Guardrail:** cross-domain mutation must call owning service, not write tables directly from unrelated modules.

## 4) Event-driven progression

Progression is driven by events/commands, not polling mutations:

- Slack slash/event/interactivity ingress enters via router/service (`01_SlackRouter.gs`, `03_SlackService.gs`).
- Workflow webhook ingress enters via `05_AppSheetWebhook.gs`.
- Scheduler jobs drive time-based events (`14_Scheduler.gs`).

**Guardrail:** every progression-causing event must emit correlation metadata and an audit entry.

## 5) Two-engine boundaries

The system is split into two explicit engines:

1. **Workflow execution engine** (`33_WorkflowEngine.gs`) for step orchestration (`validate`, `process`, `persist`, `respond`, `audit`).
2. **State transition engine** (`13_LearnerProgressStateMachine.gs`) for legal learner state transitions.

**Guardrail:** state legality decisions must be delegated to the state machine; workflow engine must not encode ad-hoc transition rules.

## 6) Idempotency and replay safety

- Submission path uses deterministic keys (`submitKey`) to prevent duplicate completion writes.
- Queue and retry jobs are processed with attempt/state tracking (`delivery_queue.attempts`, `retry_queue.attempts/status`).
- Webhook/command retries must produce no duplicate durable side-effects for the same idempotency key.

**Guardrail:** handlers must check existing durable artifacts (submission/queue/audit records) before creating new ones on retried payloads.

## 7) Security and audit guardrails

- Request authenticity is verified in security layer (`04_SlackSecurity.gs`, `33_SecurityService.gs`).
- Audit log is append-only by policy (`docs/schema_contract.md` + repository enforcement utilities).
- Error handling must normalize operational failures into structured envelopes (`34_ErrorService.gs`, `20_Errors.gs`) without leaking secrets.

**Guardrail:** no unauthenticated ingress path may mutate state; all mutation paths must append auditable metadata (`actor`, `action`, `resource`, `correlationId`).

## 8) Review protocol

A guardrail review is complete only when:

1. Skill mapping is present (`37_SkillRegistry.gs`, `docs/skills_registry.md`).
2. Schema contract checks pass (`runSchemaContractTests` / `docs/schema_contract.md`).
3. Traceability tests pass (`tests/traceability_contract_test.py`).
4. Deployment smoke runs exercise slash, event, webhook, and scheduler paths.
