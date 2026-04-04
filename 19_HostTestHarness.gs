function hostTest_fakeSlashLearn() {
  return doPost(_fakeSignedSlash('/learn', '')).getContent();
}

function hostTest_fakeSlashSubmit() {
  return doPost(_fakeSignedSlash('/submit', 'PRE-M01 complete')).getContent();
}

function hostTest_fakeSlashProgress() {
  return doPost(_fakeSignedSlash('/progress', '')).getContent();
}

function hostTest_workflowWebhookEnroll() {
  var body = JSON.stringify({
    workflow: 'lms_onboarding',
    data: { user_id: 'U_TEST_WF', email: 'test@rwrgroup.com', name: 'Test Learner', course_id: 'C001' }
  });
  return doPost(_fakeSignedJson(body)).getContent();
}

function hostTest_duplicateSubmissionEdgeCase() {
  var deps = createHostDependencies();
  var first = deps.completionService.recordSubmission({ slackUserId: 'U123', lessonId: 'PRE-M01', payload: '{}' });
  var second = deps.completionService.recordSubmission({ slackUserId: 'U123', lessonId: 'PRE-M01', payload: '{}' });
  return JSON.stringify({ first: first, second: second });
}

function hostTest_missingLearnerEdgeCase() {
  var deps = createHostDependencies();
  return JSON.stringify(deps.completionService.recordSubmission({ slackUserId: 'U_MISSING', lessonId: 'PRE-M01', payload: '{}' }));
}

function hostTest_invalidPayloadEdgeCase() {
  return doPost({ postData: { type: 'application/json', contents: '{invalid-json' }, parameter: {}, headers: {} }).getContent();
}

function hostTest_onboardAdmin() {
  return doPost(_fakeSignedSlash('/onboard', 'test@rwrgroup.com')).getContent();
}

function hostTest_fakeSlashGaps() {
  return doPost(_fakeSignedSlash('/gaps', '')).getContent();
}

function hostTest_fakeSlashAudit() {
  return doPost(_fakeSignedSlash('/audit', '')).getContent();
}

function hostTest_fakeSlashMix() {
  return doPost(_fakeSignedSlash('/mix', '')).getContent();
}

function hostTest_fakeSlashReinforce() {
  return doPost(_fakeSignedSlash('/reinforce', '')).getContent();
}

function hostTest_fakeSlashOffboard() {
  return doPost(_fakeSignedSlash('/offboard', 'departing.user@rwrgroup.com')).getContent();
}

function hostTest_fakeInteractive() {
  var payload = {
    type: 'block_actions',
    user: { id: 'U123' },
    channel: { id: 'C123' },
    team: { id: 'T123' },
    actions: [{ action_id: 'submit_lesson', value: 'PRE-M01' }]
  };
  var form = 'payload=' + encodeURIComponent(JSON.stringify(payload));
  return doPost(_fakeSignedForm(form, { payload: JSON.stringify(payload) })).getContent();
}

function hostTest_fakeAppMention() {
  return doPost(_fakeSignedEvent('app_mention')).getContent();
}

function hostTest_fakeMessageIm() {
  return doPost(_fakeSignedEvent('message', 'im')).getContent();
}

function hostTest_auditLogAppendOnly_insertAllowed() {
  var deps = createHostDependencies();
  var row = deps.db.table('audit_log').insert({
    actor: 'test',
    action: 'append_only_insert',
    resourceType: 'test',
    resourceId: 'insert',
    status: 'info',
    message: 'insert should succeed',
    metadata: '{}'
  });
  Util.assert(!!row && !!row.id, 'Expected audit_log insert to succeed.');
  return JSON.stringify({ ok: true, id: row.id });
}

function hostTest_auditLogAppendOnly_updateViolation() {
  var deps = createHostDependencies();
  var inserted = deps.db.table('audit_log').insert({
    actor: 'test',
    action: 'append_only_update_attempt',
    resourceType: 'test',
    resourceId: 'update',
    status: 'info',
    message: 'update should be blocked',
    metadata: '{}'
  });
  return _assertAuditLogViolation(function() {
    deps.db.table('audit_log').update(inserted.id, { status: 'warn' });
  }, 'update');
}

function hostTest_auditLogAppendOnly_removeViolation() {
  var deps = createHostDependencies();
  var inserted = deps.db.table('audit_log').insert({
    actor: 'test',
    action: 'append_only_remove_attempt',
    resourceType: 'test',
    resourceId: 'remove',
    status: 'info',
    message: 'remove should be blocked',
    metadata: '{}'
  });
  return _assertAuditLogViolation(function() {
    deps.db.table('audit_log').remove(inserted.id);
  }, 'remove');
}

function _assertAuditLogViolation(callback, operation) {
  try {
    callback();
    throw new Error('Expected append-only violation for operation: ' + operation);
  } catch (err) {
    Util.assert(
      err && err.code === 'AUDIT_APPEND_ONLY_VIOLATION',
      'Expected AUDIT_APPEND_ONLY_VIOLATION code for operation ' + operation + '.'
    );
    Util.assert(
      String(err.message || '').indexOf('Append-only violation') !== -1,
      'Expected append-only violation message for operation ' + operation + '.'
    );
    return JSON.stringify({
      ok: true,
      operation: operation,
      code: err.code,
      message: err.message
    });
  }
}

function _fakeSignedSlash(command, text) {
  var body = 'command=' + encodeURIComponent(command) + '&text=' + encodeURIComponent(text || '') + '&user_id=U123&channel_id=C123&team_id=T123';
  return _fakeSignedForm(body, { command: command, text: text || '', user_id: 'U123', channel_id: 'C123', team_id: 'T123' });
}

function _fakeSignedEvent(eventType, channelType) {
  var bodyObj = {
    type: 'event_callback',
    team_id: 'T123',
    event: { type: eventType, channel_type: channelType || 'channel', user: 'U123', channel: 'C123', text: 'help' }
  };
  return _fakeSignedJson(JSON.stringify(bodyObj));
}

function _fakeSignedJson(rawBody) {
  return _buildSignedRequest(rawBody, 'application/json', {});
}

function _fakeSignedForm(rawBody, params) {
  return _buildSignedRequest(rawBody, 'application/x-www-form-urlencoded', params || {});
}

function _buildSignedRequest(rawBody, type, params) {
  var cfg = ConfigBootstrap.load();
  var timestamp = String(Math.floor(Date.now() / 1000));
  var base = 'v0:' + timestamp + ':' + rawBody;
  var bytes = Utilities.computeHmacSha256Signature(base, cfg.slackSigningSecret);
  var hex = bytes.map(function(b) {
    var n = (b < 0 ? b + 256 : b).toString(16);
    return n.length === 1 ? '0' + n : n;
  }).join('');
  return {
    parameter: params || {},
    postData: { type: type, contents: rawBody },
    headers: {
      'x-slack-signature': 'v0=' + hex,
      'x-slack-request-timestamp': timestamp
    }
  };
}

function runAllTests() {
  var suites = [
    runSmokeTests(),
    runSecurityTests(),
    runSchemaContractTests(),
    runStateMachineTests(),
    runTraceabilityTests()
  ];

  var summary = suites.reduce(function(acc, suite) {
    var passCount = suite.results.filter(function(result) { return !!result.ok; }).length;
    var failCount = suite.results.length - passCount;
    acc.passCount += passCount;
    acc.failCount += failCount;
    return acc;
  }, { passCount: 0, failCount: 0 });

  return {
    suite: 'all',
    ok: summary.failCount === 0,
    passCount: summary.passCount,
    failCount: summary.failCount,
    results: suites
  };
}

function runTraceabilityTests() {
  return _runSuite('traceability', [
    function skillRegistryContainsRequiredWorkflowActions() {
      _assert(typeof SkillRegistry === 'object', 'SkillRegistry must be defined.');
      _assert(Array.isArray(SkillRegistry.operationalSkills), 'SkillRegistry.operationalSkills must be an array.');
      _assert(typeof SkillRegistry.workflowActionSkills === 'object', 'SkillRegistry.workflowActionSkills must be defined.');

      var requiredActions = ['enrollment', 'submission', 'delivery', 'reporting', 'offboarding'];
      var registeredIds = SkillRegistry.operationalSkills.map(function(skill) { return skill.id; });

      requiredActions.forEach(function(action) {
        var skillId = SkillRegistry.workflowActionSkills[action];
        _assert(!!skillId, 'Missing skill mapping for workflow action: ' + action);
        _assert(
          registeredIds.indexOf(skillId) !== -1,
          'Workflow action "' + action + '" maps to unregistered skill ID: ' + skillId
        );
      });

      return { message: 'All required workflow actions map to registered skill IDs.' };
    }
  ]);
}

function runSmokeTests() {
  return _runSuite('smoke', [
    function() {
      var db = createHostDbClient();
      var requiredTables = [
        'learners', 'enrollment', 'lessons', 'learner_progress',
        'submission_log', 'delivery_queue', 'retry_queue', 'audit_log'
      ];
      requiredTables.forEach(function(tableName) {
        var schema = db.schema(tableName);
        _assert(schema && Array.isArray(schema.columns) && schema.columns.length > 0, 'Missing or invalid schema: ' + tableName);
      });
      return { message: 'Required tables are registered and readable.' };
    }
  ]);
}

function runSecurityTests() {
  return _runSuite('security', [
    function() {
      var db = createHostDbClient();
      var before = db.table('audit_log').findAll().length;
      var row = db.table('audit_log').insert({
        actor: 'host_test',
        action: 'append_only_check',
        resourceType: 'audit_log',
        resourceId: 'host_test',
        status: 'info',
        message: 'append-only verification',
        metadata: '{}'
      });
      var mid = db.table('audit_log').findAll().length;
      db.table('audit_log').remove(row.id);
      var afterRows = db.table('audit_log').findAll().length;
      var rawRows = db._sheets.readTable('audit_log').rows.length;

      _assert(mid === before + 1, 'Audit log insert must append exactly one row.', { before: before, mid: mid });
      _assert(afterRows === before, 'Soft-deleted audit rows must disappear from active reads.', { before: before, afterRows: afterRows });
      _assert(rawRows >= mid, 'Underlying audit_log rows must remain append-only (no physical delete).', { rawRows: rawRows, expectedAtLeast: mid });
      return { message: 'Audit log behavior is append-only at the storage layer.' };
    }
  ]);
}

function runSchemaContractTests() {
  return _runSuite('schema_contract', [
    function() {
      var db = createHostDbClient();
      var columns = db.schema('lessons').columns;
      _assert(columns.length === 24, 'Lessons schema column count changed.', { expected: 24, actual: columns.length });
      return { message: 'Lessons schema column count matches expected contract (24).' };
    }
  ]);
}

function runStateMachineTests() {
  return _runSuite('state_machine', [
    function() {
      var sm = new LearnerProgressStateMachine();
      var valid = sm.transition({ id: 'p1', state: sm.states.NOT_STARTED }, sm.states.IN_PROGRESS, { source: 'host_test' });
      _assert(valid.ok, 'Valid transition should succeed.', valid);
      _assert(valid.record.state === sm.states.IN_PROGRESS, 'Valid transition should update state.', valid.record);
      return { message: 'Valid transition (not_started -> in_progress) succeeded.' };
    },
    function() {
      var sm = new LearnerProgressStateMachine();
      var invalid = sm.transition({ id: 'p2', state: sm.states.NOT_STARTED }, sm.states.COMPLETED, { source: 'host_test' });
      _assert(!invalid.ok, 'Invalid transition should fail.', invalid);
      _assert(invalid.code === 'INVALID_TRANSITION', 'Invalid transition should return INVALID_TRANSITION.', invalid);
      return { message: 'Invalid transition (not_started -> completed) rejected.' };
    }
  ]);
}

function _runSuite(suiteName, tests) {
  var results = [];
  for (var i = 0; i < tests.length; i++) {
    var testFn = tests[i];
    var testName = testFn.name || ('test_' + (i + 1));
    try {
      var info = testFn() || {};
      results.push({ test: testName, ok: true, message: info.message || '' });
    } catch (err) {
      results.push({
        test: testName,
        ok: false,
        message: err && err.message ? err.message : String(err),
        details: err && err.details ? err.details : null
      });
    }
  }

  return {
    suite: suiteName,
    ok: results.every(function(r) { return !!r.ok; }),
    results: results
  };
}

function _assert(condition, message, details) {
  if (condition) return true;
  var error = new Error(message || 'Assertion failed.');
  if (details !== undefined) error.details = details;
  throw error;
}
