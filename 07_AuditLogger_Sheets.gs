/**
 * Creates an AuditLogger instance wired to the audit_log Sheets table.
 * Use this in createHostDependencies() instead of relying on the library default.
 * @param {DbClient} db
 * @return {AuditLogger}
 */
function createSheetsAuditLogger(db) {
  return new AuditLogger({
    sink: function(entry) {
      try {
        db.table('audit_log').insert({
          actor: entry.actor || 'system',
          action: entry.action,
          resourceType: entry.table || '',
          resourceId: (entry.metadata && entry.metadata.id) ? String(entry.metadata.id) : '',
          status: 'info',
          message: entry.action,
          metadata: JSON.stringify(entry.metadata || {})
        });
      } catch (sinkErr) {
        Logger.log('AuditLogger Sheets sink failed: ' + String(sinkErr));
      }
    }
  });
}
