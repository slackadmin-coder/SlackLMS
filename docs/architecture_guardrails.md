# Architecture Guardrails

## 1) Two-engine separation

The platform is intentionally split into two engines with explicit boundaries:

1. **Workflow execution engine** (`33_WorkflowEngine.gs` + services)
   - Runs request lifecycle steps (`validate`, `process`, `persist`, `respond`, `audit`).
   - Owns correlation IDs and error normalization for operational flows.
2. **State transition engine** (`13_LearnerProgressStateMachine.gs`)
   - Owns learner progress state transition legality.
   - Must remain independent of transport, Slack payload format, and reporting concerns.

**Guardrail:** workflow handlers must call the state machine for progression changes rather than mutating state directly when transition rules apply.

## 2) State ownership

State ownership is single-writer by concern:

- `LmsEnrollmentService` owns enrollment initialization and first-lesson queueing.
- `LmsCompletionService` owns submission log writes and submission/completion transitions.
- `LmsLessonService` owns delivery queue mutation and lesson dispatch outcomes.
- `ReportService` is read-only over runtime tables and must not mutate learner lifecycle state.
- `OnboardingService.offboardLearner` owns offboarding lifecycle transitions and queue cancellation.

**Guardrail:** cross-service writes should occur only through the owning service path, with audit metadata including `skillId`.

## 3) Skill-first constraints

All major workflow actions must be traceable to an operational skill ID before execution and during audit:

- Canonical registry: `37_SkillRegistry.gs` and `docs/skills_registry.md`.
- Required actions: `enrollment`, `submission`, `delivery`, `reporting`, `offboarding`.
- Each required action must map to exactly one registered skill ID.

**Guardrail:** tests in `runTraceabilityTests` fail if an action lacks a mapping or references an unregistered skill ID.
