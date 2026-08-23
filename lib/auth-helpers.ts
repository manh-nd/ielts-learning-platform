import type { UserRole } from "@/modules/identity/infrastructure/auth-schema";

/**
 * Parses a comma-separated list of teacher emails, trimming whitespace and converting to lowercase.
 */
export function parseTeacherEmails(teacherEmailsEnv?: string): string[] {
  if (!teacherEmailsEnv) {
    return [];
  }
  return teacherEmailsEnv
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

/**
 * Checks if the given email matches any email in the teacher emails list.
 */
export function isTeacherEmail(
  email: string | null | undefined,
  teacherEmailsEnv?: string
): boolean {
  if (!email) {
    return false;
  }
  const teachers = parseTeacherEmails(
    teacherEmailsEnv !== undefined
      ? teacherEmailsEnv
      : process.env.TEACHER_EMAILS
  );
  return teachers.includes(email.trim().toLowerCase());
}

/**
 * Resolves the user role based on email address.
 * Matches TEACHER_EMAILS -> "teacher", otherwise forces "learner".
 */
export function resolveUserRole(
  email: string | null | undefined,
  teacherEmailsEnv?: string
): UserRole {
  return isTeacherEmail(email, teacherEmailsEnv) ? "teacher" : "learner";
}
