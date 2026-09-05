import { createAssignment } from "../infrastructure/homework-assignment-repository";
import { assertTeacherOwnsClassroom } from "@/modules/classroom/application/classroom-service";
import type { HomeworkAssignment } from "../domain/homework-types";
import type { CreateHomeworkAssignmentInput } from "./homework-inputs";
import { ValidationError } from "@/lib/errors";
import {
  validateAssignmentTitleForCreation,
  validateAssignmentInstructions,
  validateAndNormalizePrompts,
  parseAndValidateDeadline,
} from "./validate-assignment-input";

/**
 * Creates a new homework assignment for a classroom owned by the teacher.
 */
export async function createHomeworkAssignment(
  teacherId: string,
  classroomId: string,
  input: CreateHomeworkAssignmentInput
): Promise<HomeworkAssignment> {
  if (!teacherId) {
    throw new ValidationError("Thiếu thông tin định danh giáo viên.");
  }
  if (!classroomId) {
    throw new ValidationError("Thiếu mã lớp học.");
  }

  // 1. Enforce teacher ownership of classroom
  await assertTeacherOwnsClassroom(teacherId, classroomId);

  // 2. Validate title
  const title = validateAssignmentTitleForCreation(input?.title);

  // 3. Validate instructions
  const instructions = validateAssignmentInstructions(input?.instructions);

  // 4. Validate prompts (1 to 3 discrete prompts)
  const normalizedPrompts = validateAndNormalizePrompts(input?.prompts);

  // 5. Validate submission deadline (must be in future relative to current instant)
  const deadline = parseAndValidateDeadline(
    input?.submissionDeadline,
    new Date(),
    true
  );

  // 6. Status: defaults to published unless explicitly specified as draft
  const status = input?.status === "draft" ? "draft" : "published";

  return await createAssignment({
    classroomId,
    teacherId,
    title,
    instructions,
    prompts: normalizedPrompts,
    submissionDeadline: deadline,
    status,
  });
}
