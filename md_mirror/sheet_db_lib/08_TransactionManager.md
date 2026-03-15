# 08_TransactionManager.gs

**Source path:** `sheet_db_lib/08_TransactionManager.gs`

```javascript
/**
 * Runs operations under ScriptLock for coarse transaction semantics.
 */
class TransactionManager {
  /**
   * @param {number=} lockTimeoutMs
   */
  constructor(lockTimeoutMs) {
    this._lockTimeoutMs = lockTimeoutMs || 30000;
  }

  /**
   * Executes callback while holding a script lock.
   * @template T
   * @param {function(): T} callback
   * @return {T}
   */
  run(callback) {
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(this._lockTimeoutMs)) {
      throw new TransactionError('Failed to acquire script lock within timeout.');
    }
    try {
      return callback();
    } finally {
      lock.releaseLock();
    }
  }
}

```
