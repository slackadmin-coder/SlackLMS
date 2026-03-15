/**
 * @fileoverview Public, library-visible exports for SheetDb.
 */

/**
 * Library semantic version.
 *
 * NOTE: Keep this in sync with release tags when publishing as an Apps Script library.
 * @type {string}
 */
var SHEET_DB_VERSION = '0.1.0';

/**
 * Creates a new SheetDb client instance.
 *
 * @param {Object=} options Client configuration options.
 * @return {DbClient}
 */
function _sheetDbCreateClient(options) {
  return new DbClient(new Config(options || {}));
}

/**
 * Bootstraps a client with one or more table schemas.
 *
 * @param {Object=} options
 * @param {Array<{name: string, schema: Object}>=} options.tables Tables to register.
 * @param {Object=} options.clientOptions Configuration passed to `createClient`.
 * @return {DbClient}
 */
function _sheetDbBootstrap(options) {
  var opts = options || {};
  var client = _sheetDbCreateClient(opts.clientOptions || {});
  var tables = opts.tables || [];

  tables.forEach(function(table) {
    if (table && table.name && table.schema) {
      client.registerTable(table.name, table.schema);
    }
  });

  return client;
}

/**
 * Basic health check that can be called by consuming projects.
 *
 * @return {{ok: boolean, version: string, timestamp: string, details: Object}}
 */
function _sheetDbHealthCheck() {
  try {
    var client = _sheetDbCreateClient();
    return {
      ok: !!client,
      version: SHEET_DB_VERSION,
      timestamp: Util.nowIso(),
      details: {
        clientReady: true,
        spreadsheetMode: client._config && client._config.spreadsheetId ? 'by_id' : 'active'
      }
    };
  } catch (err) {
    return {
      ok: false,
      version: SHEET_DB_VERSION,
      timestamp: new Date().toISOString(),
      details: {
        code: err.code || 'HEALTH_CHECK_FAILED',
        message: err.message || 'Unknown error.'
      }
    };
  }
}

/**
 * Public Apps Script library namespace.
 *
 * Consumers should call library exports through this object:
 * `LibraryIdentifier.SheetDb.createClient(...)`.
 *
 * @type {{
 *   createClient: function(Object=): DbClient,
 *   bootstrap: function(Object=): DbClient,
 *   healthCheck: function(): Object,
 *   version: string
 * }}
 */
var SheetDb = {
  createClient: function(options) {
    return _sheetDbCreateClient(options);
  },

  bootstrap: function(options) {
    return _sheetDbBootstrap(options);
  },

  healthCheck: function() {
    return _sheetDbHealthCheck();
  },

  version: SHEET_DB_VERSION
};

/**
 * Backward-compatible factory export.
 * @deprecated Use `SheetDb.createClient` instead.
 * @param {Object=} options
 * @return {DbClient}
 */
function createSheetDbClient(options) {
  return SheetDb.createClient(options);
}
