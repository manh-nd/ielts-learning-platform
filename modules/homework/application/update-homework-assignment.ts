import { updateAssignment } from "../infrastructure/homework-assignment-repository";
import { assertTeacherOwnsAssignment } from "./assert-teacher-owns-assignment";
import {
  canEditHomeworkAssignment,
  canTransitionAssignmentStatus,
} from "../domain/homework-assignment-lifecycle";
import {
  isSubmissionDeadlineInFuture,
  canExtendSubmissionDeadline,
} from "../domain/homework-deadline-policy";
import type { HomeworkAssignment } from "../domain/homework-types";
import type { UpdateHomeworkAssignmentInput } from "./homework-inputs";
import { ValidationError } from "@/lib/errors";
import {
  validateAssignmentTitleForUpdate,
  validateAssignmentInstructions,
  validateAndNormalizePrompts,
  parseAndValidateDeadline,
} from "./validate-assignment-input";

/**
 * Updates a homework assignment.
 * Enforces prompt immutability for published assignments and extension-only deadlines.
 */
export async function updateHomeworkAssignment(
  teacherId: string,
  assignmentId: string,
  input: UpdateHomeworkAssignmentInput
): Promise<HomeworkAssignment> {
  const { assignment: existing } = await assertTeacherOwnsAssignment(
    teacherId,
    assignmentId
  );

  if (!canEditHomeworkAssignment(existing.status)) {
    throw new ValidationError("Không thể chỉnh sửa bài tập đã lưu trữ.");
  }

  const updates: Partial<
    Pick<
      HomeworkAssignment,
      "title" | "instructions" | "prompts" | "submissionDeadline" | "status"
    >
  > = {};

  // Title validation
  if (input.title !== undefined) {
    updates.title = validateAssignmentTitleForUpdate(input.title);
  }

  // Instructions validation
  if (input.instructions !== undefined) {
    updates.instructions = validateAssignmentInstructions(input.instructions);
  }

  const now = new Date();

  // Prompts and Deadline validations based on current status
  if (existing.status === "published") {
    // 1. Prompts are IMMUTABLE once published
    if (input.prompts !== undefined) {
      throw new ValidationError(
        "Không thể sửa đổi nội dung câu hỏi sau khi bài tập đã được giao/xuất bản."
      );
    }

    // 2. Deadline can only be EXTENDED
    if (input.submissionDeadline !== undefined) {
      const newDeadline = parseAndValidateDeadline(
        input.submissionDeadline,
        now,
        false
      );
      if (
        !canExtendSubmissionDeadline(existing.submissionDeadline, newDeadline)
      ) {
        throw new ValidationError(
          "Hạn nộp bài đã giao chỉ có thể gia hạn thêm, không được rút ngắn hồi tố."
        );
      }
      updates.submissionDeadline = newDeadline;
    }
  } else {
    // Draft mode: prompts and deadlines can be edited
    if (input.prompts !== undefined) {
      updates.prompts = validateAndNormalizePrompts(input.prompts);
    }

    if (input.submissionDeadline !== undefined) {
      updates.submissionDeadline = parseAndValidateDeadline(
        input.submissionDeadline,
        now,
        true
      );
    }
  }

  // Status transitions
  if (input.status !== undefined) {
    if (!canTransitionAssignmentStatus(existing.status, input.status)) {
      if (existing.status === "published" && input.status === "draft") {
        throw new ValidationError(
          "Bài tập đã xuất bản không thể chuyển ngược lại thành bản nháp."
        );
      }
      throw new ValidationError("Không thể chuyển đổi trạng thái bài tập.");
    }

    if (input.status === "published") {
      // If publishing, ensure target deadline is in the future
      const targetDeadline =
        updates.submissionDeadline || existing.submissionDeadline;
      if (!isSubmissionDeadlineInFuture(targetDeadline, now)) {
        throw new ValidationError(
          "Không thể xuất bản bài tập với hạn nộp đã quá hạn. Vui lòng gia hạn thời gian nộp bài."
        );
      }
      updates.status = "published";
    } else if (input.status === "archived") {
      updates.status = "archived";
    } else if (input.status === "draft") {
      updates.status = "draft";
    }
  }

  return await updateAssignment(assignmentId, updates);
}
