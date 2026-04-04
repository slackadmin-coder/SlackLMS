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
    this._ingressQueue = services.ingressQueueService;
    this._blocks = blocks;
    this._config = config || {};
    this._security = securityService || SecurityService;
    this._configRepo = configRepo;
    this._slashRegistry = {
      '/learn': this._queueSlashLearn.bind(this),
      '/submit': this._queueSlashSubmit.bind(this),
      '/progress': this._progress.handleProgress.bind(this._progress),
      '/help': this._handleHelp.bind(this),
      '/enroll': this._queueSlashEnroll.bind(this),
      '/report': this._handleReport.bind(this),
      '/onboard': this._handleOnboard.bind(this),
      '/gaps': this._handleGaps.bind(this),
      '/audit': this._handleAudit.bind(this),
      '/mix': this._queueSlashMix.bind(this),
      '/reinforce': this._handleReinforce.bind(this),
      '/offboard': this._handleOffboard.bind(this)
    };
  }

  handleSlashCommand(parsed, requestContext) {
    if (!parsed || !parsed.command) {
      return { response_type: 'ephemeral', text: 'Missing slash command context.' };
    }
    var handler = this._slashRegistry[parsed.command];
    if (!handler) return { response_type: 'ephemeral', text: 'Unsupported command: ' + parsed.command };
    return handler(parsed, requestContext || {});
  }

  handleInteractivity(parsed, requestContext) {
    var payload = parsed.interaction || {};
    var action = (payload.actions && payload.actions[0]) || {};
    var actionId = action.action_id || '';
    var type = payload.type || '';

    if (type === 'view_submission') {
      var modalPayload = {
        slackUserId: payload.user && payload.user.id,
        lessonId: this._extractModalValue((payload.view && payload.view.state && payload.view.state.values) || {}, 'lesson', 'lesson_id'),
        payload: JSON.stringify({
          notes: this._extractModalValue((payload.view && payload.view.state && payload.view.state.values) || {}, 'notes', 'notes_value'),
          source: 'modal_submission'
        })
      };
      var modalQueued = this._enqueueIngressJob('interactivity', 'interactivity.modal_submission', modalPayload, parsed, requestContext || {});
      if (!modalQueued.ok) return { response_action: 'errors', errors: { lesson: modalQueued.message || 'Unable to queue submission.' } };
      return { response_action: 'clear' };
    }

    if (actionId.indexOf('checklist_mark_') === 0) {
      var checklistQueued = this._enqueueIngressJob('interactivity', 'interactivity.checklist_mark', {
        learnerId: payload.user && payload.user.id,
        checklistItemId: actionId.replace('checklist_mark_', ''),
        status: action.value || 'completed'
      }, parsed, requestContext || {});
      return {
        response_type: 'ephemeral',
        text: checklistQueued.ok ? ':hourglass_flowing_sand: Checklist update queued.' : (checklistQueued.message || 'Checklist update failed.')
      };
    }

    if (actionId === 'submit_lesson') {
      var submit = this._enqueueIngressJob('interactivity', 'interactivity.submit_lesson', {
        slackUserId: parsed.userId,
        lessonId: this._security.sanitizeInput(action.value || ''),
        payload: JSON.stringify(payload)
      }, parsed, requestContext || {});
      return { response_type: 'ephemeral', text: submit.ok ? ':hourglass_flowing_sand: Submission queued.' : (submit.message || submit.error_code) };
    }

    return { response_type: 'ephemeral', text: 'Action received. Use /help to see supported actions.' };
  }

  handleEventCallback(parsed, requestContext) {
    var event = (parsed.body && parsed.body.event) ? parsed.body.event : {};
    if (event.type === 'app_mention') {
      this._enqueueIngressJob('event_callback', 'event.app_mention', {
        userId: event.user || parsed.userId,
        channelId: event.channel || parsed.channelId,
        text: event.text || ''
      }, parsed, requestContext || {});
      return { ok: true, text: 'Event queued' };
    }
    if (event.type === 'message' && event.channel_type === 'im') {
      this._enqueueIngressJob('event_callback', 'event.message_im', {
        userId: event.user || parsed.userId,
        channelId: event.channel || parsed.channelId,
        text: event.text || ''
      }, parsed, requestContext || {});
      return { ok: true, text: 'Event queued' };
    }
    return { ok: true, text: 'Event ignored', eventType: event.type || '' };
  }

  handleWorkflowWebhook(parsed, requestContext) {
    var data = (parsed.body && parsed.body.data) || {};
    var slackUserId = this._security.sanitizeInput(data.user_id || parsed.params.user_id || '');
    var email = this._security.sanitizeInput(data.email || parsed.params.email || '');
    var name = this._security.sanitizeInput(data.name || parsed.params.name || '');
    var courseId = this._security.sanitizeInput(data.course_id || parsed.params.course_id || this._config.defaultCourseId || 'C001');

    if (!slackUserId) {
      return ErrorService.create('INVALID_WORKFLOW_PAYLOAD', 'Missing user_id in workflow payload', false);
    }

    var queued = this._enqueueIngressJob('workflow_webhook', 'workflow.enroll', {
      slackUserId: slackUserId,
      email: email,
      name: name,
      courseId: courseId
    }, parsed, requestContext || {});
    if (!queued.ok) return queued;
    return { ok: true, code: 'WORKFLOW_ENROLL_QUEUED', jobId: queued.jobId };
  }

  _handleHelp() {
    return { response_type: 'ephemeral', text: 'Commands: /learn, /submit <lesson_id> complete, /progress, /help, /enroll [courseId], /report, /onboard [email], /gaps, /audit, /mix, /reinforce, /offboard [email]' };
  }

  _queueSlashEnroll(parsed, requestContext) {
    var queued = this._enqueueIngressJob('slash_command', 'slash.enroll', {
      slackUserId: parsed.userId,
      courseId: this._security.sanitizeInput(parsed.params.text || '') || this._config.defaultCourseId
    }, parsed, requestContext || {});
    return queued.ok
      ? { response_type: 'ephemeral', text: 'Enrollment request queued. You will get a DM shortly.', job_id: queued.jobId }
      : { response_type: 'ephemeral', text: queued.message || queued.error_code || 'Unable to queue enrollment.' };
  }

  _handleOnboard(parsed) {
    var adminAccess = this._requireAdmin(parsed, '/onboard');
    if (adminAccess) return adminAccess;
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
    var adminAccess = this._requireAdmin(parsed, '/report');
    if (adminAccess) return adminAccess;
    if (this._configRepo && !this._configRepo.getFlag('enable_reporting', true)) {
      return { response_type: 'ephemeral', text: ':warning: Reporting feature flag is disabled.' };
    }
    var dashboard = this._report.buildAdminDashboard(parsed && parsed.userId);
    return { response_type: 'ephemeral', text: 'Admin report', blocks: this._blocks.buildAdminSummary(dashboard) };
  }

  _handleGaps(parsed) {
    return this._report.handleGaps(parsed);
  }

  _handleAudit(parsed) {
    var adminAccess = this._requireAdmin(parsed, '/audit');
    if (adminAccess) return adminAccess;
    return this._onboarding.handleAuditQuery(parsed);
  }

  _queueSlashMix(parsed, requestContext) {
    return this._queueSlashLearn(parsed, requestContext, 'slash.mix');
  }

  _handleReinforce(parsed) {
    return this._progress.handleReinforce(parsed);
  }

  _handleOffboard(parsed) {
    var adminAccess = this._requireAdmin(parsed, '/offboard');
    if (adminAccess) return adminAccess;
    return this._onboarding.handleOffboard(parsed);
  }

  _requireAdmin(parsed, commandName) {
    var adminIds = this._config.adminUserIds || [];
    if (adminIds.indexOf(parsed.userId) !== -1) return null;
    return { response_type: 'ephemeral', text: ':lock: ' + commandName + ' is restricted to admins.' };
  }

  _queueSlashLearn(parsed, requestContext, jobTypeOverride) {
    var queued = this._enqueueIngressJob('slash_command', jobTypeOverride || 'slash.learn', { userId: parsed.userId }, parsed, requestContext || {});
    return queued.ok
      ? { response_type: 'ephemeral', text: 'Queued your next lesson for delivery. You will receive it in DM shortly.', job_id: queued.jobId }
      : { response_type: 'ephemeral', text: queued.message || queued.error_code || 'Unable to queue lesson right now.' };
  }

  _queueSlashSubmit(parsed, requestContext) {
    var parts = String((parsed.params && parsed.params.text) || '').trim().split(/\s+/);
    var lessonId = this._security.sanitizeInput(parts[0] || '');
    var keyword = (parts[1] || '').toLowerCase();
    if (keyword !== 'complete' || !lessonId) {
      return { response_type: 'ephemeral', text: 'Usage: /submit <lesson_id> complete' };
    }

    var queued = this._enqueueIngressJob('slash_command', 'slash.submit', {
      slackUserId: parsed.userId,
      lessonId: lessonId,
      payload: parsed.rawBody
    }, parsed, requestContext || {});

    return queued.ok
      ? { response_type: 'ephemeral', text: 'Submission queued for ' + lessonId + '.', job_id: queued.jobId }
      : { response_type: 'ephemeral', text: queued.message || queued.error_code || 'Unable to queue submission.' };
  }

  _enqueueIngressJob(routeType, jobType, payload, parsed, requestContext) {
    if (!this._ingressQueue) {
      return ErrorService.create('INGRESS_QUEUE_UNAVAILABLE', 'Ingress queue service is unavailable.', true, (requestContext && requestContext.correlationId) || '');
    }
    var idempotencyKey = this._ingressQueue.generateIdempotencyKey(routeType, jobType, {
      payload: payload,
      teamId: parsed.teamId,
      channelId: parsed.channelId,
      userId: parsed.userId
    });
    var append = this._ingressQueue.appendJob({
      routeType: routeType,
      jobType: jobType,
      idempotencyKey: idempotencyKey,
      payload: payload,
      requestMeta: {
        correlationId: (requestContext && requestContext.correlationId) || '',
        teamId: parsed.teamId || '',
        userId: parsed.userId || '',
        command: parsed.command || ''
      }
    });
    return append;
  }

  _extractModalValue(values, blockId, actionId) {
    if (!values[blockId] || !values[blockId][actionId]) return '';
    return this._security.sanitizeInput(values[blockId][actionId].value || '');
  }
}
