class LmsLessonService {
  constructor(db, slackApiClient, blocks, stateMachine, config) {
    this._db = db;
    this._slack = slackApiClient;
    this._blocks = blocks;
    this._state = stateMachine;
    this._config = config || {};
  }

  handleLesson(ctx) {
    var current = this.getCurrentLessonForLearner(ctx.userId);
    if (!current.ok) return { response_type: 'ephemeral', text: current.message };
    return {
      response_type: 'ephemeral',
      text: 'Your current lesson',
      blocks: this._blocks.buildLessonCard(current.lesson)
    };
  }

  getCurrentLessonForLearner(slackUserId) {
    var learner = this._db.table('learners').findAll().filter(function(r) { return r.slackUserId === slackUserId; })[0];
    if (!learner) return { ok: false, code: 'LEARNER_NOT_FOUND', message: 'Learner not found.' };

    var progress = this._db.table('learner_progress').findAll().filter(function(r) {
      return r.learnerId === learner.id && r.state !== 'completed';
    })[0];
    if (!progress) return { ok: false, code: 'NO_ACTIVE_LESSON', message: 'No lesson assigned yet.' };

    var lesson = this._db.table('lessons').findById(progress.lessonId) || { id: progress.lessonId, title: 'Lesson', track: '' };
    return { ok: true, learnerId: learner.id, lesson: lesson, progress: progress };
  }

  deliverLessonToLearner(learnerId, lessonId) {
    var learner = this._db.table('learners').findById(learnerId);
    if (!learner) return { ok: false, code: 'LEARNER_NOT_FOUND', message: 'Learner not found' };

    var dm = this._slack.openDm(learner.slackUserId);
    if (!dm.ok) return dm;
    var sent = this._slack.postMessage(dm.channelId, 'New lesson available', this._blocks.buildLessonCard({ lessonId: lessonId }));
    if (!sent.ok) return sent;

    this._db.table('delivery_queue').insert({ learnerId: learnerId, lessonId: lessonId, status: 'delivered', runAt: new Date().toISOString() });
    var active = this._db.table('learner_progress').findAll().filter(function(r) { return r.learnerId === learnerId && r.lessonId === lessonId; })[0];
    if (active) this._db.table('learner_progress').update(active.id, { state: 'delivered' });
    return { ok: true, code: 'DELIVERED', learnerId: learnerId, lessonId: lessonId };
  }

  deliverPendingLessons() {
    var pending = this._db.table('delivery_queue').findAll().filter(function(row) { return row.status === 'queued'; });
    var delivered = [];
    for (var i = 0; i < pending.length; i++) {
      var res = this.deliverLessonToLearner(pending[i].learnerId, pending[i].lessonId);
      delivered.push({ id: pending[i].id, ok: !!res.ok });
      if (res.ok) this._db.table('delivery_queue').update(pending[i].id, { status: 'delivered' });
    }
    return { ok: true, total: pending.length, delivered: delivered };
  }
}
