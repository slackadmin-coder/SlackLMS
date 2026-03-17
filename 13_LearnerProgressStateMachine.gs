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
    this._allowed = {};
    this._allowed[this.states.QUEUED] = [this.states.DELIVERED];
    this._allowed[this.states.DELIVERED] = [this.states.STARTED, this.states.OVERDUE];
    this._allowed[this.states.STARTED] = [this.states.SUBMITTED, this.states.OVERDUE];
    this._allowed[this.states.SUBMITTED] = [this.states.COMPLETED];
    this._allowed[this.states.COMPLETED] = [];
    this._allowed[this.states.OVERDUE] = [this.states.STARTED, this.states.SUBMITTED, this.states.COMPLETED];
  }

  canTransition(fromState, toState) {
    var from = String(fromState || this.states.QUEUED);
    var to = String(toState || '');
    return (this._allowed[from] || []).indexOf(to) !== -1;
  }

  transition(record, toState, meta) {
    var source = record || {};
    var fromState = source.state || this.states.QUEUED;
    if (!this.canTransition(fromState, toState)) {
      return {
        ok: false,
        code: 'INVALID_TRANSITION',
        message: fromState + ' -> ' + toState + ' not allowed.',
        record: source,
        meta: meta || {}
      };
    }

    var next = {};
    Object.keys(source).forEach(function(k) { next[k] = source[k]; });
    next.state = toState;
    next.updatedAt = new Date().toISOString();

    return { ok: true, code: 'TRANSITION_OK', message: 'State updated', record: next, meta: meta || {} };
  }
}
