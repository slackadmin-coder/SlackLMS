/**
 * Main entrypoint for interacting with sheet-backed tables.
 */
class DbClient {
  /**
   * @param {Config=} config
   */
  constructor(config) {
    this._config = config || new Config();
    this._schemas = new SchemaRegistry();
    this._sheets = new SheetsGateway(this._config);
    this._audit = new AuditLogger();
    this._tx = new TransactionManager(this._config.lockTimeoutMs);
  }

  /**
   * Registers a table schema.
   * @param {string} tableName
   * @param {Object} schema
   * @return {DbClient}
   */
  registerTable(tableName, schema) {
    this._schemas.register(tableName, schema);
    this._sheets.ensureTable(tableName, schema.columns);
    return this;
  }

  /**
   * Returns a table repository.
   * @param {string} tableName
   * @return {TableRepository}
   */
  table(tableName) {
    this._schemas.get(tableName);
    return new TableRepository(
      tableName,
      this._config,
      this._schemas,
      this._sheets,
      this._audit
    );
  }

  /**
   * Runs a set of operations under lock.
   * @template T
   * @param {function(DbClient): T} callback
   * @return {T}
   */
  transaction(callback) {
    var self = this;
    return this._tx.run(function() {
      return callback(self);
    });
  }
}
