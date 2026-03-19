/**
 * CRUD repository for a specific table.
 */
class TableRepository {
  /**
   * @param {string} tableName
   * @param {Config} config
   * @param {SchemaRegistry} schemaRegistry
   * @param {SheetsGateway} sheetsGateway
   * @param {AuditLogger} auditLogger
   */
  constructor(tableName, config, schemaRegistry, sheetsGateway, auditLogger) {
    this._tableName = tableName;
    this._config = config;
    this._schemas = schemaRegistry;
    this._sheets = sheetsGateway;
    this._audit = auditLogger;
  }

  /**
   * @return {Array<Object>}
   */
  findAll() {
    var schema = this._schemas.get(this._tableName);
    this._sheets.ensureTable(this._tableName, schema.columns);
    var data = this._sheets.readTable(this._tableName);
    return data.rows
      .map(function(row) { return Util.rowToObject(data.headers, row); })
      .filter(function(record) { return Util.isBlank(record[this._config.deletedAtColumn]); }, this);
  }

  /**
   * @param {string} id
   * @return {Object|null}
   */
  findById(id) {
    var rows = this.findAll();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][this._config.idColumn] === id) {
        return rows[i];
      }
    }
    return null;
  }

  /**
   * @param {Object} payload
   * @return {Object}
   */
  insert(payload) {
    var schema = this._schemas.get(this._tableName);
    this._sheets.ensureTable(this._tableName, schema.columns);
    var record = this._schemas.normalizeRecord(this._tableName, payload, false);
    var now = Util.nowIso();
    record[this._config.idColumn] = record[this._config.idColumn] || Util.generateId(this._tableName);
    record[this._config.createdAtColumn] = record[this._config.createdAtColumn] || now;
    record[this._config.updatedAtColumn] = now;
    if (!record.hasOwnProperty(this._config.deletedAtColumn)) {
      record[this._config.deletedAtColumn] = '';
    }

    var tableData = this._sheets.readTable(this._tableName);
    var existingRows = tableData.rows.map(function(row) { return Util.rowToObject(tableData.headers, row); });
    var idColumn = this._config.idColumn;
    var duplicate = existingRows.some(function(row) {
      return row[idColumn] === record[idColumn];
    });
    if (duplicate) {
      throw new ValidationError('Record ID already exists: ' + record[idColumn]);
    }
    existingRows.push(record);
    var rowValues = existingRows.map(function(r) { return Util.objectToRow(schema.columns, r); });
    this._sheets.writeAllRows(this._tableName, schema.columns, rowValues);
    this._audit.log('insert', this._tableName, { id: record[this._config.idColumn] });
    return record;
  }

  /**
   * @param {string} id
   * @param {Object} patch
   * @return {Object}
   */
  update(id, patch) {
    var schema = this._schemas.get(this._tableName);
    var normalizedPatch = this._schemas.normalizeRecord(this._tableName, patch, true);
    var tableData = this._sheets.readTable(this._tableName);
    var records = tableData.rows.map(function(row) { return Util.rowToObject(tableData.headers, row); });
    var found = null;

    for (var i = 0; i < records.length; i++) {
      if (records[i][this._config.idColumn] === id) {
        found = records[i];
        Object.keys(normalizedPatch).forEach(function(key) {
          if (key !== this._config.idColumn && key !== this._config.createdAtColumn) {
            found[key] = normalizedPatch[key];
          }
        }, this);
        found[this._config.updatedAtColumn] = Util.nowIso();
        break;
      }
    }

    if (!found) {
      throw new StorageError('Record not found for id: ' + id);
    }

    var rowValues = records.map(function(r) { return Util.objectToRow(schema.columns, r); });
    this._sheets.writeAllRows(this._tableName, schema.columns, rowValues);
    this._audit.log('update', this._tableName, { id: id, fields: Object.keys(normalizedPatch) });
    return found;
  }

  /**
   * Soft-deletes a record.
   * @param {string} id
   * @return {Object}
   */
  remove(id) {
    var result = this.update(id, (function(col, now) {
      var patch = {};
      patch[col] = now;
      return patch;
    })(this._config.deletedAtColumn, Util.nowIso()));
    this._audit.log('remove', this._tableName, { id: id });
    return result;
  }
}
