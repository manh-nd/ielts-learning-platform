import { assertLearnerEnrolledInAssignmentClassroom } from "./assert-learner-enrolled-in-assignment-classroom";
import {
  findClassroomById,
  findUserById,
} from "@/modules/classroom/infrastructure/classroom-repository";
import {
  findSubmissionByAssignmentAndLearner,
  findAttemptByNumber,
} from "../infrastructure/homework-submission-repository";
import { findPublishedAssessmentBySubmission } from "../infrastructure/homework-assessment-repository";
import { resolveAttemptForReview } from "../domain/homework-submission-lifecycle";
import type { LearnerPublishedAssessmentData } from "./homework-read-models";
import { NotFoundError, ConflictError } from "@/lib/errors";

/**
 * Retrieves finalized published assessment results for a learner on an assignment.
 * Strictly adheres to privacy invariants:
 * - Conceals raw AI proposals (AiAssessmentProposal), raw proposal JSON, AI internal logs.
 * - Conceals teacher evaluation draft histories.
 * - Only reveals finalized PublishedAssessment, teacher info, and learner submitted audio clips.
 */
export async function getLearnerPublishedAssessment(
  learnerId: string,
  assignmentId: string
): Promise<LearnerPublishedAssessmentData> {
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
    throw new NotFoundError("Chưa tìm thấy bài nộp cho bài tập này.");
  }

  if (submission.status !== "published") {
    throw new ConflictError(
      "Bài làm chưa được Giáo viên xuất bản kết quả đánh giá.",
      { status: submission.status },
      "SUBMISSION_NOT_PUBLISHED"
    );
  }

  const publishedAssessment = await findPublishedAssessmentBySubmission(
    submission.id
  );
  if (!publishedAssessment) {
    throw new NotFoundError(
      "Không tìm thấy dữ liệu đánh giá chính thức đã công bố."
    );
  }

  const reviewAttempt = resolveAttemptForReview(submission);
  const attempt = await findAttemptByNumber(
    submission.id,
    reviewAttempt.attemptNumber
  );
  if (!attempt) {
    throw new NotFoundError(
      `Không tìm thấy dữ liệu lượt nộp #${reviewAttempt.attemptNumber}.`
    );
  }

  // Resolve teacher name
  const teacherUser = await findUserById(publishedAssessment.teacherId);
  const teacherInfo = {
    id: publishedAssessment.teacherId,
    name: teacherUser?.name || "Giáo viên",
  };

  return {
    assignment,
    classroom: classroomInfo,
    submission,
    attempt,
    publishedAssessment,
    teacher: teacherInfo,
  };
}
