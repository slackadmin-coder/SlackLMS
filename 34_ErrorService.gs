var ErrorService = {
  create: function(errorCode, message, retryable, correlationId) {
    return {
      success: false,
      ok: false,
      error_code: String(errorCode || 'UNKNOWN_ERROR'),
      message: String(message || 'Unexpected error.'),
      retryable: !!retryable,
      correlationId: correlationId || ''
    };
  },

  fromException: function(err, defaultCode, retryable, correlationId) {
    return this.create(
      (err && err.code) || defaultCode || 'UNHANDLED_EXCEPTION',
      (err && err.message) || String(err || 'Unhandled error'),
      retryable,
      correlationId
    );
  }
};
