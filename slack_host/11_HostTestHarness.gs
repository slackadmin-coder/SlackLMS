/**
 * Manual Apps Script test harness for the split Slack host architecture.
 */

/**
 * Builds host dependencies for manual tests.
 * Uses TEST_SPREADSHEET_ID script property when available.
 * @return {{db: DbClient, hostConfig: HostConfig, router: SlackRouter}}
 */
function _buildHostTestContext() {
  var props = new ScriptPropertiesHelper();
  var testSpreadsheetId = props.get('TEST_SPREADSHEET_ID', '');
  var options = testSpreadsheetId ? { spreadsheetId: testSpreadsheetId } : {};

  var db = SheetDb.createClientFromScriptProperties(options);

  db.schema('students', {
    columns: ['id', 'name', 'source', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      id: { required: true, type: 'string' },
      name: { required: true, type: 'string' },
      source: { default: 'slack', type: 'string' }
    }
  });

  db.schema('enrollments', {
    columns: ['id', 'studentId', 'courseId', 'status', 'source', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      studentId: { required: true, type: 'string' },
      courseId: { required: true, type: 'string' },
      status: { default: 'enrolled', type: 'string' },
      source: { default: 'slack', type: 'string' }
    }
  });

  db.schema('automations', {
    columns: ['id', 'requestId', 'workflow', 'eventType', 'state', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      requestId: { required: true, type: 'string' },
      workflow: { required: true, type: 'string' },
      eventType: { required: true, type: 'string' },
      state: { default: 'received', type: 'string' }
    }
  });

  db.schema('audit_logs', {
    columns: ['id', 'requestId', 'source', 'action', 'status', 'message', 'metadata', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      requestId: { required: true, type: 'string' },
      source: { required: true, type: 'string' },
      action: { required: true, type: 'string' },
      status: { required: true, type: 'string' },
      message: { type: 'string' },
      metadata: { type: 'string' }
    }
  });

  var hostConfig = new HostConfig(props);
  var router = createHostRouter(db, hostConfig);
  return { db: db, hostConfig: hostConfig, router: router };
}

/**
 * Encodes form payload.
 * @param {Object} obj
 * @return {string}
 */
function _toFormBody(obj) {
  return Object.keys(obj).map(function(key) {
    return encodeURIComponent(key) + '=' + encodeURIComponent(String(obj[key]));
  }).join('&');
}

/**
 * Builds a mock DoPost event object.
 * @param {string} body
 * @return {GoogleAppsScript.Events.DoPost}
 */
function _mockDoPostEvent(body) {
  return {
    postData: {
      contents: body,
      type: 'application/x-www-form-urlencoded'
    }
  };
}

/**
 * testSlashEnrollMock
 * Simulates `/enroll-student` and runs full router path.
 */
function testSlashEnrollMock() {
  var ctx = _buildHostTestContext();
  var suffix = new Date().getTime();
  var passcode = ctx.hostConfig.getAppPasscode();
  var payload = {
    command: '/enroll-student',
    text: 'student-' + suffix + ' course-' + suffix,
    user_id: 'U_TEST_' + suffix,
    team_id: 'T_TEST',
    channel_id: 'C_TEST'
  };
  if (passcode) {
    payload.passcode = passcode;
  }

  var event = _mockDoPostEvent(_toFormBody(payload));
  var result = ctx.router.handle(event);
  Logger.log('[testSlashEnrollMock] ' + JSON.stringify(result));
}

/**
 * testWorkflowEnrollmentMock
 * Simulates `enrollment_requested` workflow webhook and runs full router path.
 */
function testWorkflowEnrollmentMock() {
  var ctx = _buildHostTestContext();
  var suffix = new Date().getTime();
  var payload = {
    workflow: 'lms_enrollment',
    eventType: 'enrollment_requested',
    requestId: 'wf_req_' + suffix,
    data: {
      studentId: 'wf-student-' + suffix,
      courseId: 'wf-course-' + suffix,
      actorId: 'WF_ACTOR'
    }
  };
  var event = _mockDoPostEvent(JSON.stringify(payload));
  var result = ctx.router.handle(event);
  Logger.log('[testWorkflowEnrollmentMock] ' + JSON.stringify(result));
}

/**
 * testAutomationMock
 * Simulates generic automation workflow webhook and runs full router path.
 */
function testAutomationMock() {
  var ctx = _buildHostTestContext();
  var suffix = new Date().getTime();
  var payload = {
    workflow: 'lms_automation',
    eventType: 'automation_ping',
    requestId: 'automation_req_' + suffix,
    data: {
      status: 'queued',
      actorId: 'AUTO_ACTOR'
    }
  };
  var event = _mockDoPostEvent(JSON.stringify(payload));
  var result = ctx.router.handle(event);
  Logger.log('[testAutomationMock] ' + JSON.stringify(result));
}

/**
 * testHostConfig
 * Verifies host config reads script properties without logging raw secrets.
 */
function testHostConfig() {
  var props = new ScriptPropertiesHelper();
  var hostConfig = new HostConfig(props);
  var keys = [
    'APP_PASSCODE',
    'SIGNING_SECRET',
    'WEBHOOK_SECRET',
    'API_KEY',
    'SLACK_BOT_TOKEN',
    'SLACK_SIGNING_SECRET',
    'SLACK_DEFAULT_CHANNEL'
  ];

  var values = {
    APP_PASSCODE: hostConfig.getAppPasscode(),
    SIGNING_SECRET: hostConfig.getSigningSecret(),
    WEBHOOK_SECRET: hostConfig.getWebhookSecret(),
    API_KEY: hostConfig.getApiKey(),
    SLACK_BOT_TOKEN: hostConfig.getSlackBotToken(),
    SLACK_SIGNING_SECRET: hostConfig.getSlackSigningSecret(),
    SLACK_DEFAULT_CHANNEL: hostConfig.getSlackDefaultChannel()
  };

  var redacted = {};
  keys.forEach(function(key) {
    var value = values[key] || '';
    redacted[key] = ScriptPropertiesHelper.shouldRedactKey(key)
      ? (value ? '[REDACTED_SET]' : '[REDACTED_EMPTY]')
      : value;
  });

  Logger.log('[testHostConfig] ' + JSON.stringify(redacted));
}

/**
 * testAuditWrite
 * Executes one mutation and verifies an audit row is written.
 */
function testAuditWrite() {
  var ctx = _buildHostTestContext();
  var auditTable = ctx.db.table('audit_logs');
  var before = auditTable.findAll().length;

  var suffix = new Date().getTime();
  var passcode = ctx.hostConfig.getAppPasscode();
  var payload = {
    command: '/enroll-student',
    text: 'audit-student-' + suffix + ' audit-course-' + suffix,
    user_id: 'U_AUDIT_' + suffix,
    team_id: 'T_AUDIT',
    channel_id: 'C_AUDIT'
  };
  if (passcode) {
    payload.passcode = passcode;
  }

  var event = _mockDoPostEvent(_toFormBody(payload));
  var result = ctx.router.handle(event);
  var after = auditTable.findAll().length;

  Logger.log('[testAuditWrite] ' + JSON.stringify({
    mutationOk: !!result.ok,
    auditRowsBefore: before,
    auditRowsAfter: after,
    auditRowDelta: after - before
  }));
}
