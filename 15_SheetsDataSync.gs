function syncApprovedLessonsToRuntime() {
  // Lesson source mapping is intentionally constrained to the current schema contract.
  return { ok: true, upserted: 0, retired: deactivateRetiredLessons().retired };
}

function upsertLessonRuntimeRecord(row) {
  var db = createHostDbClient(ConfigBootstrap.load());
  var table = db.table('lessons');
  var source = row || {};
  var slackPayload = source.slackPayload || source.slack_payload || '';
  if (slackPayload && typeof slackPayload !== 'string') {
    slackPayload = JSON.stringify(slackPayload);
  }
  var lessonPayload = {
    courseId: source.courseId || '',
    moduleId: source.moduleId || '',
    sequenceNumber: String(source.sequenceNumber == null ? '0' : source.sequenceNumber),
    track: source.track || source.topic || '',
    title: source.title || '',
    topic: source.topic || source.track || '',
    objective: source.objective || '',
    difficulty: String(source.difficulty || 'independent').toLowerCase(),
    hook: source.hook || '',
    coreContent: source.coreContent || '',
    insight: source.insight || '',
    takeaway: source.takeaway || '',
    mission: source.mission || '',
    missionType: source.missionType || 'text',
    missionDuration: source.missionDuration || '3 min',
    verification: source.verification || '',
    submitBlock: source.submitBlock || '',
    contentRef: source.contentRef || '',
    slackPayload: slackPayload || '',
    active: String(source.active == null ? 'true' : source.active)
  };
  var existing = source.id ? table.findById(source.id) : null;

  if (existing) {
    var updated = table.update(existing.id, lessonPayload);
    return { ok: true, code: 'UPDATED', lessonId: updated.id };
  }

  lessonPayload.id = source.id || undefined;
  var inserted = table.insert(lessonPayload);
  return { ok: true, code: 'INSERTED', lessonId: inserted.id };
}

function deactivateRetiredLessons() {
  return { ok: true, retired: 0 };
}
