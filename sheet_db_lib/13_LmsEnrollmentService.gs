/**
 * LMS-focused host service that uses SheetDb tables for enrollments.
 */
class LmsEnrollmentService {
  /**
   * @param {DbClient} dbClient
   */
  constructor(dbClient) {
    this._db = dbClient;
  }

  /**
   * Enrolls a student into a course.
   * @param {{studentId: string, courseId: string, source: string, actorId: string, requestId: string}} request
   * @return {Object}
   */
  enrollStudent(request) {
    if (!request.studentId || !request.courseId) {
      return {
        ok: false,
        code: 'INVALID_ENROLLMENT_REQUEST',
        message: 'studentId and courseId are required.',
        data: {}
      };
    }

    var enrollments = this._db.table('enrollments');
    var existing = enrollments.findAll().filter(function(row) {
      return row.studentId === request.studentId && row.courseId === request.courseId;
    });
    if (existing.length > 0) {
      return {
        ok: false,
        code: 'DUPLICATE_ENROLLMENT',
        message: 'Enrollment already exists for this student/course.',
        data: { existingId: existing[0].id }
      };
    }

    var record;
    this._db.transaction(function() {
      record = enrollments.insert({
        studentId: request.studentId,
        courseId: request.courseId,
        status: 'enrolled',
        source: request.source || 'workflow'
      });
    });

    return {
      ok: true,
      code: 'ENROLLED',
      message: 'Enrollment created.',
      data: {
        enrollmentId: record.id,
        studentId: record.studentId,
        courseId: record.courseId,
        status: record.status
      }
    };
  }
}
