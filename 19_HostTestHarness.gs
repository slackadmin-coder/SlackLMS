function hostTest_fakeSlashLesson() {
  return doPost(_fakeSlash('/learn', '')).getContent();
}

function hostTest_fakeSlashSubmit() {
  return doPost(_fakeSlash('/submit', 'PRE-M01 complete')).getContent();
}

function hostTest_fakeSlashProgress() {
  return doPost(_fakeSlash('/progress', '')).getContent();
}

function hostTest_workflowWebhookEnroll() {
  var body = JSON.stringify({
    workflow: 'lms_onboarding',
    data: { user_id: 'U_TEST_WF', email: 'test@rwrgroup.com', name: 'Test Learner', course_id: 'C001' }
  });
  return doPost({ postData: { type: 'application/json', contents: body }, parameter: {}, headers: {} }).getContent();
}

function hostTest_submitValid() {
  return doPost(_fakeSlash('/submit', 'PRE-M01 complete')).getContent();
}

function hostTest_submitMissingKeyword() {
  return doPost(_fakeSlash('/submit', 'PRE-M01')).getContent();
}

function hostTest_onboardAdmin() {
  return doPost(_fakeSlash('/onboard', 'test@rwrgroup.com')).getContent();
}

function hostTest_fakeInteractive() {
  var payload = {
    type: 'block_actions',
    user: { id: 'U123' },
    channel: { id: 'C123' },
    team: { id: 'T123' },
    actions: [{ action_id: 'submit_lesson' }]
  };
  return doPost({
    parameter: { payload: JSON.stringify(payload) },
    postData: { type: 'application/x-www-form-urlencoded', contents: 'payload=' + encodeURIComponent(JSON.stringify(payload)) }
  }).getContent();
}

function hostTest_fakeAppMention() {
  return doPost(_fakeEvent('app_mention')).getContent();
}

function hostTest_fakeMessageIm() {
  return doPost(_fakeEvent('message', 'im')).getContent();
}

function hostTest_reminderSmoke() {
  return JSON.stringify(runHourlyReminderCheck());
}

function hostTest_lessonDeliverySmoke() {
  return JSON.stringify(runDailyLessonDelivery());
}

function hostTest_dailyDeliverySmoke() {
  return JSON.stringify(runDailyLessonDelivery());
}

function hostTest_backupSmoke() {
  return JSON.stringify(runDailyBackup());
}

function _fakeSlash(command, text) {
  var body = 'command=' + encodeURIComponent(command) + '&text=' + encodeURIComponent(text || '') + '&user_id=U123&channel_id=C123&team_id=T123';
  return {
    parameter: { command: command, text: text || '', user_id: 'U123', channel_id: 'C123', team_id: 'T123' },
    postData: { type: 'application/x-www-form-urlencoded', contents: body }
  };
}

function _fakeEvent(eventType, channelType) {
  var body = {
    type: 'event_callback',
    team_id: 'T123',
    event: { type: eventType, channel_type: channelType || 'channel', user: 'U123', channel: 'C123' }
  };
  return {
    parameter: {},
    postData: { type: 'application/json', contents: JSON.stringify(body) }
  };
}
