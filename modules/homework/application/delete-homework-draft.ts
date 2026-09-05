import { deleteAssignment } from "../infrastructure/homework-assignment-repository";
import { assertTeacherOwnsAssignment } from "./assert-teacher-owns-assignment";
import { canDeleteHomeworkAssignment } from "../domain/homework-assignment-lifecycle";
import { ValidationError } from "@/lib/errors";

/**
 * Permanently deletes a draft assignment.
 */
export async function deleteHomeworkDraft(
  teacherId: string,
  assignmentId: string
): Promise<{ success: boolean; message: string }> {
  const { assignment: existing } = await assertTeacherOwnsAssignment(
    teacherId,
    assignmentId
  );

  if (!canDeleteHomeworkAssignment(existing.status)) {
    throw new ValidationError(
      "Chỉ có thể xóa bài tập ở trạng thái Bản nháp. Bài tập đã giao phải sử dụng tính năng Lưu trữ."
    );
  }

  await deleteAssignment(assignmentId);

  return {
    success: true,
    message: "Đã xóa bài tập bản nháp thành công.",
  };
}
