class OnboardingService {
  constructor(db, slackApiClient, blocks, config) {
    this._db = db;
    this._slack = slackApiClient;
    this._blocks = blocks;
    this._config = config || {};
  }

  startOnboarding(input) {
    if (!input || !input.targetEmail) {
      return { ok: false, code: 'INVALID_INPUT', message: 'targetEmail is required.' };
    }

    var requestRow = this._db.table('onboarding_requests').insert({
      requestorUserId: input.requestorUserId || 'system',
      targetEmail: input.targetEmail,
      targetName: input.targetName || '',
      targetBrand: input.targetBrand || '',
      courseId: input.courseId || this._config.defaultCourseId || 'C001',
      source: input.source || 'manual',
      status: 'pending'
    });

    var learnerId = input.learnerId || '';
    var checklistItems = this._getDefaultChecklistItems(learnerId);
    var itemRows = checklistItems.map(function(item) {
      return this._db.table('onboarding_checklists').insert(item);
    }.bind(this));

    if (input.managerSlackId && this._config.opsAlertChannel) {
      this._notifyManager(input.managerSlackId, input.targetName || input.targetEmail, requestRow.id);
    }

    this._db.audit('start_onboarding', 'onboarding_requests', { requestId: requestRow.id, targetEmail: input.targetEmail });

    return {
      ok: true,
      code: 'ONBOARDING_STARTED',
      requestId: requestRow.id,
      checklistCount: itemRows.length
    };
  }

  _getDefaultChecklistItems(learnerId) {
    var now = new Date();
    var dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    return [
      { learnerId: learnerId, taskTitle: 'Complete IT setup and system access', taskOwner: 'IT', dueDate: dueDate, status: 'pending' },
      { learnerId: learnerId, taskTitle: 'Complete pre-onboarding modules (PRE-M01 to PRE-M05)', taskOwner: 'learner', dueDate: dueDate, status: 'pending' },
      { learnerId: learnerId, taskTitle: 'Meet with manager for orientation', taskOwner: 'manager', dueDate: dueDate, status: 'pending' },
      { learnerId: learnerId, taskTitle: 'Review RWR Group values and culture', taskOwner: 'learner', dueDate: dueDate, status: 'pending' },
      { learnerId: learnerId, taskTitle: 'Complete Slack and Google Workspace training', taskOwner: 'learner', dueDate: dueDate, status: 'pending' }
    ];
  }

  _notifyManager(managerSlackId, learnerName, requestId) {
    try {
      var dm = this._slack.openDm(managerSlackId);
      if (!dm.ok) return;
      this._slack.postMessage(dm.channelId, 'New hire onboarding started',
        [{ type: 'section', text: { type: 'mrkdwn', text: ':wave: Onboarding has been started for *' + learnerName + '*. Request ID: `' + requestId + '`' } }]
      );
    } catch (err) {
      Logger.log('Manager notify failed: ' + String(err));
    }
  }

  advanceOnboardingState(learnerId, completedTaskId) {
    try {
      this._db.table('onboarding_task_log').insert({
        checklistItemId: completedTaskId,
        learnerId: learnerId,
        eventType: 'completed',
        eventBy: learnerId,
        note: 'Marked complete via Slack'
      });
      this._db.table('onboarding_checklists').update(completedTaskId, { status: 'complete' });
      return { ok: true, code: 'TASK_ADVANCED' };
    } catch (err) {
      return { ok: false, code: 'ADVANCE_FAILED', message: String(err.message || err) };
    }
  }
}
