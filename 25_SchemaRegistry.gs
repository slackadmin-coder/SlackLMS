/**
 * Holds table schemas and applies field defaults/validation.
 */
class SchemaRegistry {
  /**
   * Creates a new in-memory schema registry.
   */
  constructor() {
    this._schemas = {};
  }

  /**
   * Registers a table schema.
   * @param {string} tableName
   * @param {Object} schema
   * @param {Array<string>} schema.columns Ordered columns for persistence.
   * @param {Object<string, Object>=} schema.fields Optional field constraints.
   * @return {SchemaRegistry}
   */
  register(tableName, schema) {
    if (!tableName) {
      throw new SchemaError('Table name is required.');
    }
    if (!schema || !Array.isArray(schema.columns) || schema.columns.length === 0) {
      throw new SchemaError('Schema for ' + tableName + ' must provide non-empty columns array.');
    }
    var seen = {};
    schema.columns.forEach(function(column) {
      if (!column || typeof column !== 'string') {
        throw new SchemaError('All columns must be non-empty strings for table: ' + tableName);
      }
      if (seen[column]) {
        throw new SchemaError('Duplicate column "' + column + '" in table: ' + tableName);
      }
      seen[column] = true;
    });

    var fields = Util.clone(schema.fields || {});
    Object.keys(fields).forEach(function(fieldName) {
      if (!seen[fieldName]) {
        throw new SchemaError(
          'Field rules defined for unknown column "' + fieldName + '" in table: ' + tableName
        );
      }
    });

    this._schemas[tableName] = {
      columns: schema.columns.slice(),
      fields: fields
    };
    return this;
  }

  /**
   * Returns schema for a table.
   * @param {string} tableName
   * @return {Object}
   */
  get(tableName) {
    var schema = this._schemas[tableName];
    if (!schema) {
      throw new SchemaError('No schema registered for table: ' + tableName);
    }
    return {
      columns: schema.columns.slice(),
      fields: Util.clone(schema.fields)
    };
  }

  /**
   * Validates and normalizes a record.
   * @param {string} tableName
   * @param {Object} record
   * @param {boolean=} isPartial True for patch-like updates.
   * @return {Object}
   */
  normalizeRecord(tableName, record, isPartial) {
    var schema = this.get(tableName);
    var out = Util.clone(record || {});
    schema.columns.forEach(function(column) {
      var fieldRules = schema.fields[column] || {};
      var hasValue = !Util.isNil(out[column]);

      if (!hasValue && fieldRules.hasOwnProperty('default')) {
        var defaultValue = fieldRules.default;
        out[column] = typeof defaultValue === 'function' ? defaultValue() : defaultValue;
      }

      if (!isPartial && fieldRules.required && Util.isNil(out[column])) {
        throw new ValidationError('Field "' + column + '" is required.');
      }

      if (!Util.isNil(out[column]) && fieldRules.type) {
        var expected = fieldRules.type;
        var actual = Object.prototype.toString.call(out[column]).slice(8, -1).toLowerCase();
        if (actual !== expected.toLowerCase()) {
          throw new ValidationError(
            'Field "' + column + '" expected type ' + expected + ' but got ' + actual + '.'
          );
        }
      }
    });

    return out;
  }
}
