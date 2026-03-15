/**
 * Host-layer Slack service orchestrating slash and workflow request handling.
 */
class SlackService {
  /**
   * @param {LmsEnrollmentService} enrollmentService
   * @param {WorkflowHandlers} workflowHandlers
   * @param {DbClient} dbClient
   */
  constructor(enrollmentService, workflowHandlers, dbClient) {
    this._enrollmentService = enrollmentService;
    this._workflowHandlers = workflowHandlers;
    this._db = dbClient;
  }

  /**
   * Handles normalized slash command payloads.
   *
   * Example flow:
   * - command: /enroll-student
   * - text: "student-123 course-ENG101"
   *
   * @param {Object} context
   * @param {Object} payload
   * @return {Object}
   */
  handleSlashCommand(context, payload) {
    if (payload.command !== '/enroll-student') {
      return SlackService.failure(
        'UNSUPPORTED_COMMAND',
        'Unsupported slash command: ' + payload.command,
        context
      );
    }

    var args = payload.text.split(/\s+/).filter(function(v) { return !!v; });
    if (args.length < 2) {
      return SlackService.failure(
        'INVALID_ARGUMENTS',
        'Usage: /enroll-student <studentId> <courseId>',
        context
      );
    }

    var result = this._enrollmentService.enrollStudent({
      studentId: args[0],
      courseId: args[1],
      source: 'slash_command',
      actorId: payload.userId,
      requestId: context.requestId
    });

    return result.ok
      ? SlackService.success('Student enrolled successfully.', result.data, context)
      : SlackService.failure(result.code, result.message, context, result.data);
  }

  /**
   * Handles normalized workflow webhook payloads.
   *
   * Example flow:
   * - workflow: lms_enrollment
   * - eventType: enrollment_requested
   * - data: { studentId, courseId, actorId }
   *
   * @param {Object} context
   * @param {Object} payload
   * @return {Object}
   */
  handleWorkflowWebhook(context, payload) {
    var result = this._workflowHandlers.handle(context, payload);
    return result.ok
      ? SlackService.success('Workflow processed successfully.', result.data, context)
      : SlackService.failure(result.code, result.message, context, result.data);
  }

  /**
   * Structured success result.
   * @param {string} message
   * @param {Object=} data
   * @param {Object=} context
   * @return {Object}
   */
  static success(message, data, context) {
    return {
      ok: true,
      code: 'OK',
      message: message,
      requestId: (context && context.requestId) || '',
      data: data || {}
    };
  }

  /**
   * Structured failure result.
   * @param {string} code
   * @param {string} message
   * @param {Object=} context
   * @param {Object=} data
   * @return {Object}
   */
  static failure(code, message, context, data) {
    return {
      ok: false,
      code: code || 'ERROR',
      message: message || 'Unknown error.',
      requestId: (context && context.requestId) || '',
      data: data || {}
    };
  }

  /**
   * Example result payloads for host integrations.
   * @return {{success: Object, failure: Object}}
   */
  static getExampleResponses() {
    return {
      success: {
        ok: true,
        code: 'OK',
        message: 'Student enrolled successfully.',
        requestId: 'req_1700000000000_abcd1234',
        data: {
          enrollmentId: 'enrollments_1700000000000_efgh5678',
          studentId: 'student-123',
          courseId: 'course-ENG101',
          status: 'enrolled'
        }
      },
      failure: {
        ok: false,
        code: 'INVALID_ARGUMENTS',
        message: 'Usage: /enroll-student <studentId> <courseId>',
        requestId: 'req_1700000000000_abcd1234',
        data: {}
      }
    };
  }
}
