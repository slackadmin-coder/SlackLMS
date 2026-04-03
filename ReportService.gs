class ReportService {
  constructor(db, config, repositories) {
    this._db = db;
    this._config = config || {};
    this._repos = repositories || {};
  }

  buildWeeklySummary() {
    var dashboard = this.buildAdminDashboard();
    return {
      ok: true,
      learners: dashboard.totals.learners,
      completed: dashboard.totals.completed,
      submitted: dashboard.totals.submitted,
      completionRate: dashboard.totals.completionRate,
      overdue: dashboard.totals.inProgress
    };
  }

  handleGaps() {
    var overdue = this.buildOverdueSummary();
    return {
      response_type: 'ephemeral',
      text: 'Learning gaps summary',
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: '*Open gaps:* ' + String(overdue.inProgressCount || 0) } }
      ]
    };
  }

  handleAudit() {
    var dashboard = this.buildAdminDashboard();
    return {
      response_type: 'ephemeral',
      text: 'Audit summary',
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: '*Generated:* ' + String(dashboard.generatedAt || '') } },
        { type: 'section', text: { type: 'mrkdwn', text: '*Learners:* ' + String(dashboard.totals.learners || 0) + ' | *Completions:* ' + String(dashboard.totals.completed || 0) + ' | *Overdue:* ' + String(dashboard.totals.inProgress || 0) } }
      ]
    };
  }

  buildLearnerProgressSummary(slackUserId) {
    var learnerRepo = this._repos.learnerRepo;
    var progressRepo = this._repos.progressRepo;
    var learner = learnerRepo.findBySlackUserId(slackUserId);
    if (!learner) return { ok: false, code: 'LEARNER_NOT_FOUND', message: 'Learner not found.' };

    var rows = progressRepo.findByLearnerId(learner.id);
    return {
      ok: true,
      learnerId: learner.id,
      completed: rows.filter(function(r) { return r.state === 'completed'; }).length,
      overdue: rows.filter(function(r) { return r.state === 'in_progress' || r.state === 'submitted'; }).length,
      active: rows.filter(function(r) { return r.state !== 'completed'; }).map(function(r) { return r.lessonId; })
    };
  }

  buildOverdueSummary() {
    var offboarded = this._getOffboardedLearnerIdSet();
    var rows = this._db.table('learner_progress').findAll().filter(function(r) {
      if (offboarded[r.learnerId]) return false;
      return r.state === 'in_progress' || r.state === 'submitted';
    });
    return { ok: true, inProgressCount: rows.length, items: rows };
  }

  buildAdminDashboard() {
    var learners = this._db.table('learners').findAll();
    var progress = this._db.table('learner_progress').findAll();
    var enrollment = this._db.table('enrollment').findAll();
    var offboarded = this._getOffboardedLearnerIdSet(learners, enrollment);
    var activeLearners = learners.filter(function(row) { return !offboarded[row.id]; });
    var activeEnrollment = enrollment.filter(function(row) { return !offboarded[row.learnerId]; });
    var activeProgress = progress.filter(function(row) { return !offboarded[row.learnerId]; });

    var completed = activeProgress.filter(function(r) { return r.state === 'completed'; }).length;
    var submitted = activeProgress.filter(function(r) { return r.state === 'submitted'; }).length;
    var inProgressItems = activeProgress.filter(function(r) { return r.state === 'in_progress' || r.state === 'submitted'; });
    var completionRate = activeProgress.length ? Number((completed / activeProgress.length * 100).toFixed(2)) : 0;

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      totals: {
        learners: activeLearners.length,
        enrollments: activeEnrollment.length,
        completed: completed,
        submitted: submitted,
        inProgress: inProgressItems.length,
        completionRate: completionRate
      },
      inProgressLessons: inProgressItems,
      jsonReady: true
    };
  }

  _getOffboardedLearnerIdSet(learnersRows, enrollmentRows) {
    var learners = learnersRows || this._db.table('learners').findAll();
    var enrollment = enrollmentRows || this._db.table('enrollment').findAll();
    var map = {};

    learners.forEach(function(row) {
      var status = String(row.status || '').toLowerCase();
      if (status === 'offboarded' || status === 'inactive') map[row.id] = true;
    });
    enrollment.forEach(function(row) {
      var status = String(row.status || '').toLowerCase();
      if (status === 'offboarded' || status === 'inactive') map[row.learnerId] = true;
    });

    return map;
  }
}
