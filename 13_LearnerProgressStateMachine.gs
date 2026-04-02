class LearnerProgressStateMachine {
  constructor() {
    this.states = {
      NOT_STARTED: 'not_started',
      IN_PROGRESS: 'in_progress',
      SUBMITTED: 'submitted',
      COMPLETED: 'completed'
    };
    this._legacyStateMap = {
      queued: this.states.NOT_STARTED,
      delivered: this.states.NOT_STARTED,
      started: this.states.IN_PROGRESS,
      overdue: this.states.IN_PROGRESS,
      not_started: this.states.NOT_STARTED,
      in_progress: this.states.IN_PROGRESS,
      submitted: this.states.SUBMITTED,
      completed: this.states.COMPLETED
    };
    this._allowed = {};
    this._allowed[this.states.NOT_STARTED] = [this.states.IN_PROGRESS];
    this._allowed[this.states.IN_PROGRESS] = [this.states.SUBMITTED];
    this._allowed[this.states.SUBMITTED] = [this.states.COMPLETED];
    this._allowed[this.states.COMPLETED] = [];
  }

  normalizeState(state) {
    var raw = String(state || '').trim().toLowerCase();
    if (!raw) return this.states.NOT_STARTED;
    return this._legacyStateMap[raw] || this.states.NOT_STARTED;
  }

  isCanonicalState(state) {
    var normalized = this.normalizeState(state);
    return [
      this.states.NOT_STARTED,
      this.states.IN_PROGRESS,
      this.states.SUBMITTED,
      this.states.COMPLETED
    ].indexOf(normalized) !== -1;
  }

  canTransition(fromState, toState) {
    var from = this.normalizeState(fromState);
    var to = this.normalizeState(toState);
    return (this._allowed[from] || []).indexOf(to) !== -1;
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
    next.state = normalizedTo;
    next.updatedAt = new Date().toISOString();
    if (normalizedTo === this.states.COMPLETED && !next.completedAt) {
      next.completedAt = next.updatedAt;
    }

    return { ok: true, code: 'TRANSITION_OK', message: 'State updated', record: next, meta: meta || {} };
  }


  migrateLegacyStatesInDb(db) {
    var rows = db.table('learner_progress').findAll();
    var migration = this.migrateLegacyStates(rows);
    for (var i = 0; i < migration.updates.length; i++) {
      var patch = { state: migration.updates[i].toState, updatedAt: new Date().toISOString() };
      if (migration.updates[i].toState === this.states.COMPLETED) patch.completedAt = patch.updatedAt;
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
