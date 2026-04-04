class IngressQueueService {
  constructor(db, securityService) {
    this._db = db;
    this._security = securityService || SecurityService;
  }

  generateIdempotencyKey(routeType, jobType, payload) {
    var serialized = JSON.stringify({
      routeType: String(routeType || ''),
      jobType: String(jobType || ''),
      payload: payload || {}
    });
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, serialized);
    return 'ik_' + Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '');
  }

  appendJob(input) {
    var nowIso = new Date().toISOString();
    var jobType = this._security.sanitizeInput((input && input.jobType) || '');
    var routeType = this._security.sanitizeInput((input && input.routeType) || '');
    var idempotencyKey = this._security.sanitizeInput((input && input.idempotencyKey) || '');
    var payload = (input && input.payload) || {};
    var requestMeta = (input && input.requestMeta) || {};

    if (!jobType || !routeType || !idempotencyKey) {
      return { ok: false, code: 'INVALID_QUEUE_APPEND', message: 'Missing routeType/jobType/idempotencyKey' };
    }

    var existing = this._db.table('ingress_jobs').findAll().filter(function(row) {
      return row.idempotencyKey === idempotencyKey && row.status !== 'failed';
    })[0];
    if (existing) {
      return { ok: true, code: 'DUPLICATE', duplicate: true, jobId: existing.id, idempotencyKey: idempotencyKey };
    }

    var row = this._db.table('ingress_jobs').insert({
      routeType: routeType,
      jobType: jobType,
      idempotencyKey: idempotencyKey,
      status: 'queued',
      payload: JSON.stringify(payload),
      requestMeta: JSON.stringify(requestMeta),
      attempts: '0',
      availableAt: nowIso,
      lastError: '',
      processedAt: ''
    });

    return { ok: true, code: 'QUEUED', duplicate: false, jobId: row.id, idempotencyKey: idempotencyKey };
  }
}

class QueueProcessor {
  constructor(db, services, queueService, config) {
    this._db = db;
    this._services = services || {};
    this._queue = queueService;
    this._config = config || {};
  }

  processIngressJobs(limit) {
    var max = Number(limit || this._config.ingressJobBatchSize || 20);
    var retryThreshold = Number(this._config.pipelineMaxRetries || 3);
    var now = new Date();
    var nowIso = now.toISOString();
    var table = this._db.table('ingress_jobs');
    var jobs = table.findAll().filter(function(row) {
      if (row.status !== 'queued' && row.status !== 'retry') return false;
      if (!row.availableAt) return true;
      var availableMs = new Date(row.availableAt).getTime();
      return isNaN(availableMs) || availableMs <= now.getTime();
    }).slice(0, max);

    var summary = { ok: true, total: jobs.length, processed: 0, failed: 0, items: [] };
    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      try {
        this._executeJob(job);
        table.update(job.id, { status: 'processed', processedAt: nowIso, updatedAt: nowIso, lastError: '' });
        summary.processed += 1;
        summary.items.push({ id: job.id, ok: true });
      } catch (err) {
        var attempts = Number(job.attempts || 0) + 1;
        var terminal = attempts >= retryThreshold;
        table.update(job.id, {
          attempts: String(attempts),
          status: terminal ? 'failed' : 'retry',
          lastError: String((err && err.message) || err),
          updatedAt: nowIso
        });
        summary.failed += 1;
        summary.items.push({ id: job.id, ok: false, code: (err && err.code) || 'JOB_FAILED', attempts: attempts, failed: terminal });
      }
    }

    return summary;
  }

  _executeJob(job) {
    var payload = this._parseJobJson(job.payload);
    switch (job.jobType) {
      case 'slash.learn':
      case 'slash.mix':
        this._services.lessonService.queueNextEligibleLessonForLearner(payload.userId);
        return;
      case 'slash.submit':
      case 'interactivity.submit_lesson':
      case 'interactivity.modal_submission':
        this._services.completionService.recordSubmission(payload);
        return;
      case 'slash.enroll':
      case 'workflow.enroll':
        this._services.enrollmentService.enrollLearner(payload);
        return;
      case 'interactivity.checklist_mark':
        this._services.onboardingService.advanceOnboardingState(payload.learnerId, payload.checklistItemId, payload.status);
        return;
      case 'event.app_mention':
        this._services.slackApiClient.postMessage(
          payload.channelId,
          'Hi! Commands: `/learn`, `/submit <lesson_id> complete`, `/progress`, `/help`, `/enroll [courseId]`, `/report`, `/onboard [email]`, `/gaps`, `/audit`, `/mix`, `/reinforce`, `/offboard [email]`.',
          []
        );
        return;
      case 'event.message_im':
        var text = String(payload.text || '').toLowerCase();
        var message = 'Welcome! Use `/learn` to get your current lesson, or `/help` for all commands.';
        if (text.indexOf('progress') !== -1) message = 'Use `/progress` for your learner snapshot.';
        if (text.indexOf('help') !== -1) message = 'Need help? Try `/help` for all commands.';
        var dm = this._services.slackApiClient.openDm(payload.userId);
        if (!dm.ok) throw { code: dm.code || 'DM_OPEN_FAILED', message: dm.message || 'Unable to open DM' };
        this._services.slackApiClient.postMessage(dm.channelId, message, []);
        return;
      default:
        throw { code: 'UNSUPPORTED_JOB_TYPE', message: 'Unsupported ingress job type: ' + job.jobType };
    }
  }

  _parseJobJson(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return {};
    }
  }
}
