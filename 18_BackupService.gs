class BackupService {
  constructor(db, config) {
    this._db = db;
    this._config = config || {};
  }

  runDailyBackup() {
    var backupFolderId = this._config.backupFolderId || '';
    if (!backupFolderId) {
      this._audit('error', 'BACKUP_FOLDER_ID not configured', {
        code: 'BACKUP_FOLDER_NOT_CONFIGURED'
      });
      return { ok: false, code: 'BACKUP_FOLDER_NOT_CONFIGURED', message: 'BACKUP_FOLDER_ID not configured' };
    }

    var folder;
    try {
      folder = DriveApp.getFolderById(backupFolderId);
    } catch (err) {
      this._audit('error', 'Backup folder could not be opened', {
        code: 'BACKUP_FOLDER_INACCESSIBLE',
        folderId: backupFolderId,
        error: String(err && err.message ? err.message : err)
      });
      return { ok: false, code: 'BACKUP_FOLDER_INACCESSIBLE', message: 'Backup folder is inaccessible' };
    }

    var timestampIso = new Date().toISOString();
    var timestampToken = Utilities.formatDate(new Date(timestampIso), 'UTC', 'yyyyMMdd_HHmmss');
    var schemaVersion = String(this._config.backupSchemaVersion || '1');
    var tables = this._resolveTables();
    var artifacts = [];
    var tableStats = {};
    var retention = this._normalizeRetentionDays(this._config.backupRetentionDays);

    try {
      for (var i = 0; i < tables.length; i++) {
        var tableName = tables[i];
        var rows = this._db.table(tableName).findAll();
        tableStats[tableName] = rows.length;

        var payload = {
          manifest: {
            schemaVersion: schemaVersion,
            timestamp: timestampIso,
            table: tableName,
            rowCount: rows.length
          },
          rows: rows
        };
        var jsonText = JSON.stringify(payload, null, 2);
        payload.manifest.checksum = this._checksum(jsonText);
        jsonText = JSON.stringify(payload, null, 2);

        var jsonFile = folder.createFile(
          this._artifactName(tableName, timestampToken, 'json'),
          jsonText,
          MimeType.PLAIN_TEXT
        );
        artifacts.push({
          id: jsonFile.getId(),
          name: jsonFile.getName(),
          table: tableName,
          type: 'json',
          rowCount: rows.length
        });

        var csvText = this._toCsv(rows);
        var csvFile = folder.createFile(
          this._artifactName(tableName, timestampToken, 'csv'),
          csvText,
          MimeType.CSV
        );
        artifacts.push({
          id: csvFile.getId(),
          name: csvFile.getName(),
          table: tableName,
          type: 'csv',
          rowCount: rows.length
        });
      }

      var runManifest = {
        timestamp: timestampIso,
        schemaVersion: schemaVersion,
        tableCounts: tableStats,
        artifacts: artifacts
      };
      runManifest.checksum = this._checksum(JSON.stringify(runManifest));

      var manifestFile = folder.createFile(
        'backup_manifest_' + timestampToken + '.json',
        JSON.stringify(runManifest, null, 2),
        MimeType.PLAIN_TEXT
      );
      artifacts.push({
        id: manifestFile.getId(),
        name: manifestFile.getName(),
        table: 'manifest',
        type: 'json',
        rowCount: 0
      });

      var retentionResult = this._applyRetention(folder, retention);

      this._audit('success', 'Daily backup completed', {
        code: 'BACKUP_SUCCESS',
        folderId: backupFolderId,
        retentionDays: retention,
        deletedArtifactCount: retentionResult.deletedCount,
        deletedArtifactIds: retentionResult.deletedIds,
        artifacts: artifacts,
        tableCounts: tableStats
      });

      return {
        ok: true,
        code: 'BACKUP_SUCCESS',
        folderId: backupFolderId,
        artifactCount: artifacts.length,
        tableCounts: tableStats,
        deletedArtifactCount: retentionResult.deletedCount
      };
    } catch (err2) {
      this._audit('error', 'Daily backup failed', {
        code: 'BACKUP_FAILED',
        folderId: backupFolderId,
        artifacts: artifacts,
        tableCounts: tableStats,
        error: String(err2 && err2.message ? err2.message : err2)
      });
      return {
        ok: false,
        code: 'BACKUP_FAILED',
        message: String(err2 && err2.message ? err2.message : err2)
      };
    }
  }

  _resolveTables() {
    if (Array.isArray(this._config.backupTables) && this._config.backupTables.length > 0) {
      return this._config.backupTables;
    }
    return [
      'learners',
      'enrollment',
      'lessons',
      'learner_progress',
      'submission_log',
      'delivery_queue',
      'retry_queue',
      'audit_log',
      'courses',
      'modules',
      'onboarding_requests',
      'onboarding_checklists',
      'onboarding_task_log',
      'lesson_qa_records',
      'app_config'
    ];
  }

  _artifactName(tableName, timestampToken, ext) {
    return 'backup_' + tableName + '_' + timestampToken + '.' + ext;
  }

  _normalizeRetentionDays(raw) {
    var n = Number(raw);
    if (isNaN(n) || n < 1) {
      return 30;
    }
    return Math.floor(n);
  }

  _applyRetention(folder, retentionDays) {
    var deletedIds = [];
    var millis = retentionDays * 24 * 60 * 60 * 1000;
    var cutoff = new Date(Date.now() - millis);
    var files = folder.getFiles();

    while (files.hasNext()) {
      var file = files.next();
      var name = file.getName();
      if (name.indexOf('backup_') !== 0) {
        continue;
      }
      if (file.getDateCreated().getTime() < cutoff.getTime()) {
        deletedIds.push(file.getId());
        file.setTrashed(true);
      }
    }

    return { deletedCount: deletedIds.length, deletedIds: deletedIds };
  }

  _checksum(text) {
    var input = String(text || '');
    var hash = 0;
    for (var i = 0; i < input.length; i++) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash |= 0;
    }
    return 'h' + Math.abs(hash);
  }

  _toCsv(rows) {
    if (!rows || rows.length === 0) {
      return '';
    }
    var headers = Object.keys(rows[0]);
    var out = [headers.join(',')];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var cols = headers.map(function(h) {
        var v = row[h];
        if (v === null || v === undefined) {
          return '';
        }
        var text = String(v);
        if (text.indexOf('"') !== -1) {
          text = text.replace(/"/g, '""');
        }
        if (text.indexOf(',') !== -1 || text.indexOf('\n') !== -1 || text.indexOf('"') !== -1) {
          text = '"' + text + '"';
        }
        return text;
      });
      out.push(cols.join(','));
    }
    return out.join('\n');
  }

  _audit(status, message, metadata) {
    this._db.table('audit_log').insert({
      actor: 'scheduler',
      action: 'daily_backup',
      resourceType: 'job',
      resourceId: '',
      status: status,
      message: message,
      metadata: JSON.stringify(metadata || {})
    });
  }
}
