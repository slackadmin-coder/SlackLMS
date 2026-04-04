# Skills Registry

This registry is the source of truth for operational LMS skills and their architectural guardrails.

| Skill ID | Skill name | Trigger(s) | Owner module(s) | Inputs | Outputs | Guardrails |
|---|---|---|---|---|---|---|
| `SKILL-ENROLLMENT-001` | Enrollment Orchestration | `/learn`; `workflow_webhook:lms_onboarding` | `09_LmsEnrollmentService.gs`, `03_SlackService.gs`, `05_AppSheetWebhook.gs` | `slackUserId`, `email`, `name`, `courseId` | `learnerId`, `enrollmentId`, `queueId`, `correlationId` | sanitize input; require `slackUserId`; only active enrollment state |
| `SKILL-SUBMISSION-001` | Submission Completion | `/submit`; `interactive:submit_lesson` | `13a_LmsCompletionService.gs`, `03_SlackService.gs` | `slackUserId`, `lessonId`, `payload` | `submissionId`, `learnerId`, `correlationId`, next lesson queue status | state transition validation; idempotent `submitKey`; learner existence required |
| `SKILL-DELIVERY-001` | Lesson Delivery | `/lesson`; `/mix`; `scheduler:delivery_queue` | `12_LmsLessonService.gs`, `14_Scheduler.gs` | `learnerId`, `lessonId`, `deliveryChannel` | delivery status, progress state, `correlationId` | QA gate before delivery; queue dedupe; retry-safe failures |
| `SKILL-REPORTING-001` | Reporting & Audit Summaries | `/progress`; `/gaps`; `/audit`; admin dashboard generation | `ReportService.gs`, `03_SlackService.gs` | `slackUserId`, date filters, actor/resource filters | dashboard totals, overdue summary, audit preview | offboarded learners excluded; read-only analytics; filtered audit projection |
| `SKILL-OFFBOARDING-001` | Learner Offboarding | `/offboard`; manual admin offboarding | `11_OnboardingService.gs`, `03_SlackService.gs` | `learnerId` \| `slackUserId` \| `email`, `requestorUserId`, `source` | `learnerId`, cancelled queue count, offboard status code | state transition to offboarded; cancel only future queue work; mandatory audit event |

## Enforcement contract

- Runtime mapping is defined in `37_SkillRegistry.gs` (`SkillRegistry.workflowActionSkills`).
- Trace tests in `19_HostTestHarness.gs` fail if a workflow action (`enrollment`, `submission`, `delivery`, `reporting`, `offboarding`) is missing from the map or references an unknown skill ID.
- Service implementations attach the resolved `skillId` to response payloads and/or audit metadata for execution traceability.
