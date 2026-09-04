/**
 * Classroom & Membership Domain Models (Issue #73, Ticket #53, ADR-0009)
 */

export interface Classroom {
  id: string;
  teacherId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClassroomWithMemberCount extends Classroom {
  memberCount: number;
}

export interface ClassroomMember {
  id: string;
  classroomId: string;
  learnerId: string;
  joinedAt: Date;
}

export interface ClassroomMemberDetail {
  id: string;
  classroomId: string;
  learnerId: string;
  learnerName: string;
  learnerEmail: string;
  learnerImage: string | null;
  joinedAt: Date;
}

export interface CreateClassroomInput {
  name: string;
  description?: string | null;
}

export interface AddMemberInput {
  email: string;
}

export type EnrollLearnerInput = AddMemberInput;
