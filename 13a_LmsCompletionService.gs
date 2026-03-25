class LmsCompletionService {
  constructor(db, slackApiClient, blocks, stateMachine, config) {
    this._db = db;
    this._slack = slackApiClient;
    this._blocks = blocks;
    this._state = stateMachine;
    this._config = config || {};
  }

  handleSubmit(ctx) {
    var parts = String((ctx.params && ctx.params.text) || '').trim().split(/\s+/);
    var lessonId = parts[0] || '';
    var keyword = (parts[1] || '').toLowerCase();

    if (keyword !== 'complete') {
      return { response_type: 'ephemeral', text: 'Usage: /submit <lesson_id> complete' };
    }
    if (!lessonId) {
      return { response_type: 'ephemeral', text: 'Usage: /submit <lesson_id> complete' };
    }

    var recorded = this.recordSubmission({ slackUserId: ctx.userId, lessonId: lessonId, payload: ctx.rawBody });
    if (!recorded.ok) return { response_type: 'ephemeral', text: recorded.message };

    var progressRow = this._db.table('learner_progress').findAll().filter(function(r) {
      return r.learnerId === recorded.learnerId && r.lessonId === lessonId && r.state !== 'completed';
    })[0];
    if (progressRow) {
      this.advanceLessonState({ learnerProgressId: progressRow.id, toState: 'submitted' });
    }

    this.queueNextLesson({ learnerId: recorded.learnerId, currentLessonId: lessonId });
    return { response_type: 'ephemeral', text: 'Submission received for ' + lessonId };
  }

  recordSubmission(input) {
    var learner = this._db.table('learners').findAll().filter(function(r) { return r.slackUserId === input.slackUserId; })[0];
    if (!learner) return { ok: false, code: 'LEARNER_NOT_FOUND', message: 'Learner not found.' };

    var submitKey = learner.id + ':' + input.lessonId;
    var existing = this._db.table('submission_log').findAll().filter(function(r) { return r.submitKey === submitKey; })[0];
    if (existing) {
      return { ok: true, code: 'DUPLICATE_SUBMISSION', learnerId: learner.id, learnerProgressId: learner.id, submissionId: existing.id, message: 'Submission already recorded.' };
    }

    var row = this._db.table('submission_log').insert({
      learnerId: learner.id,
      lessonId: input.lessonId,
      submitKey: submitKey,
      payload: input.payload || ''
    });

    this._db.audit('record_submission', 'submission_log', { learnerId: learner.id, lessonId: input.lessonId, submissionId: row.id });
    return { ok: true, code: 'SUBMISSION_RECORDED', learnerId: learner.id, learnerProgressId: learner.id, submissionId: row.id };
  }

  advanceLessonState(input) {
    var progress = this._db.table('learner_progress').findById(input.learnerProgressId);
    if (!progress) return { ok: false, code: 'PROGRESS_NOT_FOUND', message: 'Progress not found.' };
    var transition = this._state.transition(progress, input.toState, { source: 'submission' });
    if (!transition.ok) return transition;
    this._db.table('learner_progress').update(progress.id, { state: transition.record.state });
    return { ok: true, code: 'STATE_UPDATED', recordId: progress.id };
  }

  queueNextLesson(input) {
    var currentLesson = this._db.table('lessons').findById(input.currentLessonId);
    if (!currentLesson) {
      return { ok: false, code: 'CURRENT_LESSON_NOT_FOUND' };
    }

    var lessons = this._db.table('lessons').findAll().filter(function(row) {
      return row.courseId === currentLesson.courseId && String(row.active) === 'true' && !String(row.deletedAt || '').trim();
    }).sort(function(a, b) {
      return Number(a.sequenceNumber || 0) - Number(b.sequenceNumber || 0);
    });

    var currentSequence = Number(currentLesson.sequenceNumber || 0);
    var nextLesson = null;
    for (var i = 0; i < lessons.length; i++) {
      if (Number(lessons[i].sequenceNumber || 0) > currentSequence) {
        nextLesson = lessons[i];
        break;
      }
    }

    if (!nextLesson) {
      return { ok: true, code: 'COURSE_COMPLETE', message: 'No further lessons in this course.' };
    }

    var existingProgress = this._db.table('learner_progress').findAll().filter(function(row) {
      return row.learnerId === input.learnerId && row.lessonId === nextLesson.id;
    })[0];
    if (existingProgress && existingProgress.state !== 'completed') {
      return { ok: true, code: 'ALREADY_QUEUED' };
    }

    this._db.table('learner_progress').insert({
      learnerId: input.learnerId,
      lessonId: nextLesson.id,
      state: 'queued',
      dueAt: ''
    });

    this._db.table('delivery_queue').insert({
      learnerId: input.learnerId,
      lessonId: nextLesson.id,
      status: 'queued',
      runAt: new Date().toISOString()
    });

    return { ok: true, code: 'NEXT_LESSON_QUEUED', lessonId: nextLesson.id };
  }
}
