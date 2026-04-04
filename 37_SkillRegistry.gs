var SkillRegistry = {
  // Operational skills are the canonical architecture record for skill-first execution.
  operationalSkills: [
    {
      id: 'SKILL-ENROLLMENT-001',
      name: 'Enrollment Orchestration',
      triggers: ['/learn', 'workflow_webhook:lms_onboarding'],
      ownerModules: ['09_LmsEnrollmentService.gs', '03_SlackService.gs', '05_AppSheetWebhook.gs'],
      inputs: ['slackUserId', 'email', 'name', 'courseId'],
      outputs: ['learnerId', 'enrollmentId', 'queueId', 'correlationId'],
      guardrails: ['sanitize_input', 'require_slack_user_id', 'active_state_only']
    },
    {
      id: 'SKILL-SUBMISSION-001',
      name: 'Submission Completion',
      triggers: ['/submit', 'interactive:submit_lesson'],
      ownerModules: ['13a_LmsCompletionService.gs', '03_SlackService.gs'],
      inputs: ['slackUserId', 'lessonId', 'payload'],
      outputs: ['submissionId', 'learnerId', 'correlationId', 'nextLessonQueueStatus'],
      guardrails: ['state_transition_validation', 'idempotent_submit_key', 'learner_must_exist']
    },
    {
      id: 'SKILL-DELIVERY-001',
      name: 'Lesson Delivery',
      triggers: ['/lesson', '/mix', 'scheduler:delivery_queue'],
      ownerModules: ['12_LmsLessonService.gs', '14_Scheduler.gs'],
      inputs: ['learnerId', 'lessonId', 'deliveryChannel'],
      outputs: ['deliveryStatus', 'progressState', 'correlationId'],
      guardrails: ['qa_gate_before_delivery', 'queue_deduplication', 'retryable_error_handling']
    },
    {
      id: 'SKILL-REPORTING-001',
      name: 'Reporting & Audit Summaries',
      triggers: ['/progress', '/gaps', '/audit', 'admin_dashboard_generation'],
      ownerModules: ['ReportService.gs', '03_SlackService.gs'],
      inputs: ['slackUserId', 'timeRange', 'actor', 'resourceFilters'],
      outputs: ['dashboardTotals', 'overdueItems', 'auditPreview'],
      guardrails: ['offboarded_learners_excluded', 'read_only_analytics', 'filtered_audit_projection']
    },
    {
      id: 'SKILL-OFFBOARDING-001',
      name: 'Learner Offboarding',
      triggers: ['/offboard', 'manual_admin_offboard'],
      ownerModules: ['11_OnboardingService.gs', '03_SlackService.gs'],
      inputs: ['learnerId|slackUserId|email', 'requestorUserId', 'source'],
      outputs: ['learnerId', 'cancelledQueueItems', 'offboardResultCode'],
      guardrails: ['status_transition_to_offboarded', 'cancel_future_queue_items_only', 'audit_mandatory']
    }
  ],

  // Workflow action -> skill ID traceability map used by tests and runtime annotations.
  workflowActionSkills: {
    enrollment: 'SKILL-ENROLLMENT-001',
    submission: 'SKILL-SUBMISSION-001',
    delivery: 'SKILL-DELIVERY-001',
    reporting: 'SKILL-REPORTING-001',
    offboarding: 'SKILL-OFFBOARDING-001'
  },

  listSkillIds: function() {
    return this.operationalSkills.map(function(skill) { return skill.id; });
  }
};
