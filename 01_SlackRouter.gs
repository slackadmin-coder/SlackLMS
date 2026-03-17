/**
 * Central request router for normalized Slack envelopes.
 */
var SlackRouter = {
  route: function(parsed, deps) {
    if (!parsed || !parsed.ok) {
      return { ok: false, code: 'PARSE_FAILED', response: { ok: false, error: 'invalid_request' } };
    }

    if (parsed.routeType === 'url_verification') {
      return { ok: true, code: 'URL_VERIFICATION', response: { challenge: parsed.body.challenge } };
    }

    if (parsed.routeType === 'slash_command') {
      return { ok: true, code: 'SLASH_OK', response: deps.slackService.handleSlashCommand(parsed) };
    }

    if (parsed.routeType === 'interactivity') {
      return { ok: true, code: 'INTERACTIVITY_OK', response: deps.slackService.handleInteractivity(parsed) };
    }

    if (parsed.routeType === 'event_callback') {
      return { ok: true, code: 'EVENT_OK', response: deps.slackService.handleEventCallback(parsed) };
    }

    if (parsed.routeType === 'workflow_webhook') {
      return { ok: true, code: 'WORKFLOW_OK', response: deps.slackService.handleWorkflowWebhook(parsed) };
    }

    return {
      ok: false,
      code: 'UNSUPPORTED_ROUTE',
      response: { ok: false, error: 'unsupported_route', routeType: parsed.routeType }
    };
  }
};
