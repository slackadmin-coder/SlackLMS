class LmsCompletionService {
  constructor(db, slackApiClient, blocks, stateMachine, config) {
    this._db = db;
    this._slack = slackApiClient;
    this._blocks = blocks;
    this._state = stateMachine;
    this._config = config || {};
  }

  handleSubmit(ctx) {
    var lessonId = String((ctx.params && ctx.params.text) || '').trim();
    if (!lessonId) return { response_type: 'ephemeral', text: 'Usage: /submit <lesson_id>' };

    var recorded = this.recordSubmission({ slackUserId: ctx.userId, lessonId: lessonId, payload: ctx.rawBody });
    if (!recorded.ok) return { response_type: 'ephemeral', text: recorded.message };

    this.advanceLessonState({ learnerProgressId: recorded.learnerProgressId, toState: 'submitted' });
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
    // TODO: determine next lesson ordering from course track.
    var row = this._db.table('delivery_queue').insert({
      learnerId: input.learnerId,
      lessonId: '',
      status: 'queued',
      runAt: new Date().toISOString()
    });
    return { ok: true, code: 'NEXT_QUEUED', queueId: row.id };
  }
}
