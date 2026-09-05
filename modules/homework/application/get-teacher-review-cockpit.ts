import { findAttemptByNumber } from "../infrastructure/homework-submission-repository";
import { listClassroomRoster } from "@/modules/classroom/infrastructure/classroom-repository";
import {
  findAiProposalByAttemptId,
  findTeacherAssessmentBySubmission,
  findPublishedAssessmentBySubmission,
} from "../infrastructure/homework-assessment-repository";
import { resolveAttemptForReview } from "../domain/homework-submission-lifecycle";
import type { TeacherReviewCockpitData } from "./homework-read-models";
import { assertTeacherOwnsSubmission } from "./assert-teacher-owns-submission";
import { NotFoundError } from "@/lib/errors";

export async function getTeacherReviewCockpit(
  teacherId: string,
  submissionId: string
): Promise<TeacherReviewCockpitData> {
  const { submission, assignment } = await assertTeacherOwnsSubmission(
    teacherId,
    submissionId
  );

  // Before review, CurrentAttempt is the candidate; after review claim, ReviewedAttempt is authoritative
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

  // AI Proposal (if any)
  const aiProposal = await findAiProposalByAttemptId(attempt.id);

  // Teacher review draft (if any)
  const teacherDraft = await findTeacherAssessmentBySubmission(submission.id);

  // Published assessment (if already published)
  const publishedAssessment = await findPublishedAssessmentBySubmission(
    submission.id
  );

  const members = await listClassroomRoster(assignment.classroomId);
  const member = members.find((m) => m.learnerId === submission.learnerId);

  return {
    assignment,
    submission,
    attempt,
    student: {
      id: submission.learnerId,
      name:
        member?.learnerName || `Học viên ${submission.learnerId.slice(0, 6)}`,
      email: member?.learnerEmail || `${submission.learnerId}@learner.local`,
      avatarUrl: member?.learnerImage || null,
    },
    aiProposal,
    teacherDraft,
    publishedAssessment,
  };
}
