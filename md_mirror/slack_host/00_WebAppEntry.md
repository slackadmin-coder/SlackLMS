# 00_WebAppEntry.gs

**Source path:** `slack_host/00_WebAppEntry.gs`

```javascript
/**
 * Slack host entrypoint (web app).
 */

/**
 * Creates a DB client from SheetDb library and registers host schemas.
 * @return {DbClient}
 */
function createHostDbClient() {
  var db = SheetDb.createClientFromScriptProperties();

  db.schema('students', {
    columns: ['id', 'name', 'source', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      id: { required: true, type: 'string' },
      name: { required: true, type: 'string' },
      source: { default: 'slack', type: 'string' }
    }
  });

  db.schema('enrollments', {
    columns: ['id', 'studentId', 'courseId', 'status', 'source', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      studentId: { required: true, type: 'string' },
      courseId: { required: true, type: 'string' },
      status: { default: 'enrolled', type: 'string' },
      source: { default: 'slack', type: 'string' }
    }
  });

  db.schema('automations', {
    columns: ['id', 'requestId', 'workflow', 'eventType', 'state', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      requestId: { required: true, type: 'string' },
      workflow: { required: true, type: 'string' },
      eventType: { required: true, type: 'string' },
      state: { default: 'received', type: 'string' }
    }
  });

  db.schema('audit_logs', {
    columns: ['id', 'requestId', 'source', 'action', 'status', 'message', 'metadata', 'createdAt', 'updatedAt', 'deletedAt'],
    fields: {
      requestId: { required: true, type: 'string' },
      source: { required: true, type: 'string' },
      action: { required: true, type: 'string' },
      status: { required: true, type: 'string' },
      message: { type: 'string' },
      metadata: { type: 'string' }
    }
  });

  return db;
}

/**
 * Creates the host-layer router with all dependencies wired.
 * @param {DbClient} db
 * @param {HostConfig} hostConfig
 * @return {SlackRouter}
 */
function createHostRouter(db, hostConfig) {
  var parser = new SlackPayloadParser();
  var security = new SlackSecurity(hostConfig);
  var contexts = new RequestContextFactory(hostConfig);
  var formatter = new ResultFormatter();

  var enrollmentService = new LmsEnrollmentService(db);
  var automationService = new LmsAutomationService(db);
  var workflowHandlers = new WorkflowWebhookHandlers(enrollmentService, automationService);
  var slackService = new SlackService(enrollmentService, workflowHandlers, formatter);

  return new SlackRouter(parser, security, contexts, slackService, formatter, db);
}

/**
 * Webhook entrypoint.
 * @param {GoogleAppsScript.Events.DoPost} e
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  var db = createHostDbClient();
  var hostConfig = new HostConfig(new ScriptPropertiesHelper());
  var router = createHostRouter(db, hostConfig);
  var result = router.handle(e);

  return ContentService
    .createTextOutput(JSON.stringify(result.slack || result))
    .setMimeType(ContentService.MimeType.JSON);
}

```
