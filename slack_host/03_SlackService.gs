/**
 * Application service that orchestrates Slack routes into LMS services.
 */
class SlackService {
  /**
   * @param {LmsEnrollmentService} enrollmentService
   * @param {WorkflowWebhookHandlers} workflowHandlers
   * @param {ResultFormatter} resultFormatter
   */
  constructor(enrollmentService, workflowHandlers, resultFormatter) {
    this._enrollment = enrollmentService;
    this._workflow = workflowHandlers;
    this._results = resultFormatter;
  }

  /**
   * @param {Object} context
   * @param {Object} payload
   * @return {Object}
   */
  handleSlashCommand(context, payload) {
    if (payload.command === '/enroll-student') {
      var result = this._enrollment.enrollFromSlash(context, payload);
      return result.ok ? this._results.success(result.message, result.data, context)
        : this._results.failure(result.code, result.message, context, result.data);
    }

    return this._results.failure('UNSUPPORTED_COMMAND', 'Unsupported command: ' + payload.command, context, {});
  }

  /**
   * @param {Object} context
   * @param {Object} payload
   * @return {Object}
   */
  handleWorkflowWebhook(context, payload) {
    var result = this._workflow.handle(context, payload);
    return result.ok ? this._results.success(result.message, result.data, context)
      : this._results.failure(result.code, result.message, context, result.data);
  }
}
