function hostTest_fakeSlashLearn() {
  return doPost(_fakeSignedSlash('/learn', '')).getContent();
}

function hostTest_createHostDependencies_wiresIngressQueue() {
  var deps = createHostDependencies();
  Util.assert(!!deps.ingressQueueService, 'Expected ingressQueueService from createHostDependencies().');
  Util.assert(!!deps.slackService._ingressQueue, 'Expected SlackService ingress queue to be wired.');
  Util.assert(
    deps.slackService._ingressQueue === deps.ingressQueueService,
    'Expected SlackService ingress queue to reference deps.ingressQueueService.'
  );
  return JSON.stringify({ ok: true });
}

function hostTest_requestPathDoesNotMutate_inlineSlashLearn() {
  var spies = _buildIngressRequestPathSpies_();
  var service = spies.service;
  var response = service.handleSlashCommand({
    command: '/learn',
    userId: 'U123',
    params: { text: '' },
    routeType: 'slash_command',
    teamId: 'T123',
    channelId: 'C123',
    rawBody: 'command=/learn'
  }, { correlationId: 'req_test_1' });

  Util.assert(spies.lessonCalls === 0, 'Lesson mutator must not run inline for /learn.');
  Util.assert(spies.queueCalls === 1, 'Ingress queue append should run once for /learn.');
  return JSON.stringify({ ok: true, response: response });
}

function hostTest_requestPathDoesNotMutate_inlineSlashSubmit() {
  var spies = _buildIngressRequestPathSpies_();
  var service = spies.service;
  var response = service.handleSlashCommand({
    command: '/submit',
    userId: 'U123',
    params: { text: 'PRE-M01 complete' },
    routeType: 'slash_command',
    teamId: 'T123',
    channelId: 'C123',
    rawBody: 'command=/submit&text=PRE-M01+complete'
  }, { correlationId: 'req_test_1b' });

  Util.assert(spies.completionCalls === 0, 'Completion mutator must not run inline for /submit.');
  Util.assert(spies.queueCalls === 1, 'Ingress queue append should run once for /submit.');
  return JSON.stringify({ ok: true, response: response });
}

function hostTest_requestPathDoesNotMutate_inlineInteractivitySubmit() {
  var spies = _buildIngressRequestPathSpies_();
  var service = spies.service;
  var response = service.handleInteractivity({
    routeType: 'interactivity',
    userId: 'U123',
    teamId: 'T123',
    channelId: 'C123',
    interaction: {
      type: 'block_actions',
      user: { id: 'U123' },
      actions: [{ action_id: 'submit_lesson', value: 'PRE-M01' }]
    }
  }, { correlationId: 'req_test_2' });

  Util.assert(spies.completionCalls === 0, 'Completion mutator must not run inline for interactivity submit.');
  Util.assert(spies.queueCalls === 1, 'Ingress queue append should run once for interactivity submit.');
  return JSON.stringify({ ok: true, response: response });
}

function hostTest_requestPathDoesNotMutate_inlineWorkflowEnroll() {
  var spies = _buildIngressRequestPathSpies_();
  var service = spies.service;
  var response = service.handleWorkflowWebhook({
    routeType: 'workflow_webhook',
    userId: 'U123',
    teamId: 'T123',
    channelId: 'C123',
    params: {},
    body: {
      data: {
        user_id: 'U123',
        email: 'test@rwrgroup.com',
        name: 'Test Learner',
        course_id: 'C001'
      }
    }
  }, { correlationId: 'req_test_3' });

  Util.assert(spies.enrollmentCalls === 0, 'Enrollment mutator must not run inline for workflow webhook.');
  Util.assert(spies.queueCalls === 1, 'Ingress queue append should run once for workflow webhook.');
  return JSON.stringify({ ok: true, response: response });
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

function hostTest_reactionAdded_nonCheckmarkIgnored() {
  var deps = createHostDependencies();
  var parsed = {
    body: {
      event_id: 'EV_NON_CHECK_001',
      event: {
        type: 'reaction_added',
        reaction: 'thumbsup',
        user: 'U123',
        item: { type: 'message', channel: 'C123', ts: '1712345678.000001' }
      }
    }
  };
  return JSON.stringify(deps.slackService.handleEventCallback(parsed));
}

function hostTest_reactionAdded_malformedPayloadIgnored() {
  var deps = createHostDependencies();
  deps.slackService._slack = {
    fetchMessageByTs: function() {
      return { ok: true, message: { text: '/submit PRE-M01 complete' } };
    }
  };
  var parsed = {
    body: {
      event_id: 'EV_MALFORMED_001',
      event: { type: 'reaction_added', reaction: 'white_check_mark', user: 'U123', item: { type: 'message', channel: 'C123' } }
    }
  };
  return JSON.stringify(deps.slackService.handleEventCallback(parsed));
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

function _buildIngressRequestPathSpies_() {
  var queueCalls = 0;
  var lessonCalls = 0;
  var completionCalls = 0;
  var enrollmentCalls = 0;
  var security = SecurityService;

  var service = new SlackService({
    lessonService: {
      handleLesson: function() { lessonCalls += 1; return { ok: true }; },
      handleMix: function() { lessonCalls += 1; return { ok: true }; }
    },
    completionService: {
      handleSubmit: function() { completionCalls += 1; return { ok: true }; },
      recordSubmission: function() { completionCalls += 1; return { ok: true }; }
    },
    progressService: { handleProgress: function() { return { ok: true }; }, handleReinforce: function() { return { ok: true }; } },
    enrollmentService: { enrollLearner: function() { enrollmentCalls += 1; return { ok: true }; } },
    reportService: { buildAdminDashboard: function() { return {}; }, handleGaps: function() { return { ok: true }; } },
    onboardingService: { startOnboarding: function() { return { ok: true }; }, handleAuditQuery: function() { return { ok: true }; }, handleOffboard: function() { return { ok: true }; } },
    ingressQueueService: {
      generateIdempotencyKey: function() { return 'ik_test'; },
      appendJob: function() { queueCalls += 1; return { ok: true, jobId: 'J1' }; }
    }
  }, { buildAdminSummary: function() { return []; } }, { adminUserIds: ['U123'], defaultCourseId: 'C001' }, security, null);

  return {
    service: service,
    get queueCalls() { return queueCalls; },
    get lessonCalls() { return lessonCalls; },
    get completionCalls() { return completionCalls; },
    get enrollmentCalls() { return enrollmentCalls; }
  };
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
    runEventCallbackTests()
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

function runRequestPathContractTests() {
  return _runSuite('request_path_contract', [
    function inlineSlashLearnQueuesOnly() {
      var result = JSON.parse(hostTest_requestPathDoesNotMutate_inlineSlashLearn());
      _assert(result.ok, 'Slash /learn queue-only contract should hold.');
      return { message: 'Slash /learn does not call mutators inline.' };
    },
    function inlineSlashSubmitQueuesOnly() {
      var result = JSON.parse(hostTest_requestPathDoesNotMutate_inlineSlashSubmit());
      _assert(result.ok, 'Slash /submit queue-only contract should hold.');
      return { message: 'Slash /submit does not call mutators inline.' };
    },
    function inlineInteractivityQueuesOnly() {
      var result = JSON.parse(hostTest_requestPathDoesNotMutate_inlineInteractivitySubmit());
      _assert(result.ok, 'Interactivity queue-only contract should hold.');
      return { message: 'Interactivity submit does not call mutators inline.' };
    },
    function inlineWorkflowQueuesOnly() {
      var result = JSON.parse(hostTest_requestPathDoesNotMutate_inlineWorkflowEnroll());
      _assert(result.ok, 'Workflow queue-only contract should hold.');
      return { message: 'Workflow enroll does not call mutators inline.' };
    }
  ]);
}

function runSmokeTests() {
  return _runSuite('smoke', [
    function() {
      var db = createHostDbClient();
      var requiredTables = Object.keys(DbSchema.CONTRACT.TABLES);
      requiredTables.forEach(function(tableName) {
        var schema = db.schema(tableName);
        _assert(schema && Array.isArray(schema.columns) && schema.columns.length > 0, 'Missing or invalid schema: ' + tableName);
      });
      return { message: 'Required tables are registered and readable.' };
    },
    function() {
      var result = JSON.parse(hostTest_createHostDependencies_wiresIngressQueue());
      _assert(result.ok, 'createHostDependencies should wire ingress queue into SlackService.');
      return { message: 'createHostDependencies wires ingress queue service into SlackService.' };
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
      var afterInsert = db.table('audit_log').findAll().length;
      var rawRows = db._sheets.readTable('audit_log').rows.length;

      _assert(afterInsert === before + 1, 'Audit log insert must append exactly one row.', { before: before, afterInsert: afterInsert });
      _assert(rawRows >= afterInsert, 'Underlying audit_log rows must remain append-only.', { rawRows: rawRows, expectedAtLeast: afterInsert });
      _assertAuditAppendOnlyViolation(function() {
        db.table('audit_log').update(row.id, { status: 'warn' });
      }, 'update');
      _assertAuditAppendOnlyViolation(function() {
        db.table('audit_log').remove(row.id);
      }, 'remove');
      return { message: 'Audit log is append-only (insert allowed, update/remove blocked).' };
    }
  ]);
}

function runSchemaContractTests() {
  return _runSuite('schema_contract', [
    function() {
      var db = createHostDbClient();
      var contractTables = DbSchema.CONTRACT.TABLES;
      var tableNames = Object.keys(contractTables);
      _assert(tableNames.length === 13, 'Canonical table count changed.', { expected: 13, actual: tableNames.length });

      tableNames.forEach(function(tableName) {
        var actualColumns = db.schema(tableName).columns;
        var expectedColumns = contractTables[tableName];
        _assert(_sameColumns(actualColumns, expectedColumns), 'Schema mismatch for table: ' + tableName, {
          expected: expectedColumns,
          actual: actualColumns
        });
      });

      var lessonColumns = db.schema('lessons').columns;
      _assert(lessonColumns.length === 41, 'Lessons schema must remain at 41 columns.', {
        expected: 41,
        actual: lessonColumns.length
      });
      _assert(_sameColumns(lessonColumns, DbSchema.CONTRACT.LESSONS_COLUMNS), 'Lessons schema order mismatch against canonical contract.', {
        expected: DbSchema.CONTRACT.LESSONS_COLUMNS,
        actual: lessonColumns
      });

      return { message: 'Canonical schema contract validated for all 13 tables and 41-column lessons order.' };
    }
  ]);
}

function _sameColumns(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
  if (actual.length !== expected.length) return false;
  for (var i = 0; i < expected.length; i++) {
    if (String(actual[i]) !== String(expected[i])) return false;
  }
  return true;
}

function _assertAuditAppendOnlyViolation(callback, operation) {
  try {
    callback();
    throw new Error('Expected append-only violation for operation: ' + operation);
  } catch (err) {
    _assert(err && err.code === 'AUDIT_APPEND_ONLY_VIOLATION', 'Expected AUDIT_APPEND_ONLY_VIOLATION code for operation ' + operation + '.');
    _assert(String(err.message || '').indexOf('Append-only violation') !== -1, 'Expected append-only violation message for operation ' + operation + '.');
    return true;
  }
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

function runEventCallbackTests() {
  return _runSuite('event_callback', [
    function nonCheckmarkReactionIgnored() {
      var deps = createHostDependencies();
      var response = deps.slackService.handleEventCallback({
        body: {
          event_id: 'EV_TEST_NON_CHECK',
          event: {
            type: 'reaction_added',
            reaction: 'eyes',
            user: 'U123',
            item: { type: 'message', channel: 'C123', ts: '1712345000.000001' }
          }
        }
      });
      _assert(response && response.reason === 'unsupported_reaction', 'Expected unsupported reaction to be ignored.', response);
      return { message: 'Non-checkmark reactions are ignored.' };
    },
    function malformedReactionPayloadIgnored() {
      var deps = createHostDependencies();
      var response = deps.slackService.handleEventCallback({
        body: {
          event_id: 'EV_TEST_MALFORMED',
          event: {
            type: 'reaction_added',
            reaction: 'white_check_mark',
            user: 'U123',
            item: { type: 'message', channel: 'C123' }
          }
        }
      });
      _assert(response && response.reason === 'MALFORMED_REACTION_EVENT', 'Expected malformed reaction payload to be ignored.', response);
      return { message: 'Malformed reaction payload is ignored with explicit reason.' };
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
