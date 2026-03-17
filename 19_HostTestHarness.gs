function hostTest_fakeSlashLesson() {
  return doPost(_fakeSlash('/lesson', '')).getContent();
}

function hostTest_fakeSlashSubmit() {
  return doPost(_fakeSlash('/submit', 'L001')).getContent();
}

function hostTest_fakeSlashProgress() {
  return doPost(_fakeSlash('/progress', '')).getContent();
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
    parameter: { payload: JSON.stringify(payload), token: 'fallback' },
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

function hostTest_dailyDeliverySmoke() {
  return JSON.stringify(runDailyLessonDelivery());
}

function _fakeSlash(command, text) {
  var body = 'command=' + encodeURIComponent(command) + '&text=' + encodeURIComponent(text || '') + '&user_id=U123&channel_id=C123&team_id=T123&token=fallback';
  return {
    parameter: { command: command, text: text || '', user_id: 'U123', channel_id: 'C123', team_id: 'T123', token: 'fallback' },
    postData: { type: 'application/x-www-form-urlencoded', contents: body }
  };
}

function _fakeEvent(eventType, channelType) {
  var body = {
    type: 'event_callback',
    token: 'fallback',
    team_id: 'T123',
    event: { type: eventType, channel_type: channelType || 'channel', user: 'U123', channel: 'C123' }
  };
  return {
    parameter: {},
    postData: { type: 'application/json', contents: JSON.stringify(body) }
  };
}
