/**
 * Script Properties helper for secure and environment-specific configuration.
 */
class ScriptPropertiesHelper {
  /**
   * Creates a helper bound to Script Properties store.
   */
  constructor() {
    this._props = PropertiesService.getScriptProperties();
  }

  /**
   * Returns a property value, or a default when missing.
   * @param {string} key
   * @param {*=} defaultValue
   * @return {*}
   */
  get(key, defaultValue) {
    var value = this._props.getProperty(key);
    return value === null ? defaultValue : value;
  }

  /**
   * Returns a required property value or throws when missing/blank.
   * @param {string} key
   * @return {string}
   */
  getRequired(key) {
    var value = this.get(key, '');
    if (value === '') {
      throw new ConfigError('Missing required script property: ' + key);
    }
    return String(value);
  }

  /**
   * Returns a boolean property value.
   * Accepted true values: true, 1, yes, y, on.
   * Accepted false values: false, 0, no, n, off.
   * @param {string} key
   * @param {boolean=} defaultValue
   * @return {boolean}
   */
  getBoolean(key, defaultValue) {
    var raw = this.get(key, null);
    if (raw === null || raw === '') {
      return defaultValue === undefined ? false : !!defaultValue;
    }
    var normalized = String(raw).trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].indexOf(normalized) !== -1) {
      return true;
    }
    if (['false', '0', 'no', 'n', 'off'].indexOf(normalized) !== -1) {
      return false;
    }
    throw new ConfigError('Script property is not a valid boolean: ' + key);
  }

  /**
   * Returns a numeric property value.
   * @param {string} key
   * @param {number=} defaultValue
   * @return {number}
   */
  getNumber(key, defaultValue) {
    var raw = this.get(key, null);
    if (raw === null || raw === '') {
      return defaultValue === undefined ? 0 : Number(defaultValue);
    }
    var n = Number(raw);
    if (isNaN(n)) {
      throw new ConfigError('Script property is not a valid number: ' + key);
    }
    return n;
  }

  /**
   * Returns all script properties as key-value object.
   * @return {Object<string, string>}
   */
  getAll() {
    return this._props.getProperties();
  }

  /**
   * Returns all script properties with sensitive values redacted.
   * @return {Object<string, string>}
   */
  getAllRedacted() {
    var all = this.getAll();
    var out = {};
    Object.keys(all).forEach(function(key) {
      out[key] = ScriptPropertiesHelper.shouldRedactKey(key) ? '[REDACTED]' : all[key];
    });
    return out;
  }

  /**
   * Sets a script property value.
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    this._props.setProperty(key, String(value));
  }

  /**
   * Sets multiple script properties.
   * @param {Object<string, *>} obj
   */
  setMany(obj) {
    var stringified = {};
    Object.keys(obj || {}).forEach(function(key) {
      stringified[key] = String(obj[key]);
    });
    this._props.setProperties(stringified, false);
  }

  /**
   * Deletes a script property.
   * @param {string} key
   */
  delete(key) {
    this._props.deleteProperty(key);
  }

  /**
   * Returns true when a script property exists and is non-empty.
   * @param {string} key
   * @return {boolean}
   */
  has(key) {
    var value = this._props.getProperty(key);
    return value !== null && value !== '';
  }

  /**
   * Returns true when key should be redacted in debug output.
   * @param {string} key
   * @return {boolean}
   */
  static shouldRedactKey(key) {
    var upper = String(key || '').toUpperCase();
    if (upper === 'APP_PASSCODE' || upper === 'SIGNING_SECRET' || upper === 'WEBHOOK_SECRET' || upper === 'API_KEY') {
      return true;
    }
    return upper.indexOf('TOKEN') !== -1 || upper.indexOf('SECRET') !== -1 || upper.indexOf('PASSWORD') !== -1;
  }
}

/**
 * Reads SheetDb client-related config from Script Properties.
 *
 * Supported keys:
 * - SHEET_DB_SPREADSHEET_ID
 * - SHEET_DB_ID_COLUMN
 * - SHEET_DB_CREATED_AT_COLUMN
 * - SHEET_DB_UPDATED_AT_COLUMN
 * - SHEET_DB_DELETED_AT_COLUMN
 * - SHEET_DB_LOCK_TIMEOUT_MS
 *
 * Also reserved for host-layer secure use:
 * - APP_PASSCODE
 * - SIGNING_SECRET
 * - WEBHOOK_SECRET
 * - API_KEY
 *
 * @return {Object}
 */
function readSheetDbConfigFromScriptProperties() {
  var helper = new ScriptPropertiesHelper();
  var config = {};

  if (helper.has('SHEET_DB_SPREADSHEET_ID')) {
    config.spreadsheetId = helper.get('SHEET_DB_SPREADSHEET_ID', '');
  }
  if (helper.has('SHEET_DB_ID_COLUMN')) {
    config.idColumn = helper.get('SHEET_DB_ID_COLUMN', 'id');
  }
  if (helper.has('SHEET_DB_CREATED_AT_COLUMN')) {
    config.createdAtColumn = helper.get('SHEET_DB_CREATED_AT_COLUMN', 'createdAt');
  }
  if (helper.has('SHEET_DB_UPDATED_AT_COLUMN')) {
    config.updatedAtColumn = helper.get('SHEET_DB_UPDATED_AT_COLUMN', 'updatedAt');
  }
  if (helper.has('SHEET_DB_DELETED_AT_COLUMN')) {
    config.deletedAtColumn = helper.get('SHEET_DB_DELETED_AT_COLUMN', 'deletedAt');
  }
  if (helper.has('SHEET_DB_LOCK_TIMEOUT_MS')) {
    config.lockTimeoutMs = helper.getNumber('SHEET_DB_LOCK_TIMEOUT_MS', 30000);
  }

  return config;
}

/**
 * Merges explicit client options with script properties-based config.
 * Precedence: explicit options > script properties > hardcoded defaults.
 *
 * @param {Object=} options
 * @return {Object}
 */
function mergeClientOptionsWithScriptProperties(options) {
  var fromProps = readSheetDbConfigFromScriptProperties();
  var explicit = options || {};
  var merged = {};
  Object.keys(fromProps).forEach(function(key) {
    merged[key] = fromProps[key];
  });
  Object.keys(explicit).forEach(function(key) {
    merged[key] = explicit[key];
  });
  return merged;
}

/**
 * Example setup helper for consumers (manual one-time setup).
 *
 * Example:
 * PropertiesService.getScriptProperties().setProperty('SHEET_DB_SPREADSHEET_ID', '...');
 */
function exampleSetSheetDbScriptProperties() {
  // Intentionally no-op; serves as in-library usage documentation only.
}
