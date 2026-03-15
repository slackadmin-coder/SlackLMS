/**
 * Parses and normalizes inbound Slack-related payloads.
 */
class SlackPayloadParser {
  /**
   * @param {GoogleAppsScript.Events.DoPost} e
   * @return {{routeType: string, payload: Object, envelope: Object}}
   */
  parseEvent(e) {
    var rawBody = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
    var params = this._parseFormEncoded(rawBody);

    if (params.command) {
      return {
        routeType: 'slash_command',
        payload: this._normalizeSlashCommand(params),
        envelope: { rawBody: rawBody, params: params }
      };
    }

    var jsonPayload = this._parseJson(rawBody);
    if (jsonPayload) {
      return {
        routeType: 'workflow_webhook',
        payload: this._normalizeWorkflowWebhook(jsonPayload),
        envelope: { rawBody: rawBody, json: jsonPayload }
      };
    }

    return { routeType: 'unknown', payload: {}, envelope: { rawBody: rawBody } };
  }

  /** @private */
  _normalizeSlashCommand(payload) {
    return {
      command: String(payload.command || '').trim(),
      text: String(payload.text || '').trim(),
      teamId: String(payload.team_id || ''),
      channelId: String(payload.channel_id || ''),
      userId: String(payload.user_id || ''),
      triggerId: String(payload.trigger_id || ''),
      responseUrl: String(payload.response_url || ''),
      requestId: String(payload.request_id || Util.generateId('slash'))
    };
  }

  /** @private */
  _normalizeWorkflowWebhook(payload) {
    var data = payload.data || payload;
    return {
      workflow: String(payload.workflow || payload.workflow_name || 'unknown_workflow'),
      eventType: String(payload.eventType || payload.event_type || 'workflow_event'),
      requestId: String(payload.requestId || payload.request_id || Util.generateId('wf')),
      studentId: String(data.studentId || data.student_id || ''),
      courseId: String(data.courseId || data.course_id || ''),
      actorId: String(data.actorId || data.actor_id || ''),
      status: String(data.status || '')
    };
  }

  /** @private */
  _parseJson(raw) {
    try {
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  /** @private */
  _parseFormEncoded(body) {
    var out = {};
    if (!body) return out;
    body.split('&').forEach(function(pair) {
      var tokens = pair.split('=');
      var key = decodeURIComponent(tokens[0] || '').replace(/\+/g, ' ');
      var rawValue = tokens.length > 1 ? tokens.slice(1).join('=') : '';
      var value = decodeURIComponent(rawValue).replace(/\+/g, ' ');
      if (key) out[key] = value;
    });
    return out;
  }
}
