# 01_SlackRouter.gs

**Source path:** `slack_host/01_SlackRouter.gs`

```javascript
/**
 * HTTP router boundary: parse -> verify -> context -> app service.
 */
class SlackRouter {
  /**
   * @param {SlackPayloadParser} parser
   * @param {SlackSecurity} security
   * @param {RequestContextFactory} contextFactory
   * @param {SlackService} slackService
   * @param {ResultFormatter} resultFormatter
   * @param {DbClient} db
   */
  constructor(parser, security, contextFactory, slackService, resultFormatter, db) {
    this._parser = parser;
    this._security = security;
    this._contexts = contextFactory;
    this._service = slackService;
    this._results = resultFormatter;
    this._db = db;
  }

  /**
   * @param {GoogleAppsScript.Events.DoPost} e
   * @return {Object}
   */
  handle(e) {
    var parsed = this._parser.parseEvent(e);
    var context = this._contexts.create(parsed.routeType, parsed.payload, parsed.envelope);

    var auth = this._security.verify(parsed);
    if (!auth.ok) {
      var denied = this._results.failure(auth.code, auth.message, context, {});
      this._writeAudit(context, denied);
      return denied;
    }

    var result;
    try {
      if (parsed.routeType === 'slash_command') {
        result = this._service.handleSlashCommand(context, parsed.payload);
      } else if (parsed.routeType === 'workflow_webhook') {
        result = this._service.handleWorkflowWebhook(context, parsed.payload);
      } else {
        result = this._results.failure('UNSUPPORTED_PAYLOAD', 'Unsupported payload.', context, {});
      }
    } catch (err) {
      result = this._results.failure(err.code || 'HOST_ERROR', err.message || 'Unexpected error.', context, {});
    }

    this._writeAudit(context, result);
    return result;
  }

  /** @private */
  _writeAudit(context, result) {
    this._db.table('audit_logs').insert({
      requestId: context.requestId,
      source: context.source,
      action: context.routeType,
      status: result.ok ? 'success' : 'failure',
      message: result.message,
      metadata: JSON.stringify({ code: result.code, requestId: result.requestId })
    });
  }
}

```
