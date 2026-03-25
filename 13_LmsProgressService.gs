class LmsProgressService {
  constructor(db, slackApiClient, blocks, config) {
    this._db = db;
    this._slack = slackApiClient;
    this._blocks = blocks;
    this._config = config || {};
  }

  handleProgress(ctx) {
    var snapshot = this.getProgressSnapshot(ctx.userId);
    if (!snapshot.ok) return { response_type: 'ephemeral', text: snapshot.message };
    return {
      response_type: 'ephemeral',
      text: 'Progress summary',
      blocks: this._blocks.buildProgressSummary(snapshot)
    };
  }

  getProgressSnapshot(slackUserId) {
    var learner = this._db.table('learners').findAll().filter(function(row) { return row.slackUserId === slackUserId; })[0];
    if (!learner) return { ok: false, code: 'LEARNER_NOT_FOUND', message: 'Learner not found.' };

    var progress = this._db.table('learner_progress').findAll().filter(function(row) { return row.learnerId === learner.id; });
    var completed = progress.filter(function(r) { return r.state === 'completed'; }).length;
    var overdue = progress.filter(function(r) { return r.state === 'overdue'; }).length;
    var active = progress.filter(function(r) { return r.state !== 'completed'; })[0] || null;

    return {
      ok: true,
      learnerId: learner.id,
      activeCourse: this._config.defaultCourseId || '',
      currentLesson: active ? active.lessonId : '',
      completedCount: completed,
      overdueCount: overdue,
      nextAction: active ? 'Complete lesson ' + active.lessonId : 'Request next lesson',
      totalCount: progress.length
    };
  }
}
