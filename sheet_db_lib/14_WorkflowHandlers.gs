/**
 * Workflow webhook handlers for LMS host-layer operations.
 */
class WorkflowHandlers {
  /**
   * @param {LmsEnrollmentService} enrollmentService
   */
  constructor(enrollmentService) {
    this._enrollmentService = enrollmentService;
  }

  /**
   * Dispatches a workflow webhook to handler methods.
   * @param {Object} context
   * @param {Object} payload
   * @return {Object}
   */
  handle(context, payload) {
    if (payload.eventType === 'enrollment_requested') {
      return this._handleEnrollmentRequested(context, payload);
    }

    return {
      ok: false,
      code: 'UNSUPPORTED_WORKFLOW_EVENT',
      message: 'No handler for workflow event: ' + payload.eventType,
      data: { workflow: payload.workflow }
    };
  }

  /**
   * Handles "enrollment_requested" workflow events.
   * @private
   * @param {Object} context
   * @param {Object} payload
   * @return {Object}
   */
  _handleEnrollmentRequested(context, payload) {
    return this._enrollmentService.enrollStudent({
      studentId: payload.studentId,
      courseId: payload.courseId,
      source: 'workflow_webhook',
      actorId: payload.actorId || context.actor,
      requestId: payload.requestId || context.requestId
    });
  }
}
