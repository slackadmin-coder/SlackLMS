/**
 * Immutable runtime configuration for the Sheet DB client.
 */
class Config {
  /**
   * @param {Object=} options
   * @param {string=} options.spreadsheetId Spreadsheet ID; defaults to active spreadsheet.
   * @param {string=} options.idColumn Record primary key column name.
   * @param {string=} options.createdAtColumn Created timestamp column name.
   * @param {string=} options.updatedAtColumn Updated timestamp column name.
   * @param {string=} options.deletedAtColumn Soft-delete timestamp column name.
   * @param {number=} options.lockTimeoutMs Lock acquisition timeout for transactions.
   */
  constructor(options) {
    var opts = options || {};
    this.spreadsheetId = opts.spreadsheetId || '';
    this.idColumn = opts.idColumn || 'id';
    this.createdAtColumn = opts.createdAtColumn || 'createdAt';
    this.updatedAtColumn = opts.updatedAtColumn || 'updatedAt';
    this.deletedAtColumn = opts.deletedAtColumn || 'deletedAt';
    this.lockTimeoutMs = Util.isNil(opts.lockTimeoutMs) ? 30000 : Number(opts.lockTimeoutMs);
    this.validate();
    Object.freeze(this);
  }

  /**
   * @return {void}
   */
  validate() {
    var columns = [
      this.idColumn,
      this.createdAtColumn,
      this.updatedAtColumn,
      this.deletedAtColumn
    ];
    var unique = {};
    columns.forEach(function(column) {
      if (!column || typeof column !== 'string') {
        throw new ConfigError('System column names must be non-empty strings.');
      }
      if (unique[column]) {
        throw new ConfigError('System column names must be unique. Duplicate: ' + column);
      }
      unique[column] = true;
    });

    if (isNaN(this.lockTimeoutMs) || this.lockTimeoutMs <= 0) {
      throw new ConfigError('lockTimeoutMs must be a positive number.');
    }
  }
}
