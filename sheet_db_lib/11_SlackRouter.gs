/**
 * Routes incoming host-layer web requests from Slack endpoints.
 */
class SlackRouter {
  /**
   * @param {SlackService} slackService
   * @param {DbClient} dbClient
   */
  constructor(slackService, dbClient) {
    this._slackService = slackService;
    this._db = dbClient;
  }

  /**
   * Handles a web request and routes to slash/workflow service methods.
   * @param {GoogleAppsScript.Events.DoPost} e
   * @return {Object}
   */
  handle(e) {
    var parsed = this._parseEvent(e);
    var context = this._buildRequestContext(parsed);

    try {
      var result;
      if (parsed.type === 'slash_command') {
        result = this._slackService.handleSlashCommand(context, parsed.payload);
      } else if (parsed.type === 'workflow_webhook') {
        result = this._slackService.handleWorkflowWebhook(context, parsed.payload);
      } else {
        result = SlackService.failure('UNSUPPORTED_PAYLOAD', 'Unsupported request payload.', context);
      }

      this._writeAudit(context, result);
      return result;
    } catch (err) {
      var failure = SlackService.failure(
        err.code || 'HOST_ROUTING_ERROR',
        err.message || 'Unexpected host-layer failure.',
        context
      );
      this._writeAudit(context, failure);
      return failure;
    }
  }

  /**
   * Parses incoming POST event into typed route payload.
   * @private
   * @param {GoogleAppsScript.Events.DoPost} e
   * @return {{type: string, payload: Object}}
   */
  _parseEvent(e) {
    var body = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
    var params = this._parseFormEncoded(body);

    if (params.command) {
      return {
        type: 'slash_command',
        payload: this._normalizeSlashCommand(params)
      };
    }

    var jsonPayload = this._parseJsonSafe(body);
    if (jsonPayload) {
      return {
        type: 'workflow_webhook',
        payload: this._normalizeWorkflowWebhook(jsonPayload)
      };
    }

    return { type: 'unknown', payload: {} };
  }

  /**
   * Normalizes Slack slash-command payload shape.
   * @private
   * @param {Object} payload
   * @return {Object}
   */
  _normalizeSlashCommand(payload) {
    return {
      command: String(payload.command || '').trim(),
      text: String(payload.text || '').trim(),
      teamId: String(payload.team_id || ''),
      channelId: String(payload.channel_id || ''),
      userId: String(payload.user_id || ''),
      triggerId: String(payload.trigger_id || ''),
      responseUrl: String(payload.response_url || '')
    };
  }

  /**
   * Normalizes workflow webhook payload shape.
   * @private
   * @param {Object} payload
   * @return {Object}
   */
  _normalizeWorkflowWebhook(payload) {
    var data = payload.data || payload;
    return {
      workflow: String(payload.workflow || payload.workflow_name || 'unknown_workflow'),
      eventType: String(payload.eventType || payload.event_type || 'workflow_event'),
      requestId: String(payload.requestId || payload.request_id || Util.generateId('wf')),
      studentId: String(data.studentId || data.student_id || ''),
      courseId: String(data.courseId || data.course_id || ''),
      actorId: String(data.actorId || data.actor_id || '')
    };
  }

  /**
   * Builds a reusable request context object for service handlers.
   * @private
   * @param {{type: string, payload: Object}} parsed
   * @return {Object}
   */
  _buildRequestContext(parsed) {
    return {
      requestId: parsed.payload.requestId || Util.generateId('req'),
      receivedAt: Util.nowIso(),
      source: parsed.type,
      actor: parsed.payload.userId || parsed.payload.actorId || 'unknown',
      command: parsed.payload.command || '',
      route: parsed.type
    };
  }

  /**
   * Writes audit event through library table API.
   * @private
   * @param {Object} context
   * @param {Object} result
   */
  _writeAudit(context, result) {
    this._db.table('audit_logs').insert({
      requestId: context.requestId,
      source: context.source,
      action: context.command || context.route,
      status: result.ok ? 'success' : 'failure',
      message: result.message,
      metadata: JSON.stringify({
        code: result.code || '',
        data: result.data || null
      })
    });
  }

  /**
   * Parses JSON safely.
   * @private
   * @param {string} raw
   * @return {Object|null}
   */
  _parseJsonSafe(raw) {
    try {
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  /**
   * Parses URL-form-encoded body into object.
   * @private
   * @param {string} body
   * @return {Object}
   */
  _parseFormEncoded(body) {
    var out = {};
    if (!body) {
      return out;
    }

    body.split('&').forEach(function(pair) {
      var tokens = pair.split('=');
      var key = decodeURIComponent(tokens[0] || '').replace(/\+/g, ' ');
      var rawValue = tokens.length > 1 ? tokens.slice(1).join('=') : '';
      var value = decodeURIComponent(rawValue).replace(/\+/g, ' ');
      if (key) {
        out[key] = value;
      }
    });

    return out;
  }
}
