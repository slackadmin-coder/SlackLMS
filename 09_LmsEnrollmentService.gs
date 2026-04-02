class LmsEnrollmentService {
  constructor(db, slackApiClient, blocks, config, repositories, workflowEngine, securityService) {
    this._db = db;
    this._slack = slackApiClient;
    this._blocks = blocks;
    this._config = config || {};
    this._repos = repositories || {};
    this._workflow = workflowEngine;
    this._security = securityService || SecurityService;
  }

  enrollLearner(input) {
    var self = this;
    return this._workflow.run('enrollment', input || {}, {
      validate: function(ctx) {
        var slackUserId = self._security.sanitizeInput(ctx.trigger.slackUserId);
        if (!slackUserId) throw { code: 'INVALID_INPUT', message: 'slackUserId is required.' };
        ctx.data.slackUserId = slackUserId;
      },
      process: function(ctx) {
        ctx.data.learner = self.ensureLearnerRecord({
          slackUserId: ctx.data.slackUserId,
          email: self._security.sanitizeInput(ctx.trigger.email || ''),
          name: self._security.sanitizeInput(ctx.trigger.name || '')
        });

        ctx.data.enrollment = self.ensureEnrollmentRecord({
          learnerId: ctx.data.learner.id,
          courseId: self._security.sanitizeInput(ctx.trigger.courseId || self._config.defaultCourseId),
          track: self._config.defaultTrack
        });

        ctx.data.queue = self.queueFirstLesson({
          learnerId: ctx.data.learner.id,
          courseId: ctx.data.enrollment.courseId
        });
      },
      persist: function(ctx) {
        self.sendWelcomeDm({
          slackUserId: ctx.data.learner.slackUserId,
          learnerId: ctx.data.learner.id,
          courseId: ctx.data.enrollment.courseId
        });
      },
      respond: function(ctx) {
        ctx.result = {
          ok: true,
          code: 'ENROLLED',
          learnerId: ctx.data.learner.id,
          enrollmentId: ctx.data.enrollment.id,
          queueId: ctx.data.queue.queueId || '',
          correlationId: ctx.correlationId
        };
      },
      audit: function(ctx) {
        self._db.audit('enroll_learner', 'enrollment', { learnerId: ctx.data.learner.id, enrollmentId: ctx.data.enrollment.id, correlationId: ctx.correlationId });
      }
    });
  }

  findLearnerBySlackUserId(slackUserId) {
    return this._repos.learnerRepo.findBySlackUserId(slackUserId);
  }

  ensureLearnerRecord(input) {
    var existing = this.findLearnerBySlackUserId(input.slackUserId);
    if (existing) return existing;
    return this._repos.learnerRepo.insert({
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
    var firstLesson = this._repos.lessonRepo.findActiveByCourse(input.courseId)[0];
    if (!firstLesson) {
      return { ok: false, code: 'NO_LESSONS_AVAILABLE', message: 'No active lessons found for course.' };
    }

    var existingProgress = this._repos.progressRepo.findByLearnerAndLesson(input.learnerId, firstLesson.id);

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
    this._repos.progressRepo.insert({
      learnerId: input.learnerId,
      lessonId: firstLesson.id,
      state: 'queued',
      dueAt: nowIso
    });

    var queueRow = this._db.table('delivery_queue').insert({
      learnerId: input.learnerId,
      lessonId: firstLesson.id,
      status: 'queued',
      priority: 'normal',
      runAt: nowIso,
      attempts: '0',
      availableAt: nowIso,
      conditionExpr: ''
    });

    return { ok: true, code: 'FIRST_LESSON_QUEUED', learnerId: input.learnerId, lessonId: firstLesson.id, queueId: queueRow.id };
  }
}
