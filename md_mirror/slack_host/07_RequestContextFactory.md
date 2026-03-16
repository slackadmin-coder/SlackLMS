# 07_RequestContextFactory.gs

**Source path:** `slack_host/07_RequestContextFactory.gs`

```javascript
/**
 * Creates normalized request-context objects for host handlers.
 */
class RequestContextFactory {
  /**
   * @param {HostConfig} hostConfig
   */
  constructor(hostConfig) {
    this._config = hostConfig;
  }

  /**
   * @param {string} routeType
   * @param {Object} payload
   * @param {Object=} envelope
   * @return {Object}
   */
  create(routeType, payload, envelope) {
    var env = envelope || {};
    return {
      requestId: payload.requestId || Util.generateId('req'),
      receivedAt: Util.nowIso(),
      routeType: routeType,
      source: routeType,
      actorId: payload.userId || payload.actorId || 'unknown',
      teamId: payload.teamId || '',
      channelId: payload.channelId || this._config.getSlackDefaultChannel(),
      raw: env.rawBody || ''
    };
  }
}

```
