import { updateHomeworkAssignment } from "./update-homework-assignment";
import type { HomeworkAssignment } from "../domain/homework-types";

/**
 * Archives a homework assignment.
 */
export async function archiveHomeworkAssignment(
  teacherId: string,
  assignmentId: string
): Promise<HomeworkAssignment> {
  return await updateHomeworkAssignment(teacherId, assignmentId, {
    status: "archived",
  });
}
