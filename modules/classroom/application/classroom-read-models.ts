import type { Classroom } from "../domain/classroom-types";

/**
 * Classroom Application Read Models (Issue #85, ADR-0009)
 */

export interface ClassroomWithMemberCount extends Classroom {
  memberCount: number;
}

export interface ClassroomRosterItem {
  id: string; // membership id
  classroomId: string;
  learnerId: string;
  learnerName: string;
  learnerEmail: string;
  learnerImage: string | null;
  joinedAt: Date;
}
