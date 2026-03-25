var ConfigBootstrap = {
  load: function() {
    var helper = new ScriptPropertiesHelper();
    return {
      slackBotToken: helper.getRequired('SLACK_BOT_TOKEN'),
      slackSigningSecret: helper.getRequired('SLACK_SIGNING_SECRET'),
      spreadsheetId: helper.get('SHEET_DB_SPREADSHEET_ID', helper.getRequired('SPREADSHEET_ID')),
      adminUserIds: this._csv(helper.get('ADMIN_USER_IDS', '')),
      defaultCourseId: helper.get('DEFAULT_COURSE_ID', 'C001'),
      defaultTrack: helper.get('DEFAULT_TRACK', 'ONBOARDING'),
      opsAlertChannel: helper.get('OPS_ALERT_CHANNEL', ''),
      appsheetWebhookToken: helper.get('APPSHEET_WEBHOOK_TOKEN', ''),
      onCallUserId: helper.get('ON_CALL_USER_ID', ''),
      backupFolderId: helper.get('BACKUP_FOLDER_ID', ''),
      qaPassThreshold: Number(helper.get('QA_PASS_THRESHOLD', '70')),
      qaStrongPassThreshold: Number(helper.get('QA_STRONG_PASS_THRESHOLD', '85')),
      pipelineMaxRetries: Number(helper.get('PIPELINE_MAX_RETRIES', '3')),
      latencyWarningMs: Number(helper.get('LATENCY_WARNING_MS', '8000')),
      latencyCriticalMs: Number(helper.get('LATENCY_CRITICAL_MS', '15000')),
      maintenanceMode: helper.get('MAINTENANCE_MODE', 'false') === 'true',
      healthCheckEnabled: helper.get('HEALTH_CHECK_ENABLED', 'true') === 'true',
      quietHoursStart: Number(helper.get('QUIET_HOURS_START', '21')),
      quietHoursEnd: Number(helper.get('QUIET_HOURS_END', '7'))
    };
  },

  validate: function() {
    try {
      this.load();
      return { ok: true, code: 'OK', message: 'Configuration valid.' };
    } catch (err) {
      return { ok: false, code: 'CONFIG_INVALID', message: String(err.message || err) };
    }
  },

  get: function(key, fallback) {
    var cfg = this.load();
    return cfg.hasOwnProperty(key) ? cfg[key] : fallback;
  },

  _csv: function(text) {
    return String(text || '').split(',').map(function(v) { return v.trim(); }).filter(function(v) { return !!v; });
  }
};
