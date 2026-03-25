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
    return { ok: true, code: 'ENROLLED', learnerId: learner.id, enrollmentId: enrollment.id, queueId: queued.queueId || '' };
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
    var lessons = this._db.table('lessons').findAll().filter(function(row) {
      return row.courseId === input.courseId && String(row.active) === 'true' && !String(row.deletedAt || '').trim();
    }).sort(function(a, b) {
      return Number(a.sequenceNumber || 0) - Number(b.sequenceNumber || 0);
    });

    var firstLesson = lessons[0];
    if (!firstLesson) {
      return { ok: false, code: 'NO_LESSONS_AVAILABLE', message: 'No active lessons found for course.' };
    }

    var existingProgress = this._db.table('learner_progress').findAll().filter(function(row) {
      return row.learnerId === input.learnerId && row.lessonId === firstLesson.id;
    })[0];

    if (existingProgress && existingProgress.state !== 'completed') {
      return {
        ok: true,
        code: 'FIRST_LESSON_QUEUED',
        learnerId: input.learnerId,
        lessonId: firstLesson.id,
        queueId: '',
        progressId: existingProgress.id
      };
    }

    var nowIso = new Date().toISOString();
    this._db.table('learner_progress').insert({
      learnerId: input.learnerId,
      lessonId: firstLesson.id,
      state: 'queued',
      dueAt: nowIso
    });

    var queueRow = this._db.table('delivery_queue').insert({
      learnerId: input.learnerId,
      lessonId: firstLesson.id,
      status: 'queued',
      runAt: nowIso
    });

    return { ok: true, code: 'FIRST_LESSON_QUEUED', learnerId: input.learnerId, lessonId: firstLesson.id, queueId: queueRow.id };
  }
}
