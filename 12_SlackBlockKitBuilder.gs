class SlackBlockKitBuilder {
  buildWelcomeMessage(input) {
    return [{ type: 'section', text: { type: 'mrkdwn', text: '*Welcome to RWR LMS*\nCourse: ' + (input.courseId || '') } }];
  }

  buildLessonCard(input) {
    return [{ type: 'section', text: { type: 'mrkdwn', text: '*Lesson:* ' + (input.title || input.lessonId || '') } }];
  }

  buildProgressSummary(input) {
    return [{ type: 'section', text: { type: 'mrkdwn', text: '*Progress*\nCompleted: ' + input.completedCount + '\nOverdue: ' + input.overdueCount + '\nNext: ' + input.nextAction } }];
  }

  buildReminder(input) {
    return [{ type: 'section', text: { type: 'mrkdwn', text: ':bell: Reminder for learner ' + (input.learnerId || '') } }];
  }

  buildAdminSummary(input) {
    return [{ type: 'section', text: { type: 'mrkdwn', text: '*Weekly Summary*\n' + JSON.stringify(input || {}) } }];
  }

  buildSubmitModal(input) {
    return {
      type: 'modal',
      title: { type: 'plain_text', text: 'Submit Lesson' },
      private_metadata: JSON.stringify(input || {}),
      submit: { type: 'plain_text', text: 'Submit' },
      close: { type: 'plain_text', text: 'Cancel' },
      blocks: [{ type: 'input', block_id: 'lesson', element: { type: 'plain_text_input', action_id: 'lesson_id' }, label: { type: 'plain_text', text: 'Lesson ID' } }]
    };
  }

  buildGenericErrorResponse(message) {
    return [{ type: 'section', text: { type: 'mrkdwn', text: ':warning: ' + (message || 'Unexpected error') } }];
  }
}
