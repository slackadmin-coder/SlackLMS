var SecurityService = {
  verifySlackRequest: function(parsed, config) {
    if (!parsed || !parsed.ok) {
      return ErrorService.create('PARSE_FAILED', parsed && parsed.parseError ? parsed.parseError : 'Invalid payload', false);
    }

    var secret = String((config && config.slackSigningSecret) || '');
    var signature = String(parsed.slackSignature || '');
    var ts = String(parsed.slackTimestamp || '');

    if (!secret) {
      return ErrorService.create('SAFE_MODE_NO_SIGNING_SECRET', 'Signing secret missing; rejecting request in safe mode.', false);
    }

    if (!signature || !ts || !parsed.rawBody) {
      return ErrorService.create('UNVERIFIED', 'Slack signature headers missing.', false);
    }

    var verify = this._verifySignature(secret, signature, ts, parsed.rawBody);
    if (!verify.ok) return verify;

    var replay = this._checkReplay(signature, ts);
    if (!replay.ok) return replay;

    return { ok: true, success: true, code: 'OK' };
  },

  sanitizeInput: function(value) {
    return String(value || '').replace(/[<>]/g, '').replace(/[\u0000-\u001f]/g, '').trim();
  },

  _checkReplay: function(signature, ts) {
    var cache = CacheService.getScriptCache();
    var key = 'slack_replay_' + ts + '_' + signature.slice(0, 24);
    if (cache.get(key)) {
      return ErrorService.create('REPLAY_DETECTED', 'Replay request blocked.', false);
    }
    cache.put(key, '1', 300);
    return { ok: true, success: true, code: 'OK' };
  },

  _verifySignature: function(secret, signature, ts, rawBody) {
    var tsNum = Number(ts);
    if (!tsNum || Math.abs(Math.floor(Date.now() / 1000) - tsNum) > 300) {
      return ErrorService.create('REPLAY_REJECTED', 'Timestamp outside replay window.', false);
    }

    var base = 'v0:' + ts + ':' + rawBody;
    var bytes = Utilities.computeHmacSha256Signature(base, secret);
    var hex = bytes.map(function(b) {
      var n = (b < 0 ? b + 256 : b).toString(16);
      return n.length === 1 ? '0' + n : n;
    }).join('');
    var expected = 'v0=' + hex;

    if (!this._constantTimeEquals(expected, signature)) {
      return ErrorService.create('SIGNATURE_MISMATCH', 'Slack signature mismatch.', false);
    }

    return { ok: true, success: true, code: 'OK' };
  },

  _constantTimeEquals: function(a, b) {
    var aa = String(a || '');
    var bb = String(b || '');
    if (!aa || !bb || aa.length !== bb.length) return false;
    var mismatch = 0;
    for (var i = 0; i < aa.length; i++) mismatch |= (aa.charCodeAt(i) ^ bb.charCodeAt(i));
    return mismatch === 0;
  }
};
