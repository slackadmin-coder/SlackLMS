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
    return runQueuedLessonDeliveryProcessor();
  } finally {
    lock.releaseLock();
  }
}

function runQueuedLessonDeliveryProcessor() {
  var deps = createHostDependencies();
  var now = new Date();
  var nowIso = now.toISOString();
  var retryThreshold = Number(deps.config.pipelineMaxRetries || 3);
  var queueTable = deps.db.table('delivery_queue');
  var dueRows = queueTable.findAll()
    .filter(function(row) {
      if (row.status !== 'queued' && row.status !== 'retry') return false;
      var scheduledFor = row.scheduledFor || row.runAt || row.availableAt;
      if (!scheduledFor) return true;
      var scheduleMs = new Date(scheduledFor).getTime();
      if (isNaN(scheduleMs)) return true;
      return scheduleMs <= now.getTime();
    })
    .sort(function(a, b) {
      var as = new Date(a.scheduledFor || a.runAt || a.availableAt || 0).getTime() || 0;
      var bs = new Date(b.scheduledFor || b.runAt || b.availableAt || 0).getTime() || 0;
      return as - bs;
    })
    .slice(0, 25);

  var summary = {
    ok: true,
    scanned: dueRows.length,
    delivered: 0,
    failed: 0,
    items: []
  };

  for (var i = 0; i < dueRows.length; i++) {
    var queueRow = dueRows[i];
    try {
      var lesson = deps.repositories.lessonRepo.findById(queueRow.lessonId);
      if (!lesson) throw { code: 'LESSON_NOT_FOUND', message: 'Lesson missing.' };
      var lessonStatus = String(lesson.status || '').toLowerCase();
      var isLive = lessonStatus === 'live' || String(lesson.active || '').toLowerCase() === 'true';
      if (!isLive) throw { code: 'LESSON_NOT_LIVE', message: 'Lesson not deliverable.' };

      var learner = deps.repositories.learnerRepo.findById(queueRow.learnerId);
      if (!learner) throw { code: 'LEARNER_NOT_FOUND', message: 'Learner missing.' };
      var progress = deps.repositories.progressRepo.findByLearnerAndLesson(queueRow.learnerId, queueRow.lessonId);
      if (!progress) throw { code: 'PROGRESS_NOT_FOUND', message: 'Learner progress missing.' };

      deps.repositories.progressRepo.update(progress.id, {
        state: 'delivered',
        updatedAt: nowIso
      });

      var payload = deps.lessonService._buildLessonMessagePayload(lesson, 'New lesson available');
      var dm = deps.slackApiClient.openDm(learner.slackUserId);
      if (!dm.ok) throw { code: dm.code || 'DM_OPEN_FAILED', message: dm.message || 'Cannot open DM.', retryable: !!dm.retryable };

      var sent = deps.slackApiClient.postMessage(dm.channelId, payload.text, payload.blocks);
      if (!sent.ok) throw { code: sent.code || 'DM_SEND_FAILED', message: sent.message || 'Cannot send DM.', retryable: !!sent.retryable };

      queueTable.update(queueRow.id, {
        status: 'delivered',
        updatedAt: nowIso,
        attempts: String(Number(queueRow.attempts || 0))
      });

      deps.audit('lesson_queue_delivery_success', {
        queueId: queueRow.id,
        learnerId: queueRow.learnerId,
        lessonId: queueRow.lessonId,
        progressId: progress.id,
        dmChannelId: dm.channelId,
        deliveredAt: nowIso,
        attempts: Number(queueRow.attempts || 0)
      });

      summary.delivered += 1;
      summary.items.push({ id: queueRow.id, ok: true, code: 'DELIVERED' });
    } catch (err) {
      var attempts = Number(queueRow.attempts || 0) + 1;
      var terminal = attempts >= retryThreshold;
      queueTable.update(queueRow.id, {
        status: terminal ? 'failed' : 'retry',
        attempts: String(attempts),
        updatedAt: nowIso
      });

      deps.audit('lesson_queue_delivery_failure', {
        queueId: queueRow.id,
        learnerId: queueRow.learnerId,
        lessonId: queueRow.lessonId,
        code: (err && err.code) || 'QUEUE_DELIVERY_ERROR',
        message: String((err && err.message) || err),
        attempts: attempts,
        retryThreshold: retryThreshold,
        failed: terminal,
        processedAt: nowIso
      });

      summary.failed += 1;
      summary.items.push({
        id: queueRow.id,
        ok: false,
        code: (err && err.code) || 'QUEUE_DELIVERY_ERROR',
        attempts: attempts,
        failed: terminal
      });
    }
  }

  return summary;
}

function runHourlyReminderCheck() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var deps = createHostDependencies();
    return deps.reminderService.sendOverdueReminders();
  } finally {
    lock.releaseLock();
  }
}

function runWeeklyAdminReport() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var deps = createHostDependencies();
    return deps.reportService.buildWeeklySummary();
  } finally {
    lock.releaseLock();
  }
}

function runHealthCheck() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return createHostDependencies().healthMonitor.getSnapshot();
  } finally {
    lock.releaseLock();
  }
}

function runDailyBackup() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return createHostDependencies().backupService.runDailyBackup();
  } finally {
    lock.releaseLock();
  }
}
