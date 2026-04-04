class SlackApiClient {
  constructor(config, retryResolver) {
    this._config = config || {};
    this._retry = retryResolver || null;
    this._token = String(this._config.slackBotToken || this._config.slackBotTokenFallback || '');
  }

  postMessage(channel, text, blocks) {
    if (this._isQuietHours()) {
      return { ok: false, code: 'QUIET_HOURS', message: 'Message suppressed during quiet hours.', retryable: false };
    }
    return this._call('chat.postMessage', { channel: channel, text: text, blocks: blocks || [] });
  }

  postEphemeral(channel, user, text, blocks) {
    return this._call('chat.postEphemeral', { channel: channel, user: user, text: text, blocks: blocks || [] });
  }

  openView(triggerId, view) { return this._call('views.open', { trigger_id: triggerId, view: view }); }
  updateMessage(channel, ts, text, blocks) { return this._call('chat.update', { channel: channel, ts: ts, text: text, blocks: blocks || [] }); }

  openDm(userId) {
    var res = this._call('conversations.open', { users: userId });
    return {
      ok: !!res.ok,
      code: res.code,
      message: res.message,
      retryable: !!res.retryable,
      method: res.method || 'conversations.open',
      status: res.status,
      channelId: res.data && res.data.channel ? res.data.channel.id : ''
    };
  }

  fetchMessageByTs(channel, ts) {
    var res = this._call('conversations.history', {
      channel: channel,
      oldest: ts,
      latest: ts,
      inclusive: true,
      limit: 1
    });
    var message = (res.data && Array.isArray(res.data.messages) && res.data.messages[0]) || null;
    return {
      ok: !!res.ok && !!message,
      code: message ? 'OK' : (res.code || 'MESSAGE_NOT_FOUND'),
      message: message
    };
  }

  _isQuietHours() {
    var start = Number(this._config.quietHoursStart || 21);
    var end = Number(this._config.quietHoursEnd || 7);
    var hour = new Date().getUTCHours() + 12;
    hour = hour % 24;
    if (start > end) return hour >= start || hour < end;
    return hour >= start && hour < end;
  }

  _call(method, payload) {
    if (!this._token) {
      return ErrorService.create('MISSING_BOT_TOKEN', 'SLACK_BOT_TOKEN missing', false);
    }

    var response;
    try {
      response = UrlFetchApp.fetch('https://slack.com/api/' + method, {
        method: 'post',
        contentType: 'application/json; charset=utf-8',
        headers: { Authorization: 'Bearer ' + this._token },
        payload: JSON.stringify(payload || {}),
        muteHttpExceptions: true
      });
    } catch (err) {
      var fetchErr = { ok: false, code: 'HTTP_FETCH_FAILED', message: String(err.message || err), retryable: true, method: method };
      this._queueRetry(method, payload, fetchErr);
      return fetchErr;
    }

    var status = response.getResponseCode();
    var body = {};
    try { body = JSON.parse(response.getContentText() || '{}'); } catch (e) { body = { ok: false, error: 'invalid_json' }; }

    if (status < 200 || status >= 300 || !body.ok) {
      var errShape = {
        ok: false,
        code: body.error || 'SLACK_API_ERROR',
        message: 'Slack API call failed for ' + method,
        retryable: status >= 500 || body.error === 'ratelimited',
        method: method,
        status: status,
        data: body
      };
      this._queueRetry(method, payload, errShape);
      return errShape;
    }

    return { ok: true, code: 'OK', message: 'success', data: body };
  }

  _queueRetry(method, payload, errShape) {
    if (!this._retry || !errShape.retryable) return;
    this._retry.scheduleRetry({
      jobType: 'slack_api:' + method,
      payload: payload,
      lastError: errShape.code
    });
  }
}
