/**
 * Slack security verifier (signing secret + replay + fallback mode).
 */
var SlackSecurity = {
  verify: function(parsed, config) {
    if (!parsed || !parsed.ok) {
      return { ok: false, code: 'PARSE_FAILED', message: parsed && parsed.parseError ? parsed.parseError : 'Invalid payload' };
    }

    var secret = String((config && config.slackSigningSecret) || '');
    var signature = String(parsed.slackSignature || '');
    var ts = String(parsed.slackTimestamp || '');

    if (secret && signature && ts && parsed.rawBody) {
      return this._verifySignature(secret, signature, ts, parsed.rawBody);
    }

    return { ok: false, code: 'UNVERIFIED', message: 'Slack signature headers unavailable and signing credentials are missing or incomplete.' };
  },

  _verifySignature: function(secret, signature, ts, rawBody) {
    var tsNum = Number(ts);
    if (!tsNum || Math.abs(Math.floor(Date.now() / 1000) - tsNum) > 300) {
      return { ok: false, code: 'REPLAY_REJECTED', message: 'Timestamp outside replay window.' };
    }

    var base = 'v0:' + ts + ':' + rawBody;
    var bytes = Utilities.computeHmacSha256Signature(base, secret);
    var hex = bytes.map(function(b) {
      var n = (b < 0 ? b + 256 : b).toString(16);
      return n.length === 1 ? '0' + n : n;
    }).join('');
    var expected = 'v0=' + hex;

    if (!this._constantTimeEquals(expected, signature)) {
      return { ok: false, code: 'SIGNATURE_MISMATCH', message: 'Slack signature mismatch.' };
    }

    return { ok: true, code: 'OK', message: 'Signature verified.' };
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
