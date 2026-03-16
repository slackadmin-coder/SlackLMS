# 04_Util.gs

**Source path:** `sheet_db_lib/04_Util.gs`

```javascript
/**
 * Utility helpers for Sheet DB.
 */
class Util {
  /**
   * @return {string} RFC3339 timestamp in UTC.
   */
  static nowIso() {
    return new Date().toISOString();
  }

  /**
   * Creates a shallow clone of an object.
   * @param {Object} source
   * @return {Object}
   */
  static clone(source) {
    return Object.assign({}, source || {});
  }

  /**
   * Creates a stable row ID with a prefix.
   * @param {string=} prefix
   * @return {string}
   */
  static generateId(prefix) {
    var p = prefix || 'row';
    var random = Math.random().toString(36).slice(2, 10);
    return p + '_' + new Date().getTime() + '_' + random;
  }

  /**
   * Returns true when value is null or undefined.
   * @param {*} value
   * @return {boolean}
   */
  static isNil(value) {
    return value === null || value === undefined;
  }

  /**
   * Returns true when value is empty string, null, or undefined.
   * @param {*} value
   * @return {boolean}
   */
  static isBlank(value) {
    return value === '' || Util.isNil(value);
  }

  /**
   * Throws when a required condition is not met.
   * @param {boolean} condition
   * @param {string} message
   */
  static assert(condition, message) {
    if (!condition) {
      throw new ValidationError(message);
    }
  }

  /**
   * Converts a sheet row to an object using the header order.
   * @param {string[]} headers
   * @param {Array<*>} row
   * @return {Object}
   */
  static rowToObject(headers, row) {
    var out = {};
    for (var i = 0; i < headers.length; i++) {
      out[headers[i]] = row[i];
    }
    return out;
  }

  /**
   * Converts an object to row array by header order.
   * @param {string[]} headers
   * @param {Object} obj
   * @return {Array<*>}
   */
  static objectToRow(headers, obj) {
    return headers.map(function(h) {
      return obj[h];
    });
  }
}

```
