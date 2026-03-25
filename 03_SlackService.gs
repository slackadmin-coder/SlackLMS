/**
 * Slack dispatch layer for slash/event/interactivity registries.
 */
class SlackService {
  constructor(lessonService, completionService, progressService, enrollmentService, reportService, blocks, onboardingService, config) {
    this._lesson = lessonService;
    this._completion = completionService;
    this._progress = progressService;
    this._enrollment = enrollmentService;
    this._report = reportService;
    this._blocks = blocks;
    this._onboarding = onboardingService;
    this._config = config || {};
    this._slashRegistry = {
      '/learn': this._lesson.handleLesson.bind(this._lesson),
      '/submit': this._completion.handleSubmit.bind(this._completion),
      '/progress': this._progress.handleProgress.bind(this._progress),
      '/help': this._handleHelp.bind(this),
      '/enroll': this._handleEnroll.bind(this),
      '/report': this._handleReport.bind(this),
      '/onboard': this._handleOnboard.bind(this)
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
    var type = payload.type || '';

    if (type === 'view_submission') {
      return { response_action: 'clear' };
    }

    if (actionId === 'start_preonboarding_form') {
      return { response_type: 'ephemeral', text: ':clipboard: Pre-onboarding form is being set up. Your coordinator will reach out shortly.' };
    }

    if (actionId.indexOf('open_checklist_') === 0) {
      var checklistName = actionId.replace('open_checklist_', '').replace(/_/g, ' ');
      return { response_type: 'ephemeral', text: ':clipboard: Opening checklist: *' + checklistName + '*. See your canvas in this DM.' };
    }

    if (actionId === 'submit_lesson') {
      return { response_type: 'ephemeral', text: 'Use `/submit <lesson_id> complete` to record your completion.' };
    }

    return { response_type: 'ephemeral', text: 'Action received. Use a slash command if you need help: `/help`' };
  }

  handleEventCallback(parsed) {
    var event = (parsed.body && parsed.body.event) ? parsed.body.event : {};
    if (event.type === 'app_mention') {
      return { ok: true, text: 'Thanks for the mention. Try /learn, /submit, or /progress.' };
    }
    if (event.type === 'message' && event.channel_type === 'im') {
      return { ok: true, text: 'DM received. Use /learn to get started.' };
    }
    return { ok: true, text: 'Event ignored', eventType: event.type || '' };
  }

  handleWorkflowWebhook(parsed) {
    var data = (parsed.body && parsed.body.data) || {};
    var slackUserId = data.user_id || parsed.params.user_id || '';
    var email = data.email || parsed.params.email || '';
    var name = data.name || parsed.params.name || '';
    var courseId = data.course_id || parsed.params.course_id || this._config.defaultCourseId || 'C001';

    if (!slackUserId) {
      return { ok: false, error: 'Missing user_id in workflow payload' };
    }

    return this._enrollment.enrollLearner({
      slackUserId: slackUserId,
      email: email,
      name: name,
      courseId: courseId
    });
  }

  _handleHelp() {
    return { response_type: 'ephemeral', text: 'Commands: /learn, /submit <lesson_id> complete, /progress, /onboard [email]' };
  }

  _handleEnroll(parsed) {
    return this._enrollment.enrollLearner({
      slackUserId: parsed.userId,
      courseId: parsed.params.text || ''
    });
  }

  _handleOnboard(parsed) {
    var adminIds = this._config.adminUserIds || [];
    if (adminIds.indexOf(parsed.userId) === -1) {
      return { response_type: 'ephemeral', text: ':lock: /onboard is restricted to admins.' };
    }
    var email = String((parsed.params && parsed.params.text) || '').trim();
    if (!email) {
      return { response_type: 'ephemeral', text: 'Usage: /onboard [email]' };
    }
    if (!this._onboarding || !this._onboarding.startOnboarding) {
      return { response_type: 'ephemeral', text: ':construction: Onboarding triggered for ' + email + '. (Service coming in Phase 2.)' };
    }
    return this._onboarding.startOnboarding({
      requestorUserId: parsed.userId,
      targetEmail: email,
      source: 'slash_command'
    });
  }

  _handleReport() {
    var summary = this._report.buildWeeklySummary();
    return { response_type: 'ephemeral', text: 'Weekly summary', blocks: this._blocks.buildAdminSummary(summary) };
  }
}
