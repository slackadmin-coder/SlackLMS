/**
 * Handles normalized workflow webhook events.
 */
class WorkflowWebhookHandlers {
  /**
   * @param {LmsEnrollmentService} enrollmentService
   * @param {LmsAutomationService} automationService
   */
  constructor(enrollmentService, automationService) {
    this._enrollment = enrollmentService;
    this._automation = automationService;
  }

  /**
   * @param {Object} context
   * @param {Object} payload
   * @return {Object}
   */
  handle(context, payload) {
    if (payload.eventType === 'enrollment_requested') {
      return this._enrollment.upsertFromWorkflow(context, payload);
    }
    return this._automation.upsertAutomation(context, payload);
  }
}
