import {
  createAssignment,
  findAssignmentById,
  listAssignmentsByClassroomId,
  updateAssignment,
  deleteAssignment,
} from "../infrastructure/homework-assignment-repository";
import {
  assertTeacherOwnsClassroom,
  getClassroomRoster,
} from "@/modules/classroom/application/classroom-service";
import type {
  HomeworkAssignment,
  HomeworkAssignmentDetail,
  HomeworkPromptItem,
  CreateHomeworkAssignmentInput,
  UpdateHomeworkAssignmentInput,
  HomeworkAssignmentStudentRosterItem,
} from "../domain/homework-types";
import { ValidationError, NotFoundError } from "@/lib/errors";

/**
 * Validates and normalizes prompt items (1 to 3 items, valid part number, auto-generated IDs).
 */
function validateAndNormalizePrompts(
  prompts: Array<{
    promptId?: string;
    text: string;
    partNumber: number;
    subPrompts?: string[];
  }>
): HomeworkPromptItem[] {
  if (!Array.isArray(prompts) || prompts.length < 1 || prompts.length > 3) {
    throw new ValidationError(
      "Một bài tập Speaking phải có từ 1 đến 3 câu hỏi (prompt items)."
    );
  }

  return prompts.map((p, idx) => {
    const text = p.text?.trim();
    if (!text) {
      throw new ValidationError(
        `Nội dung câu hỏi thứ ${idx + 1} không được để trống.`
      );
    }
    if (text.length > 2000) {
      throw new ValidationError(
        `Nội dung câu hỏi thứ ${idx + 1} không được vượt quá 2000 ký tự.`
      );
    }

    const partNumber = Number(p.partNumber);
    if (![1, 2, 3].includes(partNumber)) {
      throw new ValidationError(
        `Phần thi (Part) cho câu hỏi thứ ${idx + 1} phải là 1, 2 hoặc 3.`
      );
    }

    return {
      promptId: p.promptId?.trim() || crypto.randomUUID(),
      text,
      partNumber: partNumber as 1 | 2 | 3,
      subPrompts: Array.isArray(p.subPrompts)
        ? p.subPrompts.map((s) => s.trim()).filter((s) => s.length > 0)
        : undefined,
    };
  });
}

/**
 * Parses and validates submission deadline.
 */
function parseAndValidateDeadline(
  deadlineInput: Date | string,
  mustBeInFuture = true
): Date {
  const deadline =
    deadlineInput instanceof Date ? deadlineInput : new Date(deadlineInput);

  if (isNaN(deadline.getTime())) {
    throw new ValidationError("Hạn nộp bài (submissionDeadline) không hợp lệ.");
  }

  if (mustBeInFuture && deadline.getTime() <= Date.now()) {
    throw new ValidationError(
      "Hạn nộp bài phải là một mốc thời gian trong tương lai."
    );
  }

  return deadline;
}

/**
 * Creates a new homework assignment for a classroom owned by the teacher.
 */
export async function createTeacherHomeworkAssignment(
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
  const title = input?.title?.trim();
  if (!title || title.length > 255) {
    throw new ValidationError(
      "Tiêu đề bài tập là bắt buộc và không được vượt quá 255 ký tự."
    );
  }

  // 3. Validate instructions
  const instructions = input?.instructions?.trim() || null;
  if (instructions && instructions.length > 5000) {
    throw new ValidationError(
      "Hướng dẫn làm bài không được vượt quá 5000 ký tự."
    );
  }

  // 4. Validate prompts (1 to 3 discrete prompts)
  const normalizedPrompts = validateAndNormalizePrompts(input.prompts);

  // 5. Validate submission deadline (must be in future)
  const deadline = parseAndValidateDeadline(input.submissionDeadline, true);

  // 6. Status
  const status = input.status === "published" ? "published" : "draft";

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

/**
 * Retrieves assignment details, classroom summary, and student submission roster.
 */
export async function getTeacherAssignmentDetails(
  teacherId: string,
  assignmentId: string
): Promise<HomeworkAssignmentDetail> {
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

  // Enforce teacher owns the classroom for this assignment
  const classroom = await assertTeacherOwnsClassroom(
    teacherId,
    assignment.classroomId
  );

  // Fetch enrolled students roster
  const rosterMembers = await getClassroomRoster(
    teacherId,
    assignment.classroomId
  );

  // Map to student roster items (ready for submission linkage in Ticket #75)
  const students: HomeworkAssignmentStudentRosterItem[] = rosterMembers.map(
    (m) => ({
      learnerId: m.learnerId,
      learnerName: m.learnerName,
      learnerEmail: m.learnerEmail,
      learnerImage: m.learnerImage,
      submissionStatus: "not_submitted",
      submittedAt: null,
      submissionId: null,
    })
  );

  return {
    assignment,
    classroom: {
      id: classroom.id,
      name: classroom.name,
    },
    students,
  };
}

/**
 * Lists all homework assignments for a specific classroom.
 */
export async function listTeacherAssignmentsByClassroom(
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

/**
 * Updates a homework assignment. Enforces prompt immutability for published assignments
 * and extension-only deadlines.
 */
export async function updateTeacherHomeworkAssignment(
  teacherId: string,
  assignmentId: string,
  input: UpdateHomeworkAssignmentInput
): Promise<HomeworkAssignment> {
  if (!teacherId) {
    throw new ValidationError("Thiếu thông tin định danh giáo viên.");
  }
  if (!assignmentId) {
    throw new ValidationError("Thiếu mã bài tập.");
  }

  const existing = await findAssignmentById(assignmentId);
  if (!existing) {
    throw new NotFoundError("Không tìm thấy bài tập được yêu cầu.");
  }

  await assertTeacherOwnsClassroom(teacherId, existing.classroomId);

  if (existing.status === "archived") {
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
    const title = input.title.trim();
    if (!title || title.length > 255) {
      throw new ValidationError(
        "Tiêu đề bài tập không được để trống và không vượt quá 255 ký tự."
      );
    }
    updates.title = title;
  }

  // Instructions validation
  if (input.instructions !== undefined) {
    if (input.instructions === null) {
      updates.instructions = null;
    } else {
      const instructions = input.instructions.trim();
      if (instructions.length > 5000) {
        throw new ValidationError(
          "Hướng dẫn làm bài không được vượt quá 5000 ký tự."
        );
      }
      updates.instructions = instructions || null;
    }
  }

  // Prompts and Deadline validations based on status
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
        false
      );
      if (newDeadline.getTime() < existing.submissionDeadline.getTime()) {
        throw new ValidationError(
          "Hạn nộp bài đã giao chỉ có thể gia hạn thêm, không được rút ngắn hồi tố."
        );
      }
      updates.submissionDeadline = newDeadline;
    }
  } else {
    // Draft mode: prompts can be edited
    if (input.prompts !== undefined) {
      updates.prompts = validateAndNormalizePrompts(input.prompts);
    }

    if (input.submissionDeadline !== undefined) {
      updates.submissionDeadline = parseAndValidateDeadline(
        input.submissionDeadline,
        true
      );
    }
  }

  // Status transitions
  if (input.status !== undefined) {
    if (input.status === "published") {
      // If publishing from draft, ensure deadline is in the future
      const targetDeadline =
        updates.submissionDeadline || existing.submissionDeadline;
      if (targetDeadline.getTime() <= Date.now()) {
        throw new ValidationError(
          "Không thể xuất bản bài tập với hạn nộp đã quá hạn. Vui lòng gia hạn thời gian nộp bài."
        );
      }
      updates.status = "published";
    } else if (input.status === "archived") {
      updates.status = "archived";
    } else if (input.status === "draft") {
      if (existing.status === "published") {
        throw new ValidationError(
          "Bài tập đã xuất bản không thể chuyển ngược lại thành bản nháp."
        );
      }
      updates.status = "draft";
    }
  }

  return await updateAssignment(assignmentId, updates);
}

/**
 * Permanently deletes an unassigned draft assignment.
 */
export async function deleteTeacherDraftAssignment(
  teacherId: string,
  assignmentId: string
): Promise<{ success: boolean; message: string }> {
  if (!teacherId) {
    throw new ValidationError("Thiếu thông tin định danh giáo viên.");
  }
  if (!assignmentId) {
    throw new ValidationError("Thiếu mã bài tập.");
  }

  const existing = await findAssignmentById(assignmentId);
  if (!existing) {
    throw new NotFoundError("Không tìm thấy bài tập được yêu cầu.");
  }

  await assertTeacherOwnsClassroom(teacherId, existing.classroomId);

  if (existing.status !== "draft") {
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

/**
 * Archives a published homework assignment.
 */
export async function archiveTeacherHomeworkAssignment(
  teacherId: string,
  assignmentId: string
): Promise<HomeworkAssignment> {
  return await updateTeacherHomeworkAssignment(teacherId, assignmentId, {
    status: "archived",
  });
}
