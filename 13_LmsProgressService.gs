class LmsProgressService {
  constructor(db, slackApiClient, blocks, config, repositories, workflowEngine) {
    this._db = db;
    this._slack = slackApiClient;
    this._blocks = blocks;
    this._config = config || {};
    this._repos = repositories || {};
    this._workflow = workflowEngine;
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

  handleReinforce(ctx) {
    var snapshot = this.getProgressSnapshot(ctx.userId);
    if (!snapshot.ok) return { response_type: 'ephemeral', text: snapshot.message };
    var lessonId = snapshot.currentLesson || 'your current module';
    return { response_type: 'ephemeral', text: 'Reinforcement focus: review ' + lessonId + ' and resubmit with `/submit ' + lessonId + ' complete`.' };
  }

  getProgressSnapshot(slackUserId) {
    var learner = this._repos.learnerRepo.findBySlackUserId(slackUserId);
    if (!learner) return { ok: false, code: 'LEARNER_NOT_FOUND', message: 'Learner not found.' };

    var progress = this._repos.progressRepo.findByLearnerId(learner.id);
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
