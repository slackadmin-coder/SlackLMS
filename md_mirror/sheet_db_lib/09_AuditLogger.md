# 09_AuditLogger.gs

**Source path:** `sheet_db_lib/09_AuditLogger.gs`

```javascript
/**
 * Minimal pluggable audit logger.
 */
class AuditLogger {
  /**
   * @param {Object=} options
   * @param {Function=} options.sink Optional custom sink function.
   */
  constructor(options) {
    var opts = options || {};
    this._sink = opts.sink || function(entry) {
      Logger.log(JSON.stringify(entry));
    };
  }

  /**
   * Emits an audit entry.
   * @param {string} action
   * @param {string} tableName
   * @param {Object=} metadata
   */
  log(action, tableName, metadata) {
    this._sink({
      at: Util.nowIso(),
      action: action,
      table: tableName,
      metadata: Util.clone(metadata || {})
    });
  }
}

```
