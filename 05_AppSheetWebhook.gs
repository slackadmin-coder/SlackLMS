/**
 * AppSheet webhook contract handler.
 * All inbound AppSheet actions arrive here after token verification in the router.
 */
var AppSheetWebhook = {
  verifyToken: function(parsed, config) {
    var expected = String(config.appsheetWebhookToken || '');
    if (!expected) {
      return { ok: false, code: 'APPSHEET_TOKEN_NOT_CONFIGURED', message: 'AppSheet webhook token not set in script properties.' };
    }
    var supplied = String(
      (parsed.body && parsed.body.appsheet_token) ||
      (parsed.params && parsed.params.appsheet_token) || ''
    );
    if (!supplied || supplied !== expected) {
      return { ok: false, code: 'APPSHEET_TOKEN_INVALID', message: 'AppSheet webhook token mismatch.' };
    }
    return { ok: true, code: 'OK', message: 'AppSheet token verified.' };
  },

  route: function(action, payload, deps) {
    if (action === 'enroll_learner') {
      return deps.enrollmentService.enrollLearner({
        slackUserId: payload.slackUserId || '',
        email: payload.email || '',
        name: payload.name || '',
        courseId: payload.courseId || deps.config.defaultCourseId
      });
    }
    if (action === 'send_reminder') {
      return deps.reminderService.sendReminderForLearner(payload.learnerId || '');
    }
    if (action === 'archive_learner') {
      return { ok: false, code: 'NOT_IMPLEMENTED', message: 'archive_learner not yet implemented.' };
    }
    return { ok: false, code: 'UNKNOWN_ACTION', message: 'Unrecognised AppSheet action: ' + action };
  }
};
