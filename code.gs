/*******************************************************
 * RWR LMS — Slack Web App Anchor (thin host shell)
 *******************************************************/

const CONFIG = Object.freeze({
  ACTOR_SYSTEM: 'system'
});

function doGet() {
  return textResponse_('alive');
}

function doPost(e) {
  var correlationId = 'req_' + new Date().getTime() + '_' + Math.random().toString(36).slice(2, 8);
  try {
    var config = resolveHostConfig();
    var deps = createHostDependencies(config);
    var parsed = SlackPayloadParser.parse(e);
    var verified = SlackSecurity.verify(parsed, config);

    if (!verified.ok) {
      deps.audit('request_denied', {
        correlationId: correlationId,
        code: verified.code || verified.error_code,
        routeType: parsed.routeType
      });
      return jsonResponse_(verified);
    }

    var routed = SlackRouter.route(parsed, deps);
    deps.audit('request_routed', {
      correlationId: correlationId,
      routeType: parsed.routeType,
      ok: !!routed.ok,
      code: routed.code || ''
    });

    return jsonResponse_(routed.response || ErrorService.create('MISSING_RESPONSE', 'missing_response', false, correlationId));
  } catch (err) {
    try {
      logAuditExact_({
        actor: CONFIG.ACTOR_SYSTEM,
        action: 'doPost_error',
        status: 'error',
        correlationId: correlationId,
        message: safeError_(err)
      });
    } catch (logErr) {}

    return jsonResponse_(ErrorService.create('HOST_ERROR', 'Something went wrong in the Slack handler.', true, correlationId));
  }
}
function textResponse_(text) {
  return ContentService.createTextOutput(String(text || '')).setMimeType(ContentService.MimeType.TEXT);
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj || {})).setMimeType(ContentService.MimeType.JSON);
}

function logAuditExact_(entry) {
  Logger.log(JSON.stringify(sanitizeObjectForLog_(entry || {})));
}

function safeError_(err) {
  return (err && err.message) ? String(err.message) : String(err);
}

function sanitizeObjectForLog_(obj) {
  var clean = {};
  Object.keys(obj || {}).forEach(function(key) {
    var lower = String(key).toLowerCase();
    if (lower.indexOf('token') !== -1 || lower.indexOf('secret') !== -1 || lower.indexOf('authorization') !== -1) {
      clean[key] = '[REDACTED]';
      return;
    }
    clean[key] = String(obj[key] == null ? '' : obj[key]);
  });
  return clean;
}
