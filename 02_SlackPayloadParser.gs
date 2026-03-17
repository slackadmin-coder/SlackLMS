/**
 * Normalizes Slack requests to a single envelope.
 */
var SlackPayloadParser = {
  parse: function(e) {
    var rawBody = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : '';
    var params = (e && e.parameter) ? e.parameter : {};
    var headers = (e && e.headers) ? e.headers : {};
    var body = this._parseJson(rawBody);
    var interaction = params.payload ? this._parseJson(params.payload) : null;
    var parseOk = true;

    if (!body && rawBody && String((e.postData && e.postData.type) || '').indexOf('application/json') !== -1) {
      parseOk = false;
    }

    body = body || {};

    var routeType = 'unknown';
    if (body.type === 'url_verification') routeType = 'url_verification';
    else if (params.command) routeType = 'slash_command';
    else if (interaction) routeType = 'interactivity';
    else if (body.type === 'event_callback') routeType = 'event_callback';
    else if (body.workflow_step || params.workflow) routeType = 'workflow_webhook';

    var source = interaction || body || params;
    return {
      ok: parseOk,
      routeType: routeType,
      rawBody: rawBody,
      body: body,
      params: params,
      command: String(params.command || ''),
      payloadType: String((interaction && interaction.type) || body.type || ''),
      userId: this._pick(source, ['user.id', 'user_id', 'event.user']),
      channelId: this._pick(source, ['channel.id', 'channel_id', 'event.channel']),
      teamId: this._pick(source, ['team.id', 'team_id']),
      triggerId: this._pick(source, ['trigger_id']),
      responseUrl: this._pick(source, ['response_url']),
      slackSignature: String(headers['x-slack-signature'] || headers['X-Slack-Signature'] || params.x_slack_signature || ''),
      slackTimestamp: String(headers['x-slack-request-timestamp'] || headers['X-Slack-Request-Timestamp'] || params.x_slack_request_timestamp || ''),
      interaction: interaction,
      parseError: parseOk ? '' : 'Invalid JSON body'
    };
  },

  _parseJson: function(text) {
    try { return JSON.parse(text); } catch (err) { return null; }
  },

  _pick: function(obj, paths) {
    var i;
    for (i = 0; i < paths.length; i++) {
      var value = this._get(obj, paths[i]);
      if (value) return String(value);
    }
    return '';
  },

  _get: function(obj, path) {
    return String(path || '').split('.').reduce(function(acc, key) {
      return (acc && acc[key] != null) ? acc[key] : '';
    }, obj || {});
  }
};
