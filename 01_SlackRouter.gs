/**
 * Central request router for normalized Slack envelopes.
 */
var SlackRouter = {
  _routeRegistry: {
    url_verification: 'handleUrlVerification',
    slash_command: 'handleSlashCommand',
    interactivity: 'handleInteractivity',
    event_callback: 'handleEventCallback',
    workflow_webhook: 'handleWorkflowWebhook'
  },

  route: function(parsed, deps, requestContext) {
    if (!parsed || !parsed.ok) {
      return { ok: false, code: 'PARSE_FAILED', response: ErrorService.create('PARSE_FAILED', 'invalid_request', false) };
    }

    if (parsed.routeType === 'url_verification') {
      return { ok: true, code: 'URL_VERIFICATION', response: { challenge: parsed.body.challenge } };
    }

    var handlerName = this._routeRegistry[parsed.routeType];
    if (!handlerName || !deps.slackService || typeof deps.slackService[handlerName] !== 'function') {
      return {
        ok: false,
        code: 'UNSUPPORTED_ROUTE',
        response: ErrorService.create('UNSUPPORTED_ROUTE', 'unsupported_route: ' + parsed.routeType, false)
      };
    }

    return { ok: true, code: parsed.routeType.toUpperCase(), response: deps.slackService[handlerName](parsed, requestContext || {}) };
  }
};
