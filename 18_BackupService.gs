class BackupService {
  constructor(db, config) {
    this._db = db;
    this._config = config || {};
  }

  runDailyBackup() {
    var backupFolderId = this._config.backupFolderId || '';
    if (!backupFolderId) {
      this._db.table('audit_log').insert({
        actor: 'scheduler',
        action: 'daily_backup',
        resourceType: 'job',
        resourceId: '',
        status: 'error',
        message: 'BACKUP_FOLDER_ID not configured',
        metadata: JSON.stringify({})
      });
      return { ok: false, code: 'BACKUP_FOLDER_NOT_CONFIGURED' };
    }
    this._db.table('audit_log').insert({
      actor: 'scheduler',
      action: 'daily_backup',
      resourceType: 'job',
      resourceId: '',
      status: 'info',
      message: 'Backup stub executed — implementation pending',
      metadata: JSON.stringify({ folderId: backupFolderId })
    });
    return { ok: true, code: 'BACKUP_STUB', message: 'Backup stub — not yet implemented.' };
  }
}
