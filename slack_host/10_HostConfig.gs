/**
 * Host-layer configuration backed by Script Properties.
 */
class HostConfig {
  /**
   * @param {ScriptPropertiesHelper=} helper
   */
  constructor(helper) {
    this._props = helper || new ScriptPropertiesHelper();
  }

  /** @return {string} */
  getAppPasscode() { return this._props.get('APP_PASSCODE', ''); }
  /** @return {string} */
  getSigningSecret() { return this._props.get('SIGNING_SECRET', ''); }
  /** @return {string} */
  getWebhookSecret() { return this._props.get('WEBHOOK_SECRET', ''); }
  /** @return {string} */
  getApiKey() { return this._props.get('API_KEY', ''); }
  /** @return {string} */
  getSlackBotToken() { return this._props.get('SLACK_BOT_TOKEN', ''); }
  /** @return {string} */
  getSlackSigningSecret() { return this._props.get('SLACK_SIGNING_SECRET', this.getSigningSecret()); }
  /** @return {string} */
  getSlackDefaultChannel() { return this._props.get('SLACK_DEFAULT_CHANNEL', ''); }

  /**
   * @return {Object}
   */
  getClientOverrides() {
    return mergeClientOptionsWithScriptProperties({});
  }
}
