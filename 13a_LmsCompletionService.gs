class LmsCompletionService {
  constructor(db, slackApiClient, blocks, stateMachine, config, repositories, workflowEngine, securityService) {
    this._db = db;
    this._slack = slackApiClient;
    this._blocks = blocks;
    this._state = stateMachine;
    this._config = config || {};
    this._repos = repositories || {};
    this._workflow = workflowEngine;
    this._security = securityService || SecurityService;
  }

  handleSubmit(ctx) {
    var parts = String((ctx.params && ctx.params.text) || '').trim().split(/\s+/);
    var lessonId = this._security.sanitizeInput(parts[0] || '');
    var keyword = (parts[1] || '').toLowerCase();

    if (keyword !== 'complete' || !lessonId) {
      return { response_type: 'ephemeral', text: 'Usage: /submit <lesson_id> complete' };
    }

    var result = this.recordSubmission({ slackUserId: ctx.userId, lessonId: lessonId, payload: ctx.rawBody });
    if (!result.ok) return { response_type: 'ephemeral', text: result.message || result.error_code };
    return { response_type: 'ephemeral', text: 'Submission received for ' + lessonId + '. Correlation: ' + result.correlationId };
  }

  recordSubmission(input) {
    var self = this;
    var skillId = SkillRegistry.workflowActionSkills.submission; // skill-trace: SKILL-SUBMISSION-001
    return this._workflow.run('submission', input, {
      validate: function(ctx) {
        ctx.data.learner = self._repos.learnerRepo.findBySlackUserId(ctx.trigger.slackUserId);
        if (!ctx.data.learner) throw { code: 'LEARNER_NOT_FOUND', message: 'Learner not found.' };
      },
      process: function(ctx) {
        ctx.data.submitKey = ctx.data.learner.id + ':' + ctx.trigger.lessonId;
        ctx.data.existing = self._db.table('submission_log').findAll().filter(function(r) { return r.submitKey === ctx.data.submitKey; })[0];
        if (!ctx.data.existing) {
          ctx.data.submission = self._db.table('submission_log').insert({
            learnerId: ctx.data.learner.id,
            lessonId: ctx.trigger.lessonId,
            submitKey: ctx.data.submitKey,
            payload: ctx.trigger.payload || ''
          });
        } else {
          ctx.data.submission = self._db.table('submission_log').update(ctx.data.existing.id, {
            payload: ctx.trigger.payload || ''
          });
        }
      },
      persist: function(ctx) {
        var progressRow = self._repos.progressRepo.findByLearnerAndLesson(ctx.data.learner.id, ctx.trigger.lessonId);
        if (!progressRow) {
          throw { code: 'PROGRESS_NOT_FOUND', message: 'No progress row found for learner and lesson.' };
        }

        var normalized = self._state.normalizeState(progressRow.state);
        if (normalized === self._state.states.COMPLETED) {
          ctx.data.progressCompletion = { ok: true, code: 'ALREADY_COMPLETED', recordId: progressRow.id };
          return;
        }

        var startState = String(progressRow.state || '').trim().toLowerCase();
        if (startState !== 'delivered' && startState !== 'started') {
          throw {
            code: 'INVALID_START_STATE',
            message: 'Submission is only allowed from delivered or started. Found: ' + (startState || '<empty>') + '.'
          };
        }

        var submitted = self.advanceLessonState({
          learnerId: ctx.data.learner.id,
          lessonId: ctx.trigger.lessonId,
          toState: self._state.states.SUBMITTED,
          payload: ctx.trigger.payload || '',
          startState: startState
        });
        if (!submitted.ok) throw submitted;

        var completed = self.advanceLessonState({
          learnerId: ctx.data.learner.id,
          lessonId: ctx.trigger.lessonId,
          toState: self._state.states.COMPLETED
        });
        if (!completed.ok) throw completed;

        ctx.data.progressCompletion = completed;
        ctx.data.queueResult = self.queueNextLesson({ learnerId: ctx.data.learner.id, currentLessonId: ctx.trigger.lessonId });
      },
      respond: function(ctx) {
        ctx.result = {
          ok: true,
          code: ctx.data.existing ? 'DUPLICATE_SUBMISSION' : 'SUBMISSION_RECORDED',
          skillId: skillId,
          learnerId: ctx.data.learner.id,
          submissionId: ctx.data.existing ? ctx.data.existing.id : ctx.data.submission.id,
          message: ctx.data.existing ? 'Submission already recorded.' : 'Submission recorded.',
          correlationId: ctx.correlationId
        };
      },
      audit: function(ctx) {
        self._db.audit('record_submission', 'submission_log', { learnerId: ctx.data.learner.id, lessonId: ctx.trigger.lessonId, correlationId: ctx.correlationId, skillId: skillId });
      }
    });
  }

  advanceLessonState(input) {
    var progress = this._repos.progressRepo.findByLearnerAndLesson(input.learnerId, input.lessonId);
    if (!progress) return { ok: false, code: 'PROGRESS_NOT_FOUND', message: 'Progress not found.' };

    var progressSource = progress;
    if (input.startState === 'delivered') {
      progressSource = {};
      Object.keys(progress).forEach(function(k) { progressSource[k] = progress[k]; });
      progressSource.state = this._state.states.IN_PROGRESS;
    }

    var transition = this._state.transition(progressSource, input.toState, { source: 'submission' });
    if (!transition.ok) return transition;

    var patch = {
      state: transition.record.state,
      updatedAt: transition.record.updatedAt
    };
    if (transition.record.completedAt) patch.completedAt = transition.record.completedAt;
    if (input.toState === this._state.states.SUBMITTED) patch.submissionText = String(input.payload || '');

    this._repos.progressRepo.update(progress.id, patch);
    return { ok: true, code: 'STATE_UPDATED', recordId: progress.id };
  }

  queueNextLesson(input) {
    var currentLesson = this._repos.lessonRepo.findById(input.currentLessonId);
    if (!currentLesson) {
      return { ok: false, code: 'CURRENT_LESSON_NOT_FOUND' };
    }

    var nextLesson = this._repos.lessonRepo.findNextLesson(currentLesson.courseId, currentLesson.sequenceNumber || 0);

    if (!nextLesson) {
      return { ok: true, code: 'COURSE_COMPLETE', message: 'No further lessons in this course.' };
    }

    var existingProgress = this._repos.progressRepo.findByLearnerAndLesson(input.learnerId, nextLesson.id);
    if (existingProgress && this._state.normalizeState(existingProgress.state) !== this._state.states.COMPLETED) {
      return { ok: true, code: 'ALREADY_QUEUED' };
    }

    this._repos.progressRepo.insert({
      learnerId: input.learnerId,
      lessonId: nextLesson.id,
      state: this._state.states.NOT_STARTED,
      dueAt: ''
    });

    this._db.table('delivery_queue').insert({
      learnerId: input.learnerId,
      lessonId: nextLesson.id,
      status: 'queued',
      priority: 'normal',
      runAt: new Date().toISOString(),
      attempts: '0',
      availableAt: new Date().toISOString(),
      conditionExpr: ''
    });

    return { ok: true, code: 'NEXT_LESSON_QUEUED', lessonId: nextLesson.id };
  }
}
