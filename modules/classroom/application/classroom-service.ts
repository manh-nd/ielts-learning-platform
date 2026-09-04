import {
  createClassroom,
  findClassroomById,
  listClassroomsByTeacherId,
  findMember,
  enrollMember,
  removeMember,
  listClassroomMembers,
  findUserByEmail,
} from "../infrastructure/classroom-repository";
import type {
  Classroom,
  ClassroomWithMemberCount,
  ClassroomMemberDetail,
  CreateClassroomInput,
} from "../domain/classroom-types";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "@/lib/errors";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Creates a classroom for the authenticated teacher.
 */
export async function createTeacherClassroom(
  teacherId: string,
  input: CreateClassroomInput
): Promise<Classroom> {
  if (!teacherId) {
    throw new ValidationError("Thiếu thông tin định danh giáo viên.");
  }

  const name = input?.name?.trim();
  if (!name || name.length > 255) {
    throw new ValidationError(
      "Tên lớp học là bắt buộc và không được vượt quá 255 ký tự."
    );
  }

  const description = input.description?.trim();
  if (description && description.length > 2000) {
    throw new ValidationError("Mô tả lớp học không được vượt quá 2000 ký tự.");
  }

  return await createClassroom(teacherId, {
    name,
    description: description || null,
  });
}

/**
 * Retrieves all classrooms owned by the specified teacher.
 */
export async function getTeacherClassrooms(
  teacherId: string
): Promise<ClassroomWithMemberCount[]> {
  if (!teacherId) {
    throw new ValidationError("Thiếu thông tin định danh giáo viên.");
  }

  return await listClassroomsByTeacherId(teacherId);
}

/**
 * Enrolls a learner into a classroom by resolving their existing user account email.
 * Preserves Single-Teacher ownership and Identity & Membership boundary invariants (Ticket #53, ADR-0009).
 */
export async function enrollLearnerInClassroom(
  teacherId: string,
  classroomId: string,
  email: string
): Promise<ClassroomMemberDetail> {
  if (!teacherId) {
    throw new ValidationError("Thiếu thông tin định danh giáo viên.");
  }
  if (!classroomId) {
    throw new ValidationError("Thiếu thông tin mã lớp học.");
  }

  const normalizedEmail = email?.trim()?.toLowerCase();
  if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
    throw new ValidationError("Email học viên không đúng định dạng.");
  }

  // 1. Verify classroom exists
  const classroom = await findClassroomById(classroomId);
  if (!classroom) {
    throw new NotFoundError("Không tìm thấy lớp học được yêu cầu.");
  }

  // 2. Enforce Single-Teacher ownership invariant: Teacher A cannot modify Teacher B's classroom
  if (classroom.teacherId !== teacherId) {
    throw new ForbiddenError(
      "Bị từ chối: Bạn không có quyền thêm học viên vào lớp học của giáo viên khác."
    );
  }

  // 3. Resolve existing user account by email
  const user = await findUserByEmail(normalizedEmail);
  if (!user) {
    throw new NotFoundError(
      "Không tìm thấy tài khoản học viên với email này. Học viên cần đăng ký hoặc đăng nhập tài khoản trước khi được thêm vào lớp."
    );
  }

  // 4. Verify user role: only learners can be enrolled into classrooms
  if (user.role !== "learner") {
    throw new ValidationError(
      "Chỉ có thể thêm tài khoản có vai trò học viên (learner) vào danh sách lớp."
    );
  }

  // 5. Enforce uniqueness: duplicate enrollment rejection
  const existingMember = await findMember(classroomId, user.id);
  if (existingMember) {
    throw new ConflictError("Học viên này đã có trong danh sách lớp học.");
  }

  // 6. Persist enrollment
  const member = await enrollMember(classroomId, user.id);

  return {
    id: member.id,
    classroomId: member.classroomId,
    learnerId: user.id,
    learnerName: user.name,
    learnerEmail: user.email,
    learnerImage: user.image,
    joinedAt: member.joinedAt,
  };
}

/**
 * Removes a learner from a classroom roster.
 * Preserves historical user accounts and submissions (Ticket #53 Invariant 2).
 */
export async function removeLearnerFromClassroom(
  teacherId: string,
  classroomId: string,
  learnerId: string
): Promise<{ success: boolean; message: string }> {
  if (!teacherId) {
    throw new ValidationError("Thiếu thông tin định danh giáo viên.");
  }
  if (!classroomId || !learnerId) {
    throw new ValidationError("Thiếu thông tin lớp học hoặc học viên.");
  }

  const classroom = await findClassroomById(classroomId);
  if (!classroom) {
    throw new NotFoundError("Không tìm thấy lớp học được yêu cầu.");
  }

  if (classroom.teacherId !== teacherId) {
    throw new ForbiddenError(
      "Bị từ chối: Bạn không có quyền quản lý học viên trong lớp học của giáo viên khác."
    );
  }

  const existingMember = await findMember(classroomId, learnerId);
  if (!existingMember) {
    throw new NotFoundError("Học viên không tồn tại trong lớp học này.");
  }

  await removeMember(classroomId, learnerId);

  return {
    success: true,
    message: "Đã xóa học viên khỏi danh sách lớp học.",
  };
}

/**
 * Retrieves the full roster of enrolled learners for a classroom.
 */
export async function getClassroomRoster(
  teacherId: string,
  classroomId: string
): Promise<ClassroomMemberDetail[]> {
  if (!teacherId) {
    throw new ValidationError("Thiếu thông tin định danh giáo viên.");
  }
  if (!classroomId) {
    throw new ValidationError("Thiếu thông tin mã lớp học.");
  }

  const classroom = await findClassroomById(classroomId);
  if (!classroom) {
    throw new NotFoundError("Không tìm thấy lớp học được yêu cầu.");
  }

  if (classroom.teacherId !== teacherId) {
    throw new ForbiddenError(
      "Bị từ chối: Bạn không có quyền xem danh sách lớp học của giáo viên khác."
    );
  }

  return await listClassroomMembers(classroomId);
}
