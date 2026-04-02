class RetryResolver {
  constructor(db, config, configRepo) {
    this._db = db;
    this._config = config || {};
    this._configRepo = configRepo || null;
    this._maxAttempts = Number(this._config.pipelineMaxRetries || 5);
  }

  isRetryable(errorShape) {
    if (!errorShape) return false;
    if (errorShape.retryable) return true;
    return ['HTTP_FETCH_FAILED', 'ratelimited', 'internal_error', 'SLACK_API_ERROR'].indexOf(String(errorShape.code || errorShape.error_code || '')) !== -1;
  }

  scheduleRetry(job) {
    if (this._configRepo && !this._configRepo.getFlag('enable_retry', true)) {
      return { ok: false, code: 'RETRY_DISABLED' };
    }

    var payload = job || {};
    var attempts = Number(payload.attempts || 0);
    return this._db.table('retry_queue').insert({
      jobType: payload.jobType || 'unknown',
      payload: JSON.stringify(payload.payload || {}),
      attempts: String(attempts),
      nextRunAt: payload.nextRunAt || this._computeNextRunAt(attempts),
      status: 'queued',
      lastError: payload.lastError || '',
      correlationId: payload.correlationId || ''
    });
  }

  resolveDueRetries(limit) {
    var max = Number(limit || 20);
    var now = Date.now();
    var due = this._db.table('retry_queue').findAll().filter(function(r) {
      return r.status === 'queued' && (!r.nextRunAt || new Date(r.nextRunAt).getTime() <= now);
    }).slice(0, max);
    return { ok: true, dueCount: due.length, rows: due };
  }

  markAttempt(rowId, attempts, lastError) {
    var nextAttempts = Number(attempts || 0) + 1;
    var dead = nextAttempts >= this._maxAttempts;
    return this._db.table('retry_queue').update(rowId, {
      attempts: String(nextAttempts),
      status: dead ? 'dead_letter' : 'queued',
      lastError: lastError || '',
      nextRunAt: this._computeNextRunAt(nextAttempts)
    });
  }

  _computeNextRunAt(attempts) {
    var waitMs = Math.min(3600000, Math.pow(2, Number(attempts || 0)) * 60000);
    return new Date(Date.now() + waitMs).toISOString();
  }
}
