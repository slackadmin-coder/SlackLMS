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

  /**
   * Ensures Wave 1 managed sheets exist with exact headers.
   * @param {SheetsGateway} sheetsGateway
   * @param {AuditLogger=} auditLogger
   * @return {{ok: boolean, created: number, migrated: number, validated: number, steps: Array<Object>}}
   */
  enforceWave1ManagedTables(sheetsGateway, auditLogger) {
    var gateway = sheetsGateway;
    var logger = auditLogger || new AuditLogger({ sink: function() {} });
    var requiredTables = DbSchema.CONTRACT.TABLES;
    var tableNames = Object.keys(requiredTables);
    var summary = { ok: true, created: 0, migrated: 0, validated: 0, steps: [] };

    for (var i = 0; i < tableNames.length; i++) {
      var tableName = tableNames[i];
      var headers = requiredTables[tableName];
      var sheet = gateway.getSheet(tableName, true);
      var lastRow = sheet.getLastRow();

      if (lastRow === 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        summary.created += 1;
        summary.steps.push({ table: tableName, action: 'created' });
        this._writeMigrationAudit(logger, 'schema_table_created', tableName, { headerCount: headers.length });
        continue;
      }

      var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
        .map(function(value) { return String(value || '').trim(); });
      if (this._headersMatch(existingHeaders, headers)) {
        summary.validated += 1;
        continue;
      }

      if (tableName === DbSchema.LESSONS.TABLE) {
        var lessonMigration = this._migrateLessonsSheetToWave1(sheet, existingHeaders, headers);
        if (lessonMigration.migrated) {
          summary.migrated += 1;
          summary.steps.push({ table: tableName, action: 'migrated', changedRows: lessonMigration.changedRows });
          this._writeMigrationAudit(logger, 'schema_lessons_migrated', tableName, {
            previousHeaderCount: existingHeaders.length,
            headerCount: headers.length,
            changedRows: lessonMigration.changedRows
          });
          continue;
        }
      }

      throw new StorageError('Header mismatch for managed table: ' + tableName);
    }

    var progressMigration = this.migrateLearnerProgressStateValues(gateway, logger);
    summary.progressUpdates = progressMigration.updated;
    if (progressMigration.updated > 0) {
      summary.migrated += 1;
      summary.steps.push({ table: DbSchema.LEARNER_PROGRESS.TABLE, action: 'state_migrated', updated: progressMigration.updated });
    }

    return summary;
  }

  /**
   * Migrates legacy learner progress values into Wave 1 states.
   * @param {SheetsGateway} sheetsGateway
   * @param {AuditLogger=} auditLogger
   * @return {{ok: boolean, total: number, updated: number}}
   */
  migrateLearnerProgressStateValues(sheetsGateway, auditLogger) {
    var gateway = sheetsGateway;
    var logger = auditLogger || new AuditLogger({ sink: function() {} });
    var tableName = DbSchema.LEARNER_PROGRESS.TABLE;
    var expectedHeaders = DbSchema.WAVE1.LEARNER_PROGRESS_COLUMNS;

    gateway.ensureTable(tableName, expectedHeaders);
    var tableData = gateway.readTable(tableName);
    var stateMachine = new LearnerProgressStateMachine();
    var updated = 0;

    for (var i = 0; i < tableData.rows.length; i++) {
      var rowObj = Util.rowToObject(tableData.headers, tableData.rows[i]);
      var currentState = String(rowObj.state || '').trim().toLowerCase();
      var normalized = stateMachine.normalizeState(currentState);
      if (currentState !== normalized) {
        rowObj.state = normalized;
        rowObj.updatedAt = Util.nowIso();
        if (normalized === stateMachine.states.COMPLETED && !rowObj.completedAt) {
          rowObj.completedAt = rowObj.updatedAt;
        }
        tableData.rows[i] = Util.objectToRow(expectedHeaders, rowObj);
        updated += 1;
      }
    }

    if (updated > 0) {
      gateway.writeAllRows(tableName, expectedHeaders, tableData.rows);
      this._writeMigrationAudit(logger, 'learner_progress_state_migrated', tableName, {
        updated: updated,
        allowedStates: DbSchema.WAVE1.LEARNER_PROGRESS_STATES.slice()
      });
    }

    return { ok: true, total: tableData.rows.length, updated: updated };
  }

  _headersMatch(existingHeaders, expectedHeaders) {
    if (existingHeaders.length !== expectedHeaders.length) return false;
    for (var i = 0; i < expectedHeaders.length; i++) {
      if (String(existingHeaders[i]) !== String(expectedHeaders[i])) return false;
    }
    return true;
  }

  _migrateLessonsSheetToWave1(sheet, existingHeaders, expectedHeaders) {
    var legacyHeaderAliases = {
      course_id: 'courseId',
      module_id: 'moduleId',
      sequence_number: 'sequenceNumber',
      core_content: 'coreContent',
      mission_type: 'missionType',
      mission_duration: 'missionDuration',
      submit_block: 'submitBlock',
      content_ref: 'contentRef',
      slack_payload: 'slackPayload',
      lesson_type: 'lessonType',
      estimated_minutes: 'estimatedMinutes',
      delivery_channel: 'deliveryChannel',
      release_at: 'releaseAt',
      sunset_at: 'sunsetAt',
      source_ref: 'sourceRef',
      created_at: 'createdAt',
      updated_at: 'updatedAt',
      deleted_at: 'deletedAt'
    };

    var defaults = {
      active: 'true',
      lessonType: 'standard',
      estimatedMinutes: '5',
      prerequisites: '',
      tags: '',
      deliveryChannel: 'slack_dm',
      releaseAt: '',
      sunsetAt: '',
      locale: 'en-US',
      owner: 'system',
      status: 'active',
      version: '1',
      qaStatus: 'pending',
      qaScore: '',
      qaReviewer: '',
      qaDate: '',
      sourceRef: '',
      migrationNotes: 'wave1',
      createdAt: '',
      updatedAt: '',
      deletedAt: ''
    };

    var idx = {};
    for (var i = 0; i < existingHeaders.length; i++) {
      var header = String(existingHeaders[i] || '').trim();
      var normalized = legacyHeaderAliases[header] || header;
      idx[normalized] = i;
    }

    var values = sheet.getDataRange().getValues();
    var rows = values.length > 1 ? values.slice(1) : [];
    var rewrittenRows = [];

    for (var r = 0; r < rows.length; r++) {
      var source = rows[r];
      var migrated = [];
      for (var c = 0; c < expectedHeaders.length; c++) {
        var key = expectedHeaders[c];
        if (idx.hasOwnProperty(key) && !Util.isNil(source[idx[key]]) && source[idx[key]] !== '') {
          migrated.push(source[idx[key]]);
        } else if (defaults.hasOwnProperty(key)) {
          migrated.push(defaults[key]);
        } else {
          migrated.push('');
        }
      }
      rewrittenRows.push(migrated);
    }

    sheet.clearContents();
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    if (rewrittenRows.length > 0) {
      sheet.getRange(2, 1, rewrittenRows.length, expectedHeaders.length).setValues(rewrittenRows);
    }

    return { migrated: true, changedRows: rewrittenRows.length };
  }

  _writeMigrationAudit(auditLogger, action, tableName, metadata) {
    if (!auditLogger || typeof auditLogger.log !== 'function') return;
    auditLogger.log(action, tableName, metadata || {});
  }
}
