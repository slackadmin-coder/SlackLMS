# 06_LmsAutomationService.gs

**Source path:** `slack_host/06_LmsAutomationService.gs`

```javascript
/**
 * LMS automation operations that persist workflow state via SheetDb.
 */
class LmsAutomationService {
  /**
   * @param {DbClient} db
   */
  constructor(db) {
    this._db = db;
  }

  /**
   * Inserts/updates an automation row and writes an audit log row.
   * @param {Object} context
   * @param {Object} payload
   * @return {Object}
   */
  upsertAutomation(context, payload) {
    var automations = this._db.table('automations');
    var audit = this._db.table('audit_logs');
    var workflow = payload.workflow || 'unknown_workflow';
    var eventType = payload.eventType || 'workflow_event';
    var state = payload.status || 'received';

    var existing = automations.findAll().filter(function(r) {
      return r.workflow === workflow && r.requestId === payload.requestId;
    })[0];

    var row;
    if (existing) {
      row = automations.update(existing.id, { eventType: eventType, state: state });
    } else {
      row = automations.insert({ requestId: payload.requestId, workflow: workflow, eventType: eventType, state: state });
    }

    audit.insert({
      requestId: context.requestId,
      source: context.source,
      action: 'automation_upsert',
      status: 'success',
      message: 'Automation row upserted.',
      metadata: JSON.stringify({ automationId: row.id, workflow: workflow, eventType: eventType })
    });

    return {
      ok: true,
      code: 'AUTOMATION_UPSERTED',
      message: 'Automation row upserted.',
      data: { automationId: row.id, workflow: workflow, eventType: eventType, state: row.state }
    };
  }
}

```
