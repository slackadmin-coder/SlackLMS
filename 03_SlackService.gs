/**
 * Slack dispatch layer for slash/event/interactivity registries.
 */
class SlackService {
  constructor(services, blocks, config, securityService, configRepo) {
    this._lesson = services.lessonService;
    this._completion = services.completionService;
    this._progress = services.progressService;
    this._enrollment = services.enrollmentService;
    this._report = services.reportService;
    this._onboarding = services.onboardingService;
    this._blocks = blocks;
    this._config = config || {};
    this._security = securityService || SecurityService;
    this._configRepo = configRepo;
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
    var action = (payload.actions && payload.actions[0]) || {};
    var actionId = action.action_id || '';
    var type = payload.type || '';

    if (type === 'view_submission') {
      return this._handleModalSubmission(payload);
    }

    if (actionId.indexOf('checklist_mark_') === 0) {
      var checklistItemId = actionId.replace('checklist_mark_', '');
      var learnerId = payload.user && payload.user.id;
      var status = (action.value || 'completed');
      var advanced = this._onboarding.advanceOnboardingState(learnerId, checklistItemId, status);
      return { response_type: 'ephemeral', text: advanced.ok ? ':white_check_mark: Checklist updated.' : (advanced.message || 'Checklist update failed.') };
    }

    if (actionId === 'submit_lesson') {
      var lessonId = this._security.sanitizeInput(action.value || '');
      var submit = this._completion.recordSubmission({
        slackUserId: parsed.userId,
        lessonId: lessonId,
        payload: JSON.stringify(payload)
      });
      return { response_type: 'ephemeral', text: submit.ok ? ':white_check_mark: Lesson submitted.' : (submit.message || submit.error_code) };
    }

    return { response_type: 'ephemeral', text: 'Action received. Use /help to see supported actions.' };
  }

  handleEventCallback(parsed) {
    var event = (parsed.body && parsed.body.event) ? parsed.body.event : {};
    if (event.type === 'app_mention') {
      return {
        ok: true,
        text: 'Hi! Try `/learn`, `/submit <lesson_id> complete`, `/progress`, `/report`, `/onboard email@company.com`, or `/help`.'
      };
    }
    if (event.type === 'message' && event.channel_type === 'im') {
      return this._handleDm(event);
    }
    return { ok: true, text: 'Event ignored', eventType: event.type || '' };
  }

  handleWorkflowWebhook(parsed) {
    var data = (parsed.body && parsed.body.data) || {};
    var slackUserId = this._security.sanitizeInput(data.user_id || parsed.params.user_id || '');
    var email = this._security.sanitizeInput(data.email || parsed.params.email || '');
    var name = this._security.sanitizeInput(data.name || parsed.params.name || '');
    var courseId = this._security.sanitizeInput(data.course_id || parsed.params.course_id || this._config.defaultCourseId || 'C001');

    if (!slackUserId) {
      return ErrorService.create('INVALID_WORKFLOW_PAYLOAD', 'Missing user_id in workflow payload', false);
    }

    return this._enrollment.enrollLearner({
      slackUserId: slackUserId,
      email: email,
      name: name,
      courseId: courseId
    });
  }

  _handleHelp() {
    return { response_type: 'ephemeral', text: 'Commands: /learn, /submit <lesson_id> complete, /progress, /report, /onboard [email], /enroll [courseId]' };
  }

  _handleEnroll(parsed) {
    return this._enrollment.enrollLearner({
      slackUserId: parsed.userId,
      courseId: this._security.sanitizeInput(parsed.params.text || '') || this._config.defaultCourseId
    });
  }

  _handleOnboard(parsed) {
    var adminIds = this._config.adminUserIds || [];
    if (adminIds.indexOf(parsed.userId) === -1) {
      return { response_type: 'ephemeral', text: ':lock: /onboard is restricted to admins.' };
    }
    var email = this._security.sanitizeInput((parsed.params && parsed.params.text) || '');
    if (!email) {
      return { response_type: 'ephemeral', text: 'Usage: /onboard [email]' };
    }

    if (this._configRepo && !this._configRepo.getFlag('enable_onboarding', true)) {
      return { response_type: 'ephemeral', text: ':warning: Onboarding feature flag is disabled.' };
    }

    return this._onboarding.startOnboarding({
      requestorUserId: parsed.userId,
      targetEmail: email,
      source: 'slash_command'
    });
  }

  _handleReport(parsed) {
    if (this._configRepo && !this._configRepo.getFlag('enable_reporting', true)) {
      return { response_type: 'ephemeral', text: ':warning: Reporting feature flag is disabled.' };
    }
    var dashboard = this._report.buildAdminDashboard(parsed && parsed.userId);
    return { response_type: 'ephemeral', text: 'Admin report', blocks: this._blocks.buildAdminSummary(dashboard) };
  }

  _handleDm(event) {
    var text = String(event.text || '').toLowerCase();
    if (text.indexOf('progress') !== -1) {
      return { ok: true, text: 'Use `/progress` for your learner snapshot.' };
    }
    if (text.indexOf('help') !== -1) {
      return { ok: true, text: 'Need help? Try `/help` for all commands.' };
    }
    return { ok: true, text: 'Welcome! Use `/learn` to get your current lesson, or `/help` for all commands.' };
  }

  _handleModalSubmission(payload) {
    var values = (payload.view && payload.view.state && payload.view.state.values) || {};
    var lessonValue = this._extractModalValue(values, 'lesson', 'lesson_id');
    var notesValue = this._extractModalValue(values, 'notes', 'notes_value');
    var learnerId = payload.user && payload.user.id;

    var persisted = this._completion.recordSubmission({
      slackUserId: learnerId,
      lessonId: lessonValue,
      payload: JSON.stringify({ notes: notesValue, source: 'modal_submission' })
    });

    if (!persisted.ok) {
      return {
        response_action: 'errors',
        errors: { lesson: persisted.message || 'Unable to submit lesson.' }
      };
    }

    return { response_action: 'clear' };
  }

  _extractModalValue(values, blockId, actionId) {
    if (!values[blockId] || !values[blockId][actionId]) return '';
    return this._security.sanitizeInput(values[blockId][actionId].value || '');
  }
}
