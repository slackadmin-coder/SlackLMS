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
    var queued = this.queueNextEligibleLessonForLearner(ctx.userId);
    if (!queued.ok) {
      return { response_type: 'ephemeral', text: queued.message || 'Unable to queue lesson right now.' };
    }

    return {
      response_type: 'ephemeral',
      text: 'Queued your next lesson for delivery. You will receive it in DM shortly.'
    };
  }

  handleMix(ctx) {
    return this.handleLesson(ctx);
  }

  queueNextEligibleLessonForLearner(slackUserId) {
    var learner = this._repos.learnerRepo.findBySlackUserId(slackUserId);
    if (!learner) return { ok: false, code: 'LEARNER_NOT_FOUND', message: 'Learner not found.' };

    var resolved = this.resolveNextEligibleLessonForLearner(learner.id);
    if (!resolved.ok) return resolved;

    var nowIso = new Date().toISOString();
    var lesson = resolved.lesson;
    var dedupedCount = this._dedupeQueuedEntries(learner.id, lesson.id, nowIso);

    var queueRow = this._db.table('delivery_queue').insert({
      learnerId: learner.id,
      lessonId: lesson.id,
      status: 'queued',
      priority: 'normal',
      runAt: nowIso,
      attempts: '0',
      availableAt: nowIso,
      conditionExpr: ''
    });

    var existingProgress = this._repos.progressRepo.findByLearnerAndLesson(learner.id, lesson.id);
    var progressId = '';
    if (existingProgress) {
      progressId = existingProgress.id;
      this._repos.progressRepo.update(existingProgress.id, {
        state: 'queued',
        dueAt: existingProgress.dueAt || nowIso
      });
    } else {
      var insertedProgress = this._repos.progressRepo.insert({
        learnerId: learner.id,
        lessonId: lesson.id,
        state: 'queued',
        dueAt: nowIso
      });
      progressId = insertedProgress.id;
    }

    this._db.audit('LESSON_QUEUED', 'delivery_queue', {
      learnerId: learner.id,
      lessonId: lesson.id,
      queueId: queueRow.id,
      progressId: progressId,
      dedupedCount: dedupedCount,
      source: '/learn'
    });

    return {
      ok: true,
      code: 'LESSON_QUEUED',
      learnerId: learner.id,
      lessonId: lesson.id,
      queueId: queueRow.id,
      progressId: progressId,
      dedupedCount: dedupedCount
    };
  }

  resolveNextEligibleLessonForLearner(learnerId) {
    var progressRows = this._repos.progressRepo.findByLearnerId(learnerId).filter(function(row) {
      return row.state !== 'completed';
    });

    var candidate = this._selectEligibleLessonFromProgress(progressRows);
    if (candidate) return { ok: true, learnerId: learnerId, lesson: candidate.lesson, progress: candidate.progress };

    var enrollment = this._db.table('enrollment').findAll().filter(function(row) {
      return row.learnerId === learnerId && String(row.status || 'active') === 'active';
    })[0];

    if (!enrollment) {
      return { ok: false, code: 'NO_ACTIVE_ENROLLMENT', message: 'No active enrollment found.' };
    }

    var lessons = this._repos.lessonRepo.findActiveByCourse(enrollment.courseId);
    for (var i = 0; i < lessons.length; i++) {
      if (this._isLessonQaApproved(lessons[i].id)) {
        return { ok: true, learnerId: learnerId, lesson: lessons[i], progress: null };
      }
    }

    return { ok: false, code: 'NO_ELIGIBLE_LESSON', message: 'No eligible lesson available yet.' };
  }

  _selectEligibleLessonFromProgress(progressRows) {
    var candidates = [];
    for (var i = 0; i < progressRows.length; i++) {
      var progress = progressRows[i];
      var lesson = this._repos.lessonRepo.findById(progress.lessonId);
      if (!lesson) continue;
      if (!this._isLessonQaApproved(lesson.id)) continue;
      candidates.push({ lesson: lesson, progress: progress });
    }

    candidates.sort(function(a, b) {
      return Number(a.lesson.sequenceNumber || 0) - Number(b.lesson.sequenceNumber || 0);
    });

    return candidates[0] || null;
  }

  _isLessonQaApproved(lessonId) {
    var qaRecord = this._db.table('lesson_qa_records').findAll().filter(function(r) {
      return r.lessonId === lessonId;
    })[0];
    var qaThreshold = Number((this._config.qaPassThreshold) || 70);
    return !(qaRecord && Number(qaRecord.qaScore || 0) < qaThreshold);
  }

  _dedupeQueuedEntries(learnerId, lessonId, nowIso) {
    var existingQueued = this._db.table('delivery_queue').findAll().filter(function(row) {
      return row.learnerId === learnerId && row.lessonId === lessonId && row.status === 'queued';
    });

    for (var i = 0; i < existingQueued.length; i++) {
      this._db.table('delivery_queue').update(existingQueued[i].id, {
        status: 'deduped',
        updatedAt: nowIso
      });
    }

    return existingQueued.length;
  }

  getCurrentLessonForLearner(slackUserId) {
    var learner = this._repos.learnerRepo.findBySlackUserId(slackUserId);
    if (!learner) return { ok: false, code: 'LEARNER_NOT_FOUND', message: 'Learner not found.' };

    var progress = this._repos.progressRepo.findActiveLesson(learner.id);
    if (!progress) return { ok: false, code: 'NO_ACTIVE_LESSON', message: 'No lesson assigned yet.' };

    var lesson = this._repos.lessonRepo.findById(progress.lessonId) || { id: progress.lessonId, title: 'Lesson', track: '' };
    if (!this._isLessonQaApproved(progress.lessonId)) {
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
        if (active) {
          var transitioned = self._state.transition(active, self._state.states.IN_PROGRESS, { source: 'delivery' });
          if (transitioned.ok) self._repos.progressRepo.update(active.id, { state: transitioned.record.state });
        }
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
