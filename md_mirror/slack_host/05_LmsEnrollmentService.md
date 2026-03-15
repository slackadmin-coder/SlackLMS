# 05_LmsEnrollmentService.gs

**Source path:** `slack_host/05_LmsEnrollmentService.gs`

```javascript
/**
 * LMS enrollment operations implemented using the SheetDb library only.
 */
class LmsEnrollmentService {
  /**
   * @param {DbClient} db
   */
  constructor(db) {
    this._db = db;
  }

  /**
   * Slash-command flow example:
   * /enroll-student <studentId> <courseId>
   *
   * Upserts into `students` and `enrollments`, then writes audit log row.
   * @param {Object} context
   * @param {Object} payload
   * @return {Object}
   */
  enrollFromSlash(context, payload) {
    var args = String(payload.text || '').split(/\s+/).filter(function(v) { return !!v; });
    if (args.length < 2) {
      return { ok: false, code: 'INVALID_ARGUMENTS', message: 'Usage: /enroll-student <studentId> <courseId>', data: {} };
    }

    var studentId = args[0];
    var courseId = args[1];
    var out = this._upsertEnrollment(context, studentId, courseId, 'slash_command');
    return out;
  }

  /**
   * Workflow webhook flow example for enrollment updates/inserts.
   * @param {Object} context
   * @param {Object} payload
   * @return {Object}
   */
  upsertFromWorkflow(context, payload) {
    if (!payload.studentId || !payload.courseId) {
      return { ok: false, code: 'INVALID_WORKFLOW_PAYLOAD', message: 'studentId and courseId are required.', data: {} };
    }

    return this._upsertEnrollment(context, payload.studentId, payload.courseId, 'workflow_webhook', payload.status || 'enrolled');
  }

  /** @private */
  _upsertEnrollment(context, studentId, courseId, source, status) {
    var students = this._db.table('students');
    var enrollments = this._db.table('enrollments');
    var audit = this._db.table('audit_logs');
    var finalStatus = status || 'enrolled';
    var enrollmentRecord;

    this._db.transaction(function() {
      var existingStudent = students.findById(studentId);
      if (!existingStudent) {
        students.insert({ id: studentId, name: studentId, source: source });
      }

      var existingEnrollment = enrollments.findAll().filter(function(r) {
        return r.studentId === studentId && r.courseId === courseId;
      })[0];

      if (existingEnrollment) {
        enrollmentRecord = enrollments.update(existingEnrollment.id, {
          status: finalStatus,
          source: source
        });
      } else {
        enrollmentRecord = enrollments.insert({
          studentId: studentId,
          courseId: courseId,
          status: finalStatus,
          source: source
        });
      }

      audit.insert({
        requestId: context.requestId,
        source: context.source,
        action: 'enrollment_upsert',
        status: 'success',
        message: 'Enrollment upsert completed.',
        metadata: JSON.stringify({ studentId: studentId, courseId: courseId, enrollmentId: enrollmentRecord.id })
      });
    });

    this._db.audit('enrollment_upsert', 'enrollments', {
      requestId: context.requestId,
      studentId: studentId,
      courseId: courseId,
      enrollmentId: enrollmentRecord.id
    });

    return {
      ok: true,
      code: 'ENROLLMENT_UPSERTED',
      message: 'Enrollment upserted successfully.',
      data: {
        enrollmentId: enrollmentRecord.id,
        studentId: studentId,
        courseId: courseId,
        status: enrollmentRecord.status
      }
    };
  }
}

```
