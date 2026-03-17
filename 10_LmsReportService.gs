class LmsReportService {
  constructor(db, config) {
    this._db = db;
    this._config = config || {};
  }

  buildWeeklySummary() {
    var learners = this._db.table('learners').findAll().length;
    var progress = this._db.table('learner_progress').findAll();
    return {
      ok: true,
      learners: learners,
      completed: progress.filter(function(r) { return r.state === 'completed'; }).length,
      submitted: progress.filter(function(r) { return r.state === 'submitted'; }).length
    };
  }

  buildCohortSummary(courseId) {
    var rows = this._db.table('enrollment').findAll().filter(function(r) { return r.courseId === courseId; });
    return { ok: true, courseId: courseId, enrollmentCount: rows.length, activeCount: rows.filter(function(r) { return r.status === 'active'; }).length };
  }

  buildOverdueSummary() {
    var rows = this._db.table('learner_progress').findAll().filter(function(r) { return r.state === 'overdue'; });
    return { ok: true, overdueCount: rows.length, learnerIds: rows.map(function(r) { return r.learnerId; }) };
  }
}
