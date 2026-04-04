/**
 * Base error for the Sheet DB library.
 */
class SheetDbError extends Error {
  /**
   * @param {string} message Human-readable error message.
   * @param {string=} code Stable error code for programmatic handling.
   */
  constructor(message, code) {
    super(message);
    this.name = this.constructor.name;
    this.code = code || 'SHEET_DB_ERROR';
  }
}

/**
 * Raised when configuration is invalid or missing.
 */
class ConfigError extends SheetDbError {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message, 'CONFIG_ERROR');
  }
}

/**
 * Raised when schema definitions are invalid.
 */
class SchemaError extends SheetDbError {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message, 'SCHEMA_ERROR');
  }
}

/**
 * Raised when records fail validation.
 */
class ValidationError extends SheetDbError {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message, 'VALIDATION_ERROR');
  }
}

/**
 * Raised when underlying sheet operations fail.
 */
class StorageError extends SheetDbError {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message, 'STORAGE_ERROR');
  }
}

/**
 * Raised for optimistic transaction failures.
 */
class TransactionError extends SheetDbError {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message, 'TRANSACTION_ERROR');
  }
}

/**
 * Raised when a write attempts to mutate an append-only audit table.
 */
class AuditAppendOnlyViolationError extends SheetDbError {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message, 'AUDIT_APPEND_ONLY_VIOLATION');
  }
}
