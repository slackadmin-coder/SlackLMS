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
      overdue: dashboard.totals.overdue
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
      overdue: rows.filter(function(r) { return r.state === 'overdue'; }).length,
      active: rows.filter(function(r) { return r.state !== 'completed'; }).map(function(r) { return r.lessonId; })
    };
  }

  buildOverdueSummary() {
    var rows = this._db.table('learner_progress').findAll().filter(function(r) { return r.state === 'overdue'; });
    return { ok: true, overdueCount: rows.length, items: rows };
  }

  buildAdminDashboard() {
    var learners = this._db.table('learners').findAll();
    var progress = this._db.table('learner_progress').findAll();
    var enrollment = this._db.table('enrollment').findAll();

    var completed = progress.filter(function(r) { return r.state === 'completed'; }).length;
    var submitted = progress.filter(function(r) { return r.state === 'submitted'; }).length;
    var overdueItems = progress.filter(function(r) { return r.state === 'overdue'; });
    var completionRate = progress.length ? Number((completed / progress.length * 100).toFixed(2)) : 0;

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      totals: {
        learners: learners.length,
        enrollments: enrollment.length,
        completed: completed,
        submitted: submitted,
        overdue: overdueItems.length,
        completionRate: completionRate
      },
      overdueLessons: overdueItems,
      jsonReady: true
    };
  }
}
