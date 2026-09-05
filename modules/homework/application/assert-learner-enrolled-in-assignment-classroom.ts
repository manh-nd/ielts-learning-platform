import { findAssignmentById } from "../infrastructure/homework-assignment-repository";
import { findMembership } from "@/modules/classroom/infrastructure/classroom-repository";
import { ValidationError, NotFoundError, ForbiddenError } from "@/lib/errors";

/**
 * Validates learner membership and homework assignment availability.
 */
export async function assertLearnerEnrolledInAssignmentClassroom(
  learnerId: string,
  assignmentId: string
) {
  if (!learnerId) {
    throw new ValidationError("Thiếu thông tin định danh học viên.");
  }
  if (!assignmentId) {
    throw new ValidationError("Thiếu mã bài tập.");
  }

  const assignment = await findAssignmentById(assignmentId);
  if (!assignment) {
    throw new NotFoundError("Không tìm thấy bài tập được yêu cầu.");
  }

  // Verify learner has active membership in the classroom
  const member = await findMembership(assignment.classroomId, learnerId);
  if (!member) {
    throw new ForbiddenError("Bạn không phải là thành viên của lớp học này.");
  }

  // Learner can only see published assignments (drafts are teacher-private)
  if (assignment.status !== "published") {
    throw new ForbiddenError(
      "Bài tập này chưa được xuất bản hoặc đã bị thu hồi."
    );
  }

  return assignment;
}
