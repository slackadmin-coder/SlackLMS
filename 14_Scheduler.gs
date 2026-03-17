function setupTriggers() {
  removeTriggers();
  ScriptApp.newTrigger('runDailyLessonDelivery').timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('runHourlyReminderCheck').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('runWeeklyAdminReport').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
  return { ok: true, code: 'TRIGGERS_CREATED' };
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  return { ok: true, code: 'TRIGGERS_REMOVED' };
}

function runDailyLessonDelivery() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var deps = createHostDependencies(ConfigBootstrap.load());
    return deps.lessonService.deliverPendingLessons();
  } finally {
    lock.releaseLock();
  }
}

function runHourlyReminderCheck() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var deps = createHostDependencies(ConfigBootstrap.load());
    return deps.reminderService.sendOverdueReminders();
  } finally {
    lock.releaseLock();
  }
}

function runWeeklyAdminReport() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var deps = createHostDependencies(ConfigBootstrap.load());
    return deps.reportService.buildWeeklySummary();
  } finally {
    lock.releaseLock();
  }
}

function runHealthCheck() {
  return createHostDependencies(ConfigBootstrap.load()).healthMonitor.getSnapshot();
}
