# 08_ResultFormatter.gs

**Source path:** `slack_host/08_ResultFormatter.gs`

```javascript
/**
 * Formats host operation results into structured Slack-friendly objects.
 */
class ResultFormatter {
  /**
   * @param {string} message
   * @param {Object=} data
   * @param {Object=} context
   * @return {Object}
   */
  success(message, data, context) {
    return {
      ok: true,
      code: 'OK',
      message: message,
      requestId: (context && context.requestId) || '',
      data: data || {},
      slack: {
        response_type: 'ephemeral',
        text: message
      }
    };
  }

  /**
   * @param {string} code
   * @param {string} message
   * @param {Object=} context
   * @param {Object=} data
   * @return {Object}
   */
  failure(code, message, context, data) {
    return {
      ok: false,
      code: code || 'ERROR',
      message: message || 'Unknown error.',
      requestId: (context && context.requestId) || '',
      data: data || {},
      slack: {
        response_type: 'ephemeral',
        text: ':warning: ' + (message || 'Unknown error.')
      }
    };
  }
}

```
