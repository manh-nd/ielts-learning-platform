import { listSubmissionsByAssignmentId } from "../infrastructure/homework-submission-repository";
import { getClassroomRoster } from "@/modules/classroom/application/classroom-service";
import { assertTeacherOwnsAssignment } from "./assert-teacher-owns-assignment";
import type {
  HomeworkAssignmentDetail,
  HomeworkAssignmentStudentRosterItem,
  HomeworkRosterSubmissionStatus,
} from "./homework-read-models";

/**
 * Retrieves assignment details, classroom summary, and student submission roster for an authorized teacher.
 */
export async function getHomeworkAssignmentDetail(
  teacherId: string,
  assignmentId: string
): Promise<HomeworkAssignmentDetail> {
  const { assignment, classroom } = await assertTeacherOwnsAssignment(
    teacherId,
    assignmentId
  );

  // Fetch enrolled students roster
  const rosterMembers = await getClassroomRoster(
    teacherId,
    assignment.classroomId
  );

  // Link actual homework submissions for each enrolled student
  const submissions = await listSubmissionsByAssignmentId(assignmentId);
  const submissionMap = new Map(submissions.map((s) => [s.learnerId, s]));

  const students: HomeworkAssignmentStudentRosterItem[] = rosterMembers.map(
    (m) => {
      const sub = submissionMap.get(m.learnerId);
      let status: HomeworkRosterSubmissionStatus = "not_submitted";
      if (sub) {
        if (sub.status === "in_review") {
          status = "under_review";
        } else if (sub.status === "published") {
          status = "published";
        } else {
          status = "submitted";
        }
      }
      return {
        learnerId: m.learnerId,
        learnerName: m.learnerName,
        learnerEmail: m.learnerEmail,
        learnerImage: m.learnerImage,
        submissionStatus: status,
        submittedAt: sub ? sub.createdAt : null,
        submissionId: sub ? sub.id : null,
      };
    }
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
