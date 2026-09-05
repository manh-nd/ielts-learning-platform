/**
 * Classroom Application Use-Case Inputs (Issue #85, ADR-0009)
 */

export interface CreateClassroomInput {
  name: string;
  description?: string | null;
}

export interface UpdateClassroomInput {
  name?: string;
  description?: string | null;
}

export interface AddLearnerMembershipInput {
  email: string;
}
