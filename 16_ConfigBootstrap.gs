var ConfigBootstrap = {
  load: function() {
    var helper = new ScriptPropertiesHelper();
    return {
      slackBotToken: helper.getRequired('SLACK_BOT_TOKEN'),
      slackSigningSecret: helper.getRequired('SLACK_SIGNING_SECRET'),
      spreadsheetId: helper.get('SHEET_DB_SPREADSHEET_ID', helper.getRequired('SPREADSHEET_ID')),
      slackVerificationToken: helper.get('SLACK_VERIFICATION_TOKEN', ''),
      adminUserIds: this._csv(helper.get('ADMIN_USER_IDS', '')),
      defaultCourseId: helper.get('DEFAULT_COURSE_ID', 'C001'),
      defaultTrack: helper.get('DEFAULT_TRACK', 'ONBOARDING'),
      opsAlertChannel: helper.get('OPS_ALERT_CHANNEL', '')
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
