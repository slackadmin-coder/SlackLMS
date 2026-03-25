class LmsReminderService {
  constructor(db, slackApiClient, blocks, config) {
    this._db = db;
    this._slack = slackApiClient;
    this._blocks = blocks;
    this._config = config || {};
  }

  sendOverdueReminders() {
    var overdue = this._db.table('learner_progress').findAll().filter(function(row) { return row.state === 'overdue'; });
    var results = [];
    for (var i = 0; i < overdue.length; i++) {
      results.push(this.sendReminderForLearner(overdue[i].learnerId));
    }
    return { ok: true, total: overdue.length, results: results };
  }

  sendReminderForLearner(learnerId) {
    var learner = this._db.table('learners').findById(learnerId);
    if (!learner) return { ok: false, code: 'LEARNER_NOT_FOUND', learnerId: learnerId };
    var dm = this._slack.openDm(learner.slackUserId);
    if (!dm.ok) return dm;
    return this._slack.postMessage(dm.channelId, 'Lesson reminder', this._blocks.buildReminder({ learnerId: learnerId }));
  }

  escalateStalledLearner(learnerId) {
    return {
      ok: true,
      learnerId: learnerId,
      escalated: !!this._config.opsAlertChannel,
      message: this._config.opsAlertChannel ? 'Escalation target configured.' : 'No ops channel configured.'
    };
  }
}
