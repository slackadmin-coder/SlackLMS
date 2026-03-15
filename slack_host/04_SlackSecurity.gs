/**
 * Host-layer security checks for Slack/webhook calls.
 */
class SlackSecurity {
  /**
   * @param {HostConfig} hostConfig
   */
  constructor(hostConfig) {
    this._config = hostConfig;
  }

  /**
   * Best-effort request verification for Apps Script web-app requests.
   * Uses passcode from query/form when available.
   *
   * @param {{routeType: string, payload: Object, envelope: Object}} parsed
   * @return {{ok: boolean, code: string, message: string}}
   */
  verify(parsed) {
    var configured = this._config.getAppPasscode();
    if (!configured) {
      return { ok: true, code: 'NO_PASSCODE_CONFIGURED', message: 'Passcode check skipped.' };
    }

    var params = (parsed.envelope && parsed.envelope.params) ? parsed.envelope.params : {};
    var supplied = String(params.passcode || params.api_key || '');
    if (supplied && supplied === configured) {
      return { ok: true, code: 'AUTHORIZED', message: 'Passcode validated.' };
    }

    return { ok: false, code: 'UNAUTHORIZED', message: 'Invalid or missing passcode.' };
  }
}
