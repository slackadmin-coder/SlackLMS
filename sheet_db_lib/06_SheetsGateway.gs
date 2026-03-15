/**
 * Thin wrapper around SpreadsheetApp APIs.
 */
class SheetsGateway {
  /**
   * @param {Config} config
   */
  constructor(config) {
    this._config = config;
  }

  /**
   * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
   */
  getSpreadsheet() {
    if (this._config.spreadsheetId) {
      return SpreadsheetApp.openById(this._config.spreadsheetId);
    }
    return SpreadsheetApp.getActiveSpreadsheet();
  }

  /**
   * @param {string} tableName
   * @param {boolean=} createWhenMissing
   * @return {GoogleAppsScript.Spreadsheet.Sheet}
   */
  getSheet(tableName, createWhenMissing) {
    var ss = this.getSpreadsheet();
    var sheet = ss.getSheetByName(tableName);
    if (!sheet && createWhenMissing) {
      sheet = ss.insertSheet(tableName);
    }
    if (!sheet) {
      throw new StorageError('Sheet not found for table: ' + tableName);
    }
    return sheet;
  }

  /**
   * @param {string} tableName
   * @return {{headers: string[], rows: Array<Array<*>>}}
   */
  readTable(tableName) {
    var sheet = this.getSheet(tableName, false);
    var range = sheet.getDataRange();
    var values = range.getValues();
    if (values.length === 0) {
      return { headers: [], rows: [] };
    }
    return {
      headers: values[0],
      rows: values.slice(1)
    };
  }

  /**
   * Ensures table exists with given headers.
   * @param {string} tableName
   * @param {string[]} headers
   */
  ensureTable(tableName, headers) {
    var sheet = this.getSheet(tableName, true);
    var lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      return;
    }

    var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(function(value) { return String(value); });
    var expectedHeaders = headers.map(function(value) { return String(value); });
    if (existingHeaders.join('|') !== expectedHeaders.join('|')) {
      throw new StorageError('Header mismatch for table: ' + tableName);
    }
  }

  /**
   * Writes all rows for a table, replacing existing body rows.
   * @param {string} tableName
   * @param {string[]} headers
   * @param {Array<Array<*>>} rows
   */
  writeAllRows(tableName, headers, rows) {
    var sheet = this.getSheet(tableName, true);
    this.ensureTable(tableName, headers);

    var maxRows = Math.max(sheet.getMaxRows(), rows.length + 1);
    if (sheet.getMaxRows() < maxRows) {
      sheet.insertRowsAfter(sheet.getMaxRows(), maxRows - sheet.getMaxRows());
    }

    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).clearContent();
    }

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
  }
}
