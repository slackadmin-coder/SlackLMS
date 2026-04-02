class WorkflowEngine {
  constructor(auditFn, logger) {
    this._audit = auditFn || function() {};
    this._logger = logger || Logger;
  }

  run(name, payload, handlers) {
    var correlationId = this._buildCorrelationId(name);
    var ctx = {
      workflow: name,
      correlationId: correlationId,
      trigger: payload || {},
      data: {},
      result: null
    };

    try {
      this._executeStep('trigger', handlers.trigger, ctx);
      this._executeStep('validate', handlers.validate, ctx);
      this._executeStep('process', handlers.process, ctx);
      this._executeStep('persist', handlers.persist, ctx);
      this._executeStep('respond', handlers.respond, ctx);
      this._executeStep('audit', handlers.audit, ctx);
      return ctx.result || { ok: true, correlationId: correlationId };
    } catch (err) {
      var normalized = ErrorService.fromException(err, 'WORKFLOW_FAILED', true, correlationId);
      this._safeAudit(name + '_failed', { correlationId: correlationId, error: normalized });
      return normalized;
    }
  }

  _executeStep(stepName, fn, ctx) {
    if (typeof fn !== 'function') return;
    var started = Date.now();
    fn(ctx);
    this._logger.log(JSON.stringify({
      level: 'info',
      workflow: ctx.workflow,
      step: stepName,
      durationMs: Date.now() - started,
      correlationId: ctx.correlationId
    }));
  }

  _safeAudit(action, metadata) {
    try { this._audit(action, metadata || {}); } catch (err) {}
  }

  _buildCorrelationId(name) {
    return (name || 'workflow') + '_' + new Date().getTime() + '_' + Math.random().toString(36).slice(2, 8);
  }
}
