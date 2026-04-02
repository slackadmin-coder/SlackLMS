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
