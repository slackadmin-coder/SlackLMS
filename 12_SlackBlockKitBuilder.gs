class SlackBlockKitBuilder {
  buildWelcomeMessage(input) {
    return [{ type: 'section', text: { type: 'mrkdwn', text: '*Welcome to RWR LMS*\nCourse: ' + (input.courseId || '') } }];
  }

  buildLessonCard(input) {
    var lessonId = input.id || input.lessonId || '';
    var title = input.title || 'Lesson';
    var contentRef = input.contentRef || '[Insert Training Link]';
    var submitCmd = '/submit ' + lessonId + ' complete';

    return [
      { type: 'header', text: { type: 'plain_text', text: title, emoji: true } },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':books: *Complete the training here:* <' + contentRef + '|Open Lesson>\n\n:bulb: *Tip:* Take notes as you go — you\'ll need them for the verification question.'
        }
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'When done, type: `' + submitCmd + '` or react with :white_check_mark:'
        }
      },
      { type: 'context', elements: [{ type: 'mrkdwn', text: lessonId }] }
    ];
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

  buildChannelAnnouncement(input) {
    return [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':tada: Please welcome *' + (input.name || 'our new team member') + '* to the team!\nTheir first day is ' + (input.startDate || 'soon') + '.\nBuddy: ' + (input.buddy || 'TBC') + '. Manager: ' + (input.manager || 'TBC') + '.'
      }
    }];
  }

  buildReflectionPrompt(input) {
    return [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: ':thought_balloon: *Reflection Prompt*\n\nTake a moment to reflect on your progress this ' + (input.period || 'week') + '. What\'s one thing you learned? What\'s one thing you\'d do differently?' }
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: 'No submission required — this is for your own reflection.' }]
      }
    ];
  }

  buildProTip(input) {
    return [{
      type: 'section',
      text: { type: 'mrkdwn', text: ':bulb: *Pro Tip*\n\n' + (input.tip || 'Keep building your skills and ask questions early.') }
    }];
  }

  buildShadowingPrompt(input) {
    return [
      { type: 'header', text: { type: 'plain_text', text: ':eyes: Shadowing Session: ' + (input.topic || 'Observation'), emoji: true } },
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: (input.instructions || 'Post your observations in the thread below after the session.') } }
    ];
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
