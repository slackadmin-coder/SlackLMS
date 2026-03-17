function syncApprovedLessonsToRuntime() {
  // TODO: map authored lesson source rows once source schema is finalized.
  return { ok: true, upserted: 0, retired: deactivateRetiredLessons().retired };
}

function upsertLessonRuntimeRecord(row) {
  var db = createHostDbClient(ConfigBootstrap.load());
  var table = db.table('lessons');
  var existing = row && row.id ? table.findById(row.id) : null;

  if (existing) {
    var updated = table.update(existing.id, row);
    return { ok: true, code: 'UPDATED', lessonId: updated.id };
  }

  var inserted = table.insert({
    id: row.id || undefined,
    courseId: row.courseId || '',
    track: row.track || '',
    title: row.title || '',
    contentRef: row.contentRef || '',
    active: String(row.active == null ? 'true' : row.active)
  });
  return { ok: true, code: 'INSERTED', lessonId: inserted.id };
}

function deactivateRetiredLessons() {
  return { ok: true, retired: 0 };
}
