/**
 * @fileoverview Web app entry points for Slack + LMS host integration.
 */

/**
 * Builds a default host DB client and registers host-layer tables.
 * @return {DbClient}
 */
function getHostDbClient() {
  var client = createSheetDbClient();

  client.registerTable('enrollments', {
    columns: [
      'id',
      'studentId',
      'courseId',
      'status',
      'source',
      'createdAt',
      'updatedAt',
      'deletedAt'
    ],
    fields: {
      studentId: { required: true, type: 'string' },
      courseId: { required: true, type: 'string' },
      status: { default: 'pending', type: 'string' },
      source: { default: 'slack', type: 'string' }
    }
  });

  client.registerTable('audit_logs', {
    columns: [
      'id',
      'requestId',
      'source',
      'action',
      'status',
      'message',
      'metadata',
      'createdAt',
      'updatedAt',
      'deletedAt'
    ],
    fields: {
      requestId: { required: true, type: 'string' },
      source: { required: true, type: 'string' },
      action: { required: true, type: 'string' },
      status: { required: true, type: 'string' },
      message: { type: 'string' },
      metadata: { type: 'string' }
    }
  });

  return client;
}

/**
 * Web App POST handler.
 *
 * @param {GoogleAppsScript.Events.DoPost} e Request event.
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  var dbClient = getHostDbClient();
  var enrollmentService = new LmsEnrollmentService(dbClient);
  var router = new SlackRouter(
    new SlackService(
      enrollmentService,
      new WorkflowHandlers(enrollmentService),
      dbClient
    ),
    dbClient
  );

  var result = router.handle(e);
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
