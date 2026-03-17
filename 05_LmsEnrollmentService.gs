class LmsEnrollmentService {
  constructor(db, slackApiClient, blocks, config) {
    this._db = db;
    this._slack = slackApiClient;
    this._blocks = blocks;
    this._config = config || {};
  }

  enrollLearner(input) {
    var learner = this.ensureLearnerRecord(input || {});
    var enrollment = this.ensureEnrollmentRecord({
      learnerId: learner.id,
      courseId: (input && input.courseId) || this._config.defaultCourseId,
      track: this._config.defaultTrack
    });
    var queued = this.queueFirstLesson({ learnerId: learner.id, courseId: enrollment.courseId });
    this.sendWelcomeDm({ slackUserId: learner.slackUserId, learnerId: learner.id, courseId: enrollment.courseId });
    this._db.audit('enroll_learner', 'enrollment', { learnerId: learner.id, enrollmentId: enrollment.id });
    return { ok: true, code: 'ENROLLED', learnerId: learner.id, enrollmentId: enrollment.id, queueId: queued.id };
  }

  findLearnerBySlackUserId(slackUserId) {
    if (!slackUserId) return null;
    return this._db.table('learners').findAll().filter(function(row) { return row.slackUserId === slackUserId; })[0] || null;
  }

  ensureLearnerRecord(input) {
    var existing = this.findLearnerBySlackUserId(input.slackUserId);
    if (existing) return existing;
    return this._db.table('learners').insert({
      slackUserId: input.slackUserId,
      email: input.email || '',
      name: input.name || '',
      status: 'active'
    });
  }

  ensureEnrollmentRecord(input) {
    var existing = this._db.table('enrollment').findAll().filter(function(row) {
      return row.learnerId === input.learnerId && row.courseId === input.courseId;
    })[0];
    if (existing) return existing;
    return this._db.table('enrollment').insert({
      learnerId: input.learnerId,
      courseId: input.courseId,
      track: input.track || 'ONBOARDING',
      status: 'active'
    });
  }

  sendWelcomeDm(input) {
    var dm = this._slack.openDm(input.slackUserId);
    if (!dm.ok) return dm;
    return this._slack.postMessage(dm.channelId, 'Welcome to RWR LMS', this._blocks.buildWelcomeMessage(input));
  }

  queueFirstLesson(input) {
    // TODO: resolve first lesson id from runtime lesson sequencing rules.
    return this._db.table('delivery_queue').insert({
      learnerId: input.learnerId,
      lessonId: '',
      status: 'queued',
      runAt: new Date().toISOString()
    });
  }
}
