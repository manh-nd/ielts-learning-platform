import { findSubmissionById } from "../infrastructure/homework-submission-repository";
import { findAssignmentById } from "../infrastructure/homework-assignment-repository";
import { findClassroomById } from "@/modules/classroom/infrastructure/classroom-repository";
import { ValidationError, NotFoundError, ForbiddenError } from "@/lib/errors";

export async function assertTeacherOwnsSubmission(
  teacherId: string,
  submissionId: string
) {
  if (!teacherId) {
    throw new ValidationError("Thiếu thông tin định danh giáo viên.");
  }
  if (!submissionId) {
    throw new ValidationError("Thiếu mã bài nộp.");
  }

  const submission = await findSubmissionById(submissionId);
  if (!submission) {
    throw new NotFoundError("Không tìm thấy bài nộp được yêu cầu.");
  }

  const assignment = await findAssignmentById(submission.assignmentId);
  if (!assignment) {
    throw new NotFoundError("Không tìm thấy bài tập tương ứng.");
  }

  const classroom = await findClassroomById(assignment.classroomId);
  if (!classroom) {
    throw new NotFoundError("Không tìm thấy lớp học tương ứng.");
  }

  if (classroom.teacherId !== teacherId) {
    throw new ForbiddenError(
      "Bạn không có quyền truy cập hoặc chấm bài nộp của lớp học này."
    );
  }

  return { submission, assignment, classroom };
}
