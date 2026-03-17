/**
 * Slack dispatch layer for slash/event/interactivity registries.
 */
class SlackService {
  constructor(lessonService, completionService, progressService, enrollmentService, reportService, blocks) {
    this._lesson = lessonService;
    this._completion = completionService;
    this._progress = progressService;
    this._enrollment = enrollmentService;
    this._report = reportService;
    this._blocks = blocks;
    this._slashRegistry = {
      '/lesson': this._lesson.handleLesson.bind(this._lesson),
      '/submit': this._completion.handleSubmit.bind(this._completion),
      '/progress': this._progress.handleProgress.bind(this._progress),
      '/help': this._handleHelp.bind(this),
      '/enroll': this._handleEnroll.bind(this),
      '/report': this._handleReport.bind(this)
    };
  }

  handleSlashCommand(parsed) {
    if (!parsed || !parsed.command) {
      return { response_type: 'ephemeral', text: 'Missing slash command context.' };
    }
    var handler = this._slashRegistry[parsed.command];
    if (!handler) return { response_type: 'ephemeral', text: 'Unsupported command: ' + parsed.command };
    return handler(parsed);
  }

  handleInteractivity(parsed) {
    var payload = parsed.interaction || {};
    var actionId = (payload.actions && payload.actions[0] && payload.actions[0].action_id) || '';
    var callbackId = payload.callback_id || '';
    var type = payload.type || '';

    if (type === 'view_submission') {
      return { response_action: 'clear' };
    }
    if (actionId || callbackId) {
      return { response_type: 'ephemeral', text: 'Interactive action received.' };
    }
    return { response_type: 'ephemeral', text: 'Unsupported interactive payload.' };
  }

  handleEventCallback(parsed) {
    var event = (parsed.body && parsed.body.event) ? parsed.body.event : {};
    if (event.type === 'app_mention') {
      return { ok: true, text: 'Thanks for the mention. Try /lesson, /submit, or /progress.' };
    }
    if (event.type === 'message' && event.channel_type === 'im') {
      return { ok: true, text: 'DM received. Use /lesson to get started.' };
    }
    return { ok: true, text: 'Event ignored', eventType: event.type || '' };
  }

  handleWorkflowWebhook(parsed) {
    return { ok: true, text: 'Workflow webhook received', payloadType: parsed.payloadType };
  }

  _handleHelp() {
    return { response_type: 'ephemeral', text: 'Commands: /lesson, /submit <lessonId>, /progress' };
  }

  _handleEnroll(parsed) {
    return this._enrollment.enrollLearner({
      slackUserId: parsed.userId,
      courseId: parsed.params.text || ''
    });
  }

  _handleReport() {
    var summary = this._report.buildWeeklySummary();
    return { response_type: 'ephemeral', text: 'Weekly summary', blocks: this._blocks.buildAdminSummary(summary) };
  }
}
