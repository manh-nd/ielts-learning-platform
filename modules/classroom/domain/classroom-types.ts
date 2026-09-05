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

export interface Membership {
  id: string;
  classroomId: string;
  learnerId: string;
  joinedAt: Date;
}
