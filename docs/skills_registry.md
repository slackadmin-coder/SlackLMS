# Skills Registry (Operational Contract)

This registry is the source of truth for operational LMS skills and their runtime controls.

## Skill inventory

| Skill ID | Owning modules/functions | Trigger inputs | Primary outputs | Runtime controls (must hold) |
|---|---|---|---|---|
| `SKILL-ENROLLMENT-001` | `09_LmsEnrollmentService.gs#enrollLearner`, `09_LmsEnrollmentService.gs#_queueFirstLesson`, `03_SlackService.gs#handleSlashCommand`, `05_AppSheetWebhook.gs#route` | Slack slash `/learn`; workflow action `lms_onboarding`; payload fields `slackUserId`, `email`, `name`, optional `courseId` | `learnerId`, `enrollmentId`, `firstQueueId`, `correlationId`, user-facing onboarding message | 1) canonical learner lookup by `slackUserId`/`email`; 2) queue-first pattern (delivery via `delivery_queue`, not direct send); 3) audit append on enroll start/success/failure; 4) idempotent re-entry on existing active enrollment |
| `SKILL-SUBMISSION-001` | `13a_LmsCompletionService.gs#handleSubmit`, `13a_LmsCompletionService.gs#advanceLessonState`, `13a_LmsCompletionService.gs#queueNextLesson`, `03_SlackService.gs#handleSlashCommand` | Slack slash `/submit`; interactivity action `submit_lesson`; payload fields `slackUserId`, `lessonId`, `submitKey`, `payload` | `submissionId`, `learnerProgressState`, `nextQueueId` (if created), `correlationId` | 1) submission idempotency by `submitKey`; 2) transition legality delegated to state machine; 3) write path must persist `submission_log` before progression side-effects; 4) audit append for completion event |
| `SKILL-DELIVERY-001` | `12_LmsLessonService.gs#handleLesson`, `12_LmsLessonService.gs#deliverPendingLessons`, `14_Scheduler.gs#runDailyLessonDelivery` | Slack slash `/lesson` and `/mix`; scheduler jobs over `delivery_queue`; payload fields `learnerId`, `lessonId`, `deliveryChannel`, `runAt` | delivery status (`queued`/`sent`/`retry`), attempt count, `learner_progress` updates, `correlationId` | 1) queue processor owns send attempt cadence; 2) QA gate (`qaStatus`) required before outbound delivery; 3) retry route via `retry_queue`; 4) no direct learner state mutation outside state machine path |
| `SKILL-REPORTING-001` | `ReportService.gs#buildProgressReport`, `ReportService.gs#buildGapsReport`, `ReportService.gs#buildAuditReport`, `03_SlackService.gs#handleSlashCommand` | Slack slash `/progress`, `/gaps`, `/audit`; admin/reporting triggers; payload includes `slackUserId`, filter windows, actor/resource predicates | report payloads (summary cards, totals, gaps, audit slices), `correlationId` | 1) reporting path is read-only over runtime tables; 2) exclude offboarded learners from active KPIs; 3) enforce caller role check for audit/gaps views; 4) annotate report metadata with source filters |
| `SKILL-OFFBOARDING-001` | `11_OnboardingService.gs#offboardLearner`, `03_SlackService.gs#handleSlashCommand` | Slack slash `/offboard`; admin action with `learnerId` or `email`, `requestorUserId`, `source` | offboarding decision (`success`/`noop`), canceled future queue items, `correlationId`, audit event id | 1) transition allowed only from active lifecycle states; 2) cancel future queue work only (`runAt > now`); 3) preserve historical submission/audit records; 4) mandatory audit append containing requestor and source |

## Registry controls and traceability

- Canonical runtime registry lives in `37_SkillRegistry.gs` (`SkillRegistry.SKILLS` and `SkillRegistry.workflowActionSkills`).
- Workflow actions `enrollment`, `submission`, `delivery`, `reporting`, and `offboarding` must map to exactly one valid skill ID.
- Test enforcement is in `19_HostTestHarness.gs#runTraceabilityTests`; missing/unknown mappings are test failures.
- Every operational skill execution must emit a `correlationId` for audit and retry triage.

## Review checklist

Use this list during review:

1. Skill ID exists in `37_SkillRegistry.gs` and this document.
2. The owning functions listed above are present and callable.
3. At least one automated test path covers the trigger shape.
4. Guardrails are represented in persistence, state transition, and audit behavior.
