import { assertLearnerEnrolledInAssignmentClassroom } from "./assert-learner-enrolled-in-assignment-classroom";
import { findClassroomById } from "@/modules/classroom/infrastructure/classroom-repository";
import {
  findSubmissionByAssignmentAndLearner,
  listAttemptsBySubmissionId,
  findAttemptByNumber,
} from "../infrastructure/homework-submission-repository";
import { findPublishedAssessmentBySubmission } from "../infrastructure/homework-assessment-repository";
import type { LearnerHomeworkDetail } from "./homework-read-models";

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
