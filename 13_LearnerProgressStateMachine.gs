class LearnerProgressStateMachine {
  constructor() {
    this.states = {
      QUEUED: 'queued',
      DELIVERED: 'delivered',
      STARTED: 'started',
      SUBMITTED: 'submitted',
      COMPLETED: 'completed',
      OVERDUE: 'overdue'
    };

    // Wave 1 transition matrix (enforced exactly).
    this._allowed = {};
    this._allowed[this.states.QUEUED] = [this.states.DELIVERED];
    this._allowed[this.states.DELIVERED] = [this.states.STARTED, this.states.OVERDUE];
    this._allowed[this.states.STARTED] = [this.states.SUBMITTED, this.states.OVERDUE];
    this._allowed[this.states.SUBMITTED] = [this.states.COMPLETED];
    this._allowed[this.states.COMPLETED] = [];
    this._allowed[this.states.OVERDUE] = [this.states.STARTED, this.states.SUBMITTED, this.states.COMPLETED];

    // Legacy compatibility and migration map.
    this._legacyStateMap = {
      not_started: this.states.QUEUED,
      in_progress: this.states.STARTED,
      queued: this.states.QUEUED,
      delivered: this.states.DELIVERED,
      started: this.states.STARTED,
      submitted: this.states.SUBMITTED,
      completed: this.states.COMPLETED,
      overdue: this.states.OVERDUE
    };

    this.lessonLifecycleStates = {
      EMPTY: 'empty',
      DRAFT: 'draft',
      SOP5_REVIEW: 'sop5review',
      NEEDS_REVISION: 'needsrevision',
      READY: 'ready',
      LIVE: 'live'
    };

    this._lessonLifecycleAllowed = {};
    this._lessonLifecycleAllowed[this.lessonLifecycleStates.EMPTY] = [this.lessonLifecycleStates.DRAFT];
    this._lessonLifecycleAllowed[this.lessonLifecycleStates.DRAFT] = [this.lessonLifecycleStates.SOP5_REVIEW];
    this._lessonLifecycleAllowed[this.lessonLifecycleStates.SOP5_REVIEW] = [
      this.lessonLifecycleStates.NEEDS_REVISION,
      this.lessonLifecycleStates.READY
    ];
    this._lessonLifecycleAllowed[this.lessonLifecycleStates.NEEDS_REVISION] = [this.lessonLifecycleStates.SOP5_REVIEW];
    this._lessonLifecycleAllowed[this.lessonLifecycleStates.READY] = [this.lessonLifecycleStates.LIVE];
    this._lessonLifecycleAllowed[this.lessonLifecycleStates.LIVE] = [];

    this._legacyLessonLifecycleMap = {
      '': this.lessonLifecycleStates.EMPTY,
      empty: this.lessonLifecycleStates.EMPTY,
      draft: this.lessonLifecycleStates.DRAFT,
      sop5review: this.lessonLifecycleStates.SOP5_REVIEW,
      sop5_review: this.lessonLifecycleStates.SOP5_REVIEW,
      needsrevision: this.lessonLifecycleStates.NEEDS_REVISION,
      needs_revision: this.lessonLifecycleStates.NEEDS_REVISION,
      ready: this.lessonLifecycleStates.READY,
      live: this.lessonLifecycleStates.LIVE
    };
  }

  normalizeState(state) {
    var raw = String(state || '').trim().toLowerCase();
    if (!raw) return this.states.QUEUED;
    return this._legacyStateMap[raw] || this.states.QUEUED;
  }

  normalizeLessonLifecycleState(state) {
    var raw = String(state || '').trim().toLowerCase();
    return this._legacyLessonLifecycleMap[raw] || this.lessonLifecycleStates.EMPTY;
  }

  isCanonicalState(state) {
    var normalized = this.normalizeState(state);
    return [
      this.states.QUEUED,
      this.states.DELIVERED,
      this.states.STARTED,
      this.states.SUBMITTED,
      this.states.COMPLETED,
      this.states.OVERDUE
    ].indexOf(normalized) !== -1;
  }

  canTransition(fromState, toState) {
    var from = this.normalizeState(fromState);
    var to = this.normalizeState(toState);
    return (this._allowed[from] || []).indexOf(to) !== -1;
  }

  canTransitionLessonLifecycle(fromState, toState) {
    var from = this.normalizeLessonLifecycleState(fromState);
    var to = this.normalizeLessonLifecycleState(toState);
    return (this._lessonLifecycleAllowed[from] || []).indexOf(to) !== -1;
  }

  transition(record, toState, meta) {
    var source = record || {};
    var fromState = this.normalizeState(source.state);
    var normalizedTo = this.normalizeState(toState);
    if (!this.canTransition(fromState, normalizedTo)) {
      return {
        ok: false,
        code: 'INVALID_TRANSITION',
        message: fromState + ' -> ' + normalizedTo + ' not allowed.',
        record: source,
        meta: meta || {}
      };
    }

    var next = {};
    Object.keys(source).forEach(function(k) { next[k] = source[k]; });

    var now = new Date().toISOString();
    next.state = normalizedTo;
    next._updatedAt = now;
    next.updatedAt = now; // Compatibility with existing records/queries.
    this._stampTransitionTimestamps(next, normalizedTo, now);

    return { ok: true, code: 'TRANSITION_OK', message: 'State updated', record: next, meta: meta || {} };
  }

  transitionLessonLifecycle(record, toState, meta) {
    var source = record || {};
    var fromState = this.normalizeLessonLifecycleState(source.lifecycleState);
    var normalizedTo = this.normalizeLessonLifecycleState(toState);
    if (!this.canTransitionLessonLifecycle(fromState, normalizedTo)) {
      return {
        ok: false,
        code: 'INVALID_LESSON_LIFECYCLE_TRANSITION',
        message: fromState + ' -> ' + normalizedTo + ' not allowed.',
        record: source,
        meta: meta || {}
      };
    }

    var next = {};
    Object.keys(source).forEach(function(k) { next[k] = source[k]; });

    var now = new Date().toISOString();
    next.lifecycleState = normalizedTo;
    next._updatedAt = now;
    next.updatedAt = now;

    return { ok: true, code: 'LESSON_LIFECYCLE_TRANSITION_OK', message: 'Lesson lifecycle updated', record: next, meta: meta || {} };
  }

  _stampTransitionTimestamps(nextRecord, state, at) {
    if (state === this.states.DELIVERED && !nextRecord.DeliveredAt) nextRecord.DeliveredAt = at;
    if (state === this.states.STARTED && !nextRecord.StartedAt) nextRecord.StartedAt = at;
    if (state === this.states.SUBMITTED && !nextRecord.SubmittedAt) nextRecord.SubmittedAt = at;
    if (state === this.states.COMPLETED && !nextRecord.CompletedAt) nextRecord.CompletedAt = at;

    // Legacy compatibility.
    if (nextRecord.DeliveredAt && !nextRecord.deliveredAt) nextRecord.deliveredAt = nextRecord.DeliveredAt;
    if (nextRecord.StartedAt && !nextRecord.startedAt) nextRecord.startedAt = nextRecord.StartedAt;
    if (nextRecord.SubmittedAt && !nextRecord.submittedAt) nextRecord.submittedAt = nextRecord.SubmittedAt;
    if (nextRecord.CompletedAt && !nextRecord.completedAt) nextRecord.completedAt = nextRecord.CompletedAt;
  }

  migrateLegacyStatesInDb(db) {
    var rows = db.table('learner_progress').findAll();
    var migration = this.migrateLegacyStates(rows);
    for (var i = 0; i < migration.updates.length; i++) {
      var now = new Date().toISOString();
      var patch = {
        state: migration.updates[i].toState,
        _updatedAt: now,
        updatedAt: now
      };
      this._stampTransitionTimestamps(patch, migration.updates[i].toState, now);
      db.table('learner_progress').update(migration.updates[i].id, patch);
    }
    return migration;
  }

  migrateLegacyStates(progressRows) {
    var rows = progressRows || [];
    var updates = [];

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i] || {};
      var currentState = String(row.state || '').trim().toLowerCase();
      var normalizedState = this.normalizeState(currentState);
      if (currentState !== normalizedState) {
        updates.push({ id: row.id, fromState: currentState || '', toState: normalizedState });
      }
    }

    return { ok: true, total: rows.length, updated: updates.length, updates: updates };
  }
}
