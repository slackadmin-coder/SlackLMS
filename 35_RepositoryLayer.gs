class BaseRepository {
  constructor(db, tableName) {
    this._db = db;
    this._tableName = tableName;
  }

  table() {
    return this._db.table(this._tableName);
  }

  findAll() {
    return this.table().findAll();
  }

  insert(row) {
    return this.table().insert(row);
  }

  update(id, patch) {
    return this.table().update(id, patch);
  }

  findById(id) {
    return this.table().findById(id);
  }
}

class LearnerRepository extends BaseRepository {
  constructor(db) {
    super(db, 'learners');
  }

  findBySlackUserId(slackUserId) {
    if (!slackUserId) return null;
    var rows = this.findAll();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].slackUserId === slackUserId) return rows[i];
    }
    return null;
  }
}

class ProgressRepository extends BaseRepository {
  constructor(db) {
    super(db, 'learner_progress');
  }

  findByLearnerId(learnerId) {
    return this.findAll().filter(function(row) { return row.learnerId === learnerId; });
  }

  findActiveLesson(learnerId) {
    return this.findByLearnerId(learnerId).filter(function(row) { return row.state !== 'completed'; })[0] || null;
  }

  findByLearnerAndLesson(learnerId, lessonId) {
    return this.findAll().filter(function(row) {
      return row.learnerId === learnerId && row.lessonId === lessonId;
    })[0] || null;
  }
}

class LessonRepository extends BaseRepository {
  constructor(db, cacheService) {
    super(db, 'lessons');
    this._cacheService = cacheService || CacheService.getScriptCache();
  }

  findActiveByCourse(courseId) {
    var cacheKey = 'lessons_active_' + courseId;
    var cached = this._cacheService.get(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch (err) {}
    }

    var rows = this.findAll().filter(function(row) {
      return row.courseId === courseId && String(row.active) === 'true' && !String(row.deletedAt || '').trim();
    }).sort(function(a, b) {
      return Number(a.sequenceNumber || 0) - Number(b.sequenceNumber || 0);
    });

    this._cacheService.put(cacheKey, JSON.stringify(rows), 180);
    return rows;
  }

  findNextLesson(courseId, sequenceNumber) {
    var lessons = this.findActiveByCourse(courseId);
    for (var i = 0; i < lessons.length; i++) {
      if (Number(lessons[i].sequenceNumber || 0) > Number(sequenceNumber || 0)) return lessons[i];
    }
    return null;
  }
}

class ConfigRepository extends BaseRepository {
  constructor(db, cacheService) {
    super(db, 'app_config');
    this._cacheService = cacheService || CacheService.getScriptCache();
  }

  getValue(configKey, fallback) {
    var cacheKey = 'app_config_' + configKey;
    var cached = this._cacheService.get(cacheKey);
    if (cached !== null) return cached;
    var found = this.findAll().filter(function(row) { return row.configKey === configKey; })[0];
    var value = found ? String(found.configValue || '') : String(fallback || '');
    this._cacheService.put(cacheKey, value, 180);
    return value;
  }

  getFlag(configKey, fallbackBool) {
    var fallback = fallbackBool ? 'true' : 'false';
    return this.getValue(configKey, fallback) === 'true';
  }
}
