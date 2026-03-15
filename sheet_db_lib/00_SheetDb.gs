/**
 * @fileoverview Public top-level API for the Sheet DB library.
 */

/**
 * Creates a new database client.
 *
 * @param {Object=} options Client configuration options.
 * @return {DbClient}
 */
function createSheetDbClient(options) {
  return new DbClient(new Config(options || {}));
}
