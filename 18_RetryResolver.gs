class RetryResolver {
  constructor(db, config) {
    this._db = db;
    this._config = config || {};
    this._maxAttempts = 5;
  }

  isRetryable(errorShape) {
    if (!errorShape) return false;
    if (errorShape.retryable) return true;
    return ['HTTP_FETCH_FAILED', 'ratelimited', 'internal_error'].indexOf(String(errorShape.code || '')) !== -1;
  }

  scheduleRetry(job) {
    var payload = job || {};
    return this._db.table('retry_queue').insert({
      jobType: payload.jobType || 'unknown',
      payload: JSON.stringify(payload.payload || {}),
      attempts: String(payload.attempts || 0),
      nextRunAt: payload.nextRunAt || new Date().toISOString(),
      status: 'queued',
      lastError: payload.lastError || ''
    });
  }

  resolveDueRetries(limit) {
    var max = Number(limit || 20);
    var due = this._db.table('retry_queue').findAll().filter(function(r) { return r.status === 'queued'; }).slice(0, max);
    return { ok: true, dueCount: due.length, rows: due };
  }

  markAttempt(rowId, attempts, lastError) {
    var nextAttempts = Number(attempts || 0) + 1;
    var dead = nextAttempts >= this._maxAttempts;
    return this._db.table('retry_queue').update(rowId, {
      attempts: String(nextAttempts),
      status: dead ? 'dead_letter' : 'queued',
      lastError: lastError || '',
      nextRunAt: new Date(Date.now() + Math.pow(2, nextAttempts) * 60000).toISOString()
    });
  }
}
