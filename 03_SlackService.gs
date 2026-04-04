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
    this._slack = services.slackApiClient || null;
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
      '/onboard': this._handleOnboard.bind(this),
      '/gaps': this._handleGaps.bind(this),
      '/audit': this._handleAudit.bind(this),
      '/mix': this._handleMix.bind(this),
      '/reinforce': this._handleReinforce.bind(this),
      '/offboard': this._handleOffboard.bind(this)
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
        payload: JSON.stringify(payload),
        idempotencyKey: this._buildSubmissionIdempotencyKey(parsed.userId, lessonId)
      });
      return { response_type: 'ephemeral', text: submit.ok ? ':white_check_mark: Lesson submitted.' : (submit.message || submit.error_code) };
    }

    return { response_type: 'ephemeral', text: 'Action received. Use /help to see supported actions.' };
  }

  handleEventCallback(parsed) {
    var event = (parsed.body && parsed.body.event) ? parsed.body.event : {};
    if (event.type === 'reaction_added') {
      return this._handleReactionAdded(parsed, event);
    }
    if (event.type === 'app_mention') {
      return {
        ok: true,
        text: 'Hi! Commands: `/learn`, `/submit <lesson_id> complete`, `/progress`, `/help`, `/enroll [courseId]`, `/report`, `/onboard [email]`, `/gaps`, `/audit`, `/mix`, `/reinforce`, `/offboard [email]`.'
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
    return { response_type: 'ephemeral', text: 'Commands: /learn, /submit <lesson_id> complete, /progress, /help, /enroll [courseId], /report, /onboard [email], /gaps, /audit, /mix, /reinforce, /offboard [email]' };
  }

  _handleEnroll(parsed) {
    return this._enrollment.enrollLearner({
      slackUserId: parsed.userId,
      courseId: this._security.sanitizeInput(parsed.params.text || '') || this._config.defaultCourseId
    });
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

  _handleMix(parsed) {
    return this._lesson.handleMix(parsed);
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
      payload: JSON.stringify({ notes: notesValue, source: 'modal_submission' }),
      idempotencyKey: this._buildSubmissionIdempotencyKey(learnerId, lessonValue)
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

  _handleReactionAdded(parsed, event) {
    var reaction = String(event.reaction || '');
    if (!this._isCompletionReaction(reaction)) {
      return { ok: true, text: 'Reaction ignored', eventType: event.type || '', reason: 'unsupported_reaction' };
    }

    var eventId = this._security.sanitizeInput((parsed.body && parsed.body.event_id) || '');
    if (!eventId) {
      return { ok: true, text: 'Reaction ignored', eventType: event.type || '', reason: 'missing_event_id' };
    }
    if (!this._claimReplayGuard(eventId)) {
      this._auditReactionEvent('reaction_submission_duplicate_event', eventId, event, { replayed: true });
      return { ok: true, text: 'Reaction ignored', eventType: event.type || '', reason: 'duplicate_event' };
    }

    var context = this._resolveReactionContext(event);
    if (!context.ok) {
      this._auditReactionEvent('reaction_submission_context_failed', eventId, event, { reason: context.code || 'CONTEXT_NOT_FOUND' });
      return { ok: true, text: 'Reaction ignored', eventType: event.type || '', reason: context.code || 'CONTEXT_NOT_FOUND' };
    }

    var idempotencyKey = this._buildSubmissionIdempotencyKey(context.slackUserId, context.lessonId);
    var submission = this._completion.recordSubmission({
      slackUserId: context.slackUserId,
      lessonId: context.lessonId,
      payload: JSON.stringify({ source: 'reaction_added', event_id: eventId, channel: context.channel, ts: context.ts }),
      idempotencyKey: idempotencyKey,
      auditMeta: {
        source: 'reaction_added',
        event_id: eventId,
        user: context.slackUserId,
        channel: context.channel,
        ts: context.ts
      }
    });

    this._auditReactionEvent('reaction_submission_processed', eventId, event, {
      lessonId: context.lessonId,
      idempotencyKey: idempotencyKey,
      resultCode: submission.code || '',
      ok: !!submission.ok
    });
    return { ok: true, text: submission.ok ? 'Reaction submission processed' : (submission.message || submission.code || 'Submission failed') };
  }

  _isCompletionReaction(reaction) {
    var normalized = String(reaction || '').toLowerCase();
    return normalized === 'white_check_mark' || normalized === '✅';
  }

  _resolveReactionContext(event) {
    var slackUserId = this._security.sanitizeInput(event.user || '');
    var item = event.item || {};
    var channel = this._security.sanitizeInput(item.channel || event.item_channel || '');
    var ts = this._security.sanitizeInput(item.ts || event.event_ts || '');
    if (!slackUserId || !channel || !ts) return { ok: false, code: 'MALFORMED_REACTION_EVENT' };

    var lessonId = this._extractLessonIdFromMessageLookup(channel, ts);
    if (!lessonId) return { ok: false, code: 'LESSON_CONTEXT_NOT_FOUND' };
    return { ok: true, slackUserId: slackUserId, lessonId: lessonId, channel: channel, ts: ts };
  }

  _extractLessonIdFromMessageLookup(channel, ts) {
    if (!this._slack || typeof this._slack.fetchMessageByTs !== 'function') return '';
    var lookedUp = this._slack.fetchMessageByTs(channel, ts);
    if (!lookedUp || !lookedUp.ok || !lookedUp.message) return '';
    var message = lookedUp.message;
    var metadata = message.metadata || {};
    var payload = metadata.event_payload || {};
    var candidate = payload.lessonId || payload.lesson_id || metadata.lessonId || metadata.lesson_id || '';
    if (!candidate && Array.isArray(message.blocks)) {
      for (var i = 0; i < message.blocks.length; i++) {
        var block = message.blocks[i];
        if (block.type !== 'context' || !Array.isArray(block.elements)) continue;
        for (var j = 0; j < block.elements.length; j++) {
          var text = String((block.elements[j] && block.elements[j].text) || '');
          var match = text.match(/[A-Z0-9]+-[A-Z0-9-]+/);
          if (match) {
            candidate = match[0];
            break;
          }
        }
        if (candidate) break;
      }
    }

    if (!candidate) {
      var textBody = String(message.text || '');
      var submitMatch = textBody.match(/\/submit\s+([A-Za-z0-9-]+)\s+complete/i);
      if (submitMatch) candidate = submitMatch[1];
    }
    return this._security.sanitizeInput(candidate || '');
  }

  _buildSubmissionIdempotencyKey(slackUserId, lessonId) {
    return 'submit:' + this._security.sanitizeInput(slackUserId || '') + ':' + this._security.sanitizeInput(lessonId || '') + ':complete';
  }

  _claimReplayGuard(eventId) {
    var key = 'slack_event_reaction_' + eventId;
    try {
      var cache = CacheService.getScriptCache();
      if (cache.get(key)) return false;
      cache.put(key, '1', 60 * 60 * 6);
      return true;
    } catch (err) {
      this._localReplayGuard = this._localReplayGuard || {};
      if (this._localReplayGuard[key]) return false;
      this._localReplayGuard[key] = true;
      return true;
    }
  }

  _auditReactionEvent(action, eventId, event, extra) {
    if (!this._completion || !this._completion._db || typeof this._completion._db.audit !== 'function') return;
    var item = event.item || {};
    var metadata = {
      event_id: eventId,
      user: this._security.sanitizeInput(event.user || ''),
      channel: this._security.sanitizeInput(item.channel || ''),
      ts: this._security.sanitizeInput(item.ts || '')
    };
    Object.keys(extra || {}).forEach(function(key) {
      metadata[key] = extra[key];
    });
    this._completion._db.audit(action, 'submission_log', metadata);
  }
}
