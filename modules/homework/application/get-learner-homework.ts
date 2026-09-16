import { assertLearnerEnrolledInAssignmentClassroom } from "./assert-learner-enrolled-in-assignment-classroom";
import {
  findClassroomById,
  listMembershipsByLearnerId,
} from "@/modules/classroom/infrastructure/classroom-repository";
import { listAssignmentsByClassroomId } from "../infrastructure/homework-assignment-repository";
import {
  findSubmissionByAssignmentAndLearner,
  listAttemptsBySubmissionId,
  findAttemptByNumber,
} from "../infrastructure/homework-submission-repository";
import { findPublishedAssessmentBySubmission } from "../infrastructure/homework-assessment-repository";
import type { LearnerHomeworkDetail } from "./homework-read-models";
import type { HomeworkAssignment } from "../domain/homework-types";

export interface LearnerAssignmentListItem {
  assignment: HomeworkAssignment;
  classroom: {
    id: string;
    name: string;
  };
  submissionStatus: "not_submitted" | "submitted" | "in_review" | "published";
  attemptCount: number;
  publishedScore: number | null;
}

/**
 * Retrieves assignment details, classroom information, and current submission status for a learner.
 */
export async function getLearnerAssignmentDetails(
  learnerId: string,
  assignmentId: string
): Promise<LearnerHomeworkDetail> {
  const assignment = await assertLearnerEnrolledInAssignmentClassroom(
    learnerId,
    assignmentId
  );

  const classroom = await findClassroomById(assignment.classroomId);
  const classroomInfo = {
    id: assignment.classroomId,
    name: classroom?.name || "Lớp học",
  };

  const submission = await findSubmissionByAssignmentAndLearner(
    assignmentId,
    learnerId
  );

  if (!submission) {
    return {
      assignment,
      classroom: classroomInfo,
      submission: null,
      currentAttempt: null,
      allAttempts: [],
    };
  }

  const allAttempts = await listAttemptsBySubmissionId(submission.id);
  const currentAttempt =
    (await findAttemptByNumber(
      submission.id,
      submission.currentAttemptNumber
    )) ||
    allAttempts[allAttempts.length - 1] ||
    null;

  let publishedAssessment = null;
  if (submission.status === "published") {
    publishedAssessment = await findPublishedAssessmentBySubmission(
      submission.id
    );
  }

  return {
    assignment,
    classroom: classroomInfo,
    submission,
    currentAttempt,
    allAttempts,
    publishedAssessment,
  };
}

/**
 * Lists all published homework assignments for the classrooms the learner is enrolled in,
 * together with submission progress and published scores.
 */
export async function listLearnerAssignments(
  learnerId: string
): Promise<LearnerAssignmentListItem[]> {
  const memberships = await listMembershipsByLearnerId(learnerId);
  const items: LearnerAssignmentListItem[] = [];

  for (const membership of memberships) {
    const classroom = await findClassroomById(membership.classroomId);
    const assignments = await listAssignmentsByClassroomId(
      membership.classroomId
    );

    for (const assignment of assignments) {
      if (assignment.status !== "published") continue;

      const submission = await findSubmissionByAssignmentAndLearner(
        assignment.id,
        learnerId
      );

      let submissionStatus: LearnerAssignmentListItem["submissionStatus"] =
        "not_submitted";
      let attemptCount = 0;
      let publishedScore: number | null = null;

      if (submission) {
        submissionStatus = submission.status;
        attemptCount = submission.currentAttemptNumber;

        if (submission.status === "published") {
          const published = await findPublishedAssessmentBySubmission(
            submission.id
          );
          if (published) {
            publishedScore = published.overallBand;
          }
        }
      }

      items.push({
        assignment,
        classroom: {
          id: membership.classroomId,
          name: classroom?.name || "Lớp học",
        },
        submissionStatus,
        attemptCount,
        publishedScore,
      });
    }
  }

  // Sort by deadline ascending (soonest deadline first)
  return items.sort(
    (a, b) =>
      new Date(a.assignment.submissionDeadline).getTime() -
      new Date(b.assignment.submissionDeadline).getTime()
  );
}
