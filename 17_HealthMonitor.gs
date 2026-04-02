class HealthMonitor {
  constructor(db, config) {
    this._db = db;
    this._config = config || {};
  }

  recordJobStatus(jobName, status, metadata) {
    var row = this._db.table('audit_log').insert({
      actor: 'scheduler',
      action: jobName,
      resourceType: 'job',
      resourceId: '',
      status: status,
      message: jobName + ':' + status,
      metadata: JSON.stringify(metadata || {})
    });
    return { ok: true, auditId: row.id };
  }

  recordSlackApiFailure(errorShape) {
    return this.recordJobStatus('slack_api_failure', 'error', errorShape || {});
  }

  getQueueDepthReport() {
    return {
      ok: true,
      deliveryQueue: this._db.table('delivery_queue').findAll().length,
      retryQueue: this._db.table('retry_queue').findAll().length
    };
  }

  getOverdueMetrics() {
    var inProgress = this._db.table('learner_progress').findAll().filter(function(r) { return r.state === 'in_progress' || r.state === 'submitted'; });
    return { ok: true, overdueCount: inProgress.length };
  }

  getSnapshot() {
    return {
      ok: true,
      timestamp: new Date().toISOString(),
      config: ConfigBootstrap.validate(),
      sheetDb: SheetDb.healthCheck(),
      queues: this.getQueueDepthReport(),
      overdue: this.getOverdueMetrics()
    };
  }
}
