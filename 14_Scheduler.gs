function setupTriggers() {
  removeTriggers();
  ScriptApp.newTrigger('runDailyLessonDelivery').timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('runHourlyReminderCheck').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('runWeeklyAdminReport').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
  ScriptApp.newTrigger('runHealthCheck').timeBased().everyMinutes(30).create();
  ScriptApp.newTrigger('runDailyBackup').timeBased().everyDays(1).atHour(2).create();
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
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return createHostDependencies(ConfigBootstrap.load()).healthMonitor.getSnapshot();
  } finally {
    lock.releaseLock();
  }
}

function runDailyBackup() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var result = createHostDependencies(ConfigBootstrap.load()).backupService.runDailyBackup();
    if (!result || result.ok !== true) {
      return {
        ok: false,
        code: 'SCHEDULER_DAILY_BACKUP_FAILED',
        failureCode: result && result.code ? result.code : 'BACKUP_UNKNOWN_FAILURE',
        message: result && result.message ? result.message : 'Backup did not complete successfully'
      };
    }
    return {
      ok: true,
      code: 'SCHEDULER_DAILY_BACKUP_SUCCESS',
      backupCode: result.code,
      artifactCount: result.artifactCount || 0
    };
  } catch (err) {
    return {
      ok: false,
      code: 'SCHEDULER_DAILY_BACKUP_EXCEPTION',
      failureCode: 'BACKUP_EXCEPTION',
      message: String(err && err.message ? err.message : err)
    };
  } finally {
    lock.releaseLock();
  }
}
