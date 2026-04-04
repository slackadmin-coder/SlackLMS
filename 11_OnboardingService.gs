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

  advanceOnboardingState(learnerId, completedTaskId, status) {
    try {
      this._db.table('onboarding_task_log').insert({
        checklistItemId: completedTaskId,
        learnerId: learnerId,
        eventType: status || 'completed',
        eventBy: learnerId,
        note: 'Checklist updated via Slack action'
      });
      this._db.table('onboarding_checklists').update(completedTaskId, { status: status || 'complete' });
      return { ok: true, code: 'TASK_ADVANCED' };
    } catch (err) {
      return { ok: false, code: 'ADVANCE_FAILED', message: String(err.message || err) };
    }
  }

  handleOffboard(ctx) {
    var email = SecurityService.sanitizeInput((ctx && ctx.params && ctx.params.text) || '');
    if (!email) {
      return { response_type: 'ephemeral', text: 'Usage: /offboard [email]' };
    }
    var result = this.offboardLearner({
      requestorUserId: (ctx && ctx.userId) || 'system',
      email: email,
      source: 'slash_command'
    });
    if (!result.ok) {
      return { response_type: 'ephemeral', text: ':warning: ' + (result.message || result.code || 'Unable to offboard learner.') };
    }
    return { response_type: 'ephemeral', text: ':white_check_mark: Offboarded ' + email + '. Cancelled queue items: ' + String(result.cancelledQueueItems || 0) + '.' };
  }

  detectInactiveLearners(daysThreshold) {
    var thresholdDays = Number(daysThreshold || 3);
    var cutoffMs = Date.now() - (thresholdDays * 24 * 60 * 60 * 1000);
    var learners = this._db.table('learners').findAll();
    var progressRows = this._db.table('learner_progress').findAll();
    var submissions = this._db.table('submission_log').findAll();

    var latestByLearner = {};
    var pushDate = function(learnerId, isoDate) {
      var parsed = Date.parse(String(isoDate || ''));
      if (!learnerId || isNaN(parsed)) return;
      if (!latestByLearner[learnerId] || latestByLearner[learnerId] < parsed) latestByLearner[learnerId] = parsed;
    };

    learners.forEach(function(row) { pushDate(row.id, row.updatedAt || row.createdAt); });
    progressRows.forEach(function(row) { pushDate(row.learnerId, row.updatedAt || row.completedAt || row.createdAt); });
    submissions.forEach(function(row) { pushDate(row.learnerId, row.createdAt || row.updatedAt); });

    var inactive = learners.filter(function(learner) {
      if (learner.status === 'offboarded' || learner.status === 'inactive') return false;
      var lastActivityMs = latestByLearner[learner.id] || Date.parse(String(learner.createdAt || ''));
      return !!lastActivityMs && lastActivityMs < cutoffMs;
    }).map(function(learner) {
      return {
        learnerId: learner.id,
        email: learner.email || '',
        slackUserId: learner.slackUserId || '',
        lastActivityAt: new Date(latestByLearner[learner.id]).toISOString()
      };
    });

    return {
      ok: true,
      thresholdDays: thresholdDays,
      cutoffAt: new Date(cutoffMs).toISOString(),
      count: inactive.length,
      learners: inactive
    };
  }

  queryAuditLog(input) {
    var filter = input || {};
    var fromMs = Date.parse(String(filter.from || ''));
    var toMs = Date.parse(String(filter.to || ''));
    var actor = String(filter.actor || '').trim();
    var resourceType = String(filter.resourceType || '').trim();
    var resourceId = String(filter.resourceId || '').trim();

    var rows = this._db.table('audit_log').findAll().filter(function(row) {
      var rowMs = Date.parse(String(row.createdAt || ''));
      if (!isNaN(fromMs) && (isNaN(rowMs) || rowMs < fromMs)) return false;
      if (!isNaN(toMs) && (isNaN(rowMs) || rowMs > toMs)) return false;
      if (actor && row.actor !== actor) return false;
      if (resourceType && row.resourceType !== resourceType) return false;
      if (resourceId && row.resourceId !== resourceId) return false;
      return true;
    }).sort(function(a, b) { return Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || '')); });

    return {
      ok: true,
      filters: {
        from: isNaN(fromMs) ? '' : new Date(fromMs).toISOString(),
        to: isNaN(toMs) ? '' : new Date(toMs).toISOString(),
        actor: actor,
        resourceType: resourceType,
        resourceId: resourceId
      },
      count: rows.length,
      items: rows
    };
  }

  handleAuditQuery(ctx) {
    var text = SecurityService.sanitizeInput((ctx && ctx.params && ctx.params.text) || '');
    var parsed = this._parseAuditFilterText(text);
    var audit = this.queryAuditLog(parsed);
    var preview = audit.items.slice(0, 5).map(function(row) {
      return '• ' + String(row.createdAt || '') + ' | ' + String(row.actor || '-') + ' | ' + String(row.action || '-') + ' | ' + String(row.resourceType || '-');
    }).join('\n');
    return {
      response_type: 'ephemeral',
      text: '*Audit results:* ' + String(audit.count) + (preview ? '\n' + preview : '\nNo matching records.')
    };
  }

  offboardLearner(input) {
    var skillId = SkillRegistry.workflowActionSkills.offboarding; // skill-trace: SKILL-OFFBOARDING-001
    var params = input || {};
    var learner = null;
    if (params.learnerId) learner = this._db.table('learners').findById(params.learnerId);
    if (!learner && params.slackUserId) {
      learner = this._db.table('learners').findAll().filter(function(row) { return row.slackUserId === params.slackUserId; })[0] || null;
    }
    if (!learner && params.email) {
      learner = this._db.table('learners').findAll().filter(function(row) {
        return String(row.email || '').toLowerCase() === String(params.email || '').toLowerCase();
      })[0] || null;
    }
    if (!learner) return { ok: false, code: 'LEARNER_NOT_FOUND', message: 'Learner not found for offboarding request.' };

    this._db.table('learners').update(learner.id, { status: 'offboarded' });

    var enrollmentRows = this._db.table('enrollment').findAll().filter(function(row) { return row.learnerId === learner.id; });
    for (var i = 0; i < enrollmentRows.length; i++) {
      this._db.table('enrollment').update(enrollmentRows[i].id, { status: 'inactive' });
    }

    var nowMs = Date.now();
    var cancelled = 0;
    var deliveryRows = this._db.table('delivery_queue').findAll().filter(function(row) {
      var runAt = Date.parse(String(row.runAt || ''));
      var isFuture = !isNaN(runAt) ? runAt > nowMs : true;
      return row.learnerId === learner.id && row.status === 'queued' && isFuture;
    });
    for (var d = 0; d < deliveryRows.length; d++) {
      this._db.table('delivery_queue').update(deliveryRows[d].id, { status: 'cancelled' });
      cancelled++;
    }

    var retryRows = this._db.table('retry_queue').findAll().filter(function(row) {
      if (row.status !== 'queued' && row.status !== 'pending') return false;
      var nextRun = Date.parse(String(row.nextRunAt || ''));
      var isFuture = !isNaN(nextRun) ? nextRun > nowMs : true;
      if (!isFuture) return false;
      var payloadText = String(row.payload || '');
      return payloadText.indexOf(learner.id) !== -1;
    });
    for (var r = 0; r < retryRows.length; r++) {
      this._db.table('retry_queue').update(retryRows[r].id, { status: 'cancelled', lastError: 'Cancelled due to learner offboarding.' });
      cancelled++;
    }

    this._db.audit('offboard_learner', 'learners', {
      requestorUserId: params.requestorUserId || 'system',
      learnerId: learner.id,
      email: learner.email || '',
      source: params.source || 'manual',
      cancelledQueueItems: cancelled,
      skillId: skillId
    });

    return {
      ok: true,
      code: 'LEARNER_OFFBOARDED',
      skillId: skillId,
      learnerId: learner.id,
      email: learner.email || '',
      cancelledQueueItems: cancelled
    };
  }

  _parseAuditFilterText(text) {
    var out = {};
    String(text || '').split(/\s+/).forEach(function(part) {
      var bits = part.split('=');
      if (bits.length < 2) return;
      var key = String(bits[0] || '').toLowerCase();
      var value = bits.slice(1).join('=');
      if (key === 'from' || key === 'to') out[key] = value;
      if (key === 'actor') out.actor = value;
      if (key === 'resource' || key === 'resourcetype') out.resourceType = value;
      if (key === 'resourceid') out.resourceId = value;
    });
    return out;
  }
}
