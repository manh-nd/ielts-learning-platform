import { listAssignmentsByClassroomId } from "../infrastructure/homework-assignment-repository";
import { assertTeacherOwnsClassroom } from "@/modules/classroom/application/classroom-service";
import type { HomeworkAssignment } from "../domain/homework-types";
import { ValidationError } from "@/lib/errors";

/**
 * Lists all homework assignments for a specific classroom owned by the teacher.
 */
export async function listHomeworkAssignmentsByClassroom(
  teacherId: string,
  classroomId: string
): Promise<HomeworkAssignment[]> {
  if (!teacherId) {
    throw new ValidationError("Thiếu thông tin định danh giáo viên.");
  }
  if (!classroomId) {
    throw new ValidationError("Thiếu mã lớp học.");
  }

  await assertTeacherOwnsClassroom(teacherId, classroomId);
  return await listAssignmentsByClassroomId(classroomId);
}
