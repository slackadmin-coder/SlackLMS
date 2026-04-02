class LmsLessonService {
  constructor(db, slackApiClient, blocks, stateMachine, config, repositories, workflowEngine) {
    this._db = db;
    this._slack = slackApiClient;
    this._blocks = blocks;
    this._state = stateMachine;
    this._config = config || {};
    this._repos = repositories || {};
    this._workflow = workflowEngine;
  }

  handleLesson(ctx) {
    var current = this.getCurrentLessonForLearner(ctx.userId);
    if (!current.ok) return { response_type: 'ephemeral', text: current.message };

    var payload = this._buildLessonMessagePayload(current.lesson, 'Your current lesson');
    var dm = this._slack.openDm(ctx.userId);
    if (!dm.ok) {
      this._db.audit('learn_dm_failed', 'audit_log', {
        learnerId: current.learnerId,
        lessonId: current.lesson.id,
        slackUserId: ctx.userId,
        code: dm.code,
        message: dm.message,
        retryable: !!dm.retryable
      });
      return { response_type: 'ephemeral', text: 'I could not open a DM right now. Please try again in a moment.' };
    }

    var sent = this._slack.postMessage(dm.channelId, payload.text, payload.blocks);
    if (!sent.ok) {
      this._db.audit('learn_dm_failed', 'audit_log', {
        learnerId: current.learnerId,
        lessonId: current.lesson.id,
        slackUserId: ctx.userId,
        channelId: dm.channelId,
        code: sent.code,
        message: sent.message,
        retryable: !!sent.retryable
      });
      return { response_type: 'ephemeral', text: 'I could not send your lesson DM. Please try again shortly.' };
    }

    this._db.audit('learn_dm_sent', 'audit_log', {
      learnerId: current.learnerId,
      lessonId: current.lesson.id,
      slackUserId: ctx.userId,
      channelId: dm.channelId
    });
    return { response_type: 'ephemeral', text: 'Sent your current lesson in DM :email:' };
  }

  handleMix(ctx) {
    return this.handleLesson(ctx);
  }

  getCurrentLessonForLearner(slackUserId) {
    var learner = this._repos.learnerRepo.findBySlackUserId(slackUserId);
    if (!learner) return { ok: false, code: 'LEARNER_NOT_FOUND', message: 'Learner not found.' };

    var progress = this._repos.progressRepo.findActiveLesson(learner.id);
    if (!progress) return { ok: false, code: 'NO_ACTIVE_LESSON', message: 'No lesson assigned yet.' };

    var lesson = this._repos.lessonRepo.findById(progress.lessonId) || { id: progress.lessonId, title: 'Lesson', track: '' };
    var qaRecord = this._db.table('lesson_qa_records').findAll().filter(function(r) {
      return r.lessonId === progress.lessonId;
    })[0];
    var qaThreshold = Number((this._config.qaPassThreshold) || 70);
    if (qaRecord && Number(qaRecord.qaScore || 0) < qaThreshold) {
      return { ok: false, code: 'LESSON_NOT_QA_APPROVED', message: 'This lesson has not passed QA review.' };
    }
    return { ok: true, learnerId: learner.id, lesson: lesson, progress: progress };
  }

  deliverLessonToLearner(learnerId, lessonId) {
    var self = this;
    return this._workflow.run('lesson_delivery', { learnerId: learnerId, lessonId: lessonId }, {
      validate: function(ctx) {
        ctx.data.learner = self._repos.learnerRepo.findById(ctx.trigger.learnerId);
        if (!ctx.data.learner) throw { code: 'LEARNER_NOT_FOUND', message: 'Learner not found' };
        ctx.data.lesson = self._repos.lessonRepo.findById(ctx.trigger.lessonId) || { id: ctx.trigger.lessonId, title: 'Lesson' };
      },
      process: function(ctx) {
        var payload = self._buildLessonMessagePayload(ctx.data.lesson, 'New lesson available');
        ctx.data.text = payload.text;
        ctx.data.blocks = payload.blocks;
        ctx.data.dm = self._slack.openDm(ctx.data.learner.slackUserId);
        if (!ctx.data.dm.ok) throw { code: ctx.data.dm.code, message: ctx.data.dm.message, retryable: !!ctx.data.dm.retryable };
        ctx.data.sent = self._slack.postMessage(ctx.data.dm.channelId, ctx.data.text, ctx.data.blocks);
        if (!ctx.data.sent.ok) throw { code: ctx.data.sent.code, message: ctx.data.sent.message, retryable: !!ctx.data.sent.retryable };
      },
      persist: function(ctx) {
        self._db.table('delivery_queue').insert({ learnerId: learnerId, lessonId: lessonId, status: 'delivered', runAt: new Date().toISOString(), attempts: '0', priority: 'normal' });
        var active = self._repos.progressRepo.findByLearnerAndLesson(learnerId, lessonId);
        if (active) self._repos.progressRepo.update(active.id, { state: 'delivered' });
      },
      respond: function(ctx) {
        ctx.result = { ok: true, code: 'DELIVERED', learnerId: learnerId, lessonId: lessonId, correlationId: ctx.correlationId };
      },
      audit: function(ctx) {
        self._db.audit('lesson_delivered', 'delivery_queue', { learnerId: learnerId, lessonId: lessonId, correlationId: ctx.correlationId });
      }
    });
  }

  _parseSlackPayload(lesson) {
    var raw = lesson && (lesson.slackPayload || lesson.slack_payload);
    if (!raw) return null;

    if (typeof raw === 'object') {
      return raw;
    }

    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  _buildLessonMessagePayload(lesson, defaultText) {
    var slackPayload = this._parseSlackPayload(lesson);
    if (slackPayload) {
      return {
        text: slackPayload.text || defaultText,
        blocks: slackPayload.blocks || []
      };
    }
    return {
      text: defaultText,
      blocks: this._blocks.buildLessonCard(lesson)
    };
  }

  deliverPendingLessons() {
    var pending = this._db.table('delivery_queue').findAll().filter(function(row) { return row.status === 'queued'; })
      .sort(function(a, b) {
        var pa = a.priority === 'high' ? 0 : 1;
        var pb = b.priority === 'high' ? 0 : 1;
        return pa - pb;
      })
      .slice(0, 25);
    var delivered = [];
    for (var i = 0; i < pending.length; i++) {
      if (pending[i].availableAt && new Date(pending[i].availableAt).getTime() > Date.now()) continue;
      var res = this.deliverLessonToLearner(pending[i].learnerId, pending[i].lessonId);
      delivered.push({ id: pending[i].id, ok: !!res.ok });
      if (res.ok) {
        this._db.table('delivery_queue').update(pending[i].id, { status: 'delivered' });
      } else {
        this._db.table('delivery_queue').update(pending[i].id, { status: 'retry', attempts: String(Number(pending[i].attempts || 0) + 1) });
      }
    }
    return { ok: true, total: pending.length, delivered: delivered };
  }
}
