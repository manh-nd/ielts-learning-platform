import { findAssignmentById } from "../infrastructure/homework-assignment-repository";
import { assertTeacherOwnsClassroom } from "@/modules/classroom/application/classroom-service";
import type { HomeworkAssignment } from "../domain/homework-types";
import type { Classroom } from "@/modules/classroom/domain/classroom-types";
import { ValidationError, NotFoundError } from "@/lib/errors";

/**
 * Enforces teacher ownership and existence of a HomeworkAssignment via its Classroom boundary.
 */
export async function assertTeacherOwnsAssignment(
  teacherId: string,
  assignmentId: string
): Promise<{ assignment: HomeworkAssignment; classroom: Classroom }> {
  if (!teacherId) {
    throw new ValidationError("Thiếu thông tin định danh giáo viên.");
  }
  if (!assignmentId) {
    throw new ValidationError("Thiếu mã bài tập.");
  }

  const assignment = await findAssignmentById(assignmentId);
  if (!assignment) {
    throw new NotFoundError("Không tìm thấy bài tập được yêu cầu.");
  }

  const classroom = await assertTeacherOwnsClassroom(
    teacherId,
    assignment.classroomId
  );

  return { assignment, classroom };
}
