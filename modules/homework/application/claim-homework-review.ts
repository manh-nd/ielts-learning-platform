import { claimTeacherReview } from "../infrastructure/homework-submission-repository";
import type { HomeworkSubmission } from "../domain/homework-types";
import { getTeacherReviewAvailability } from "../domain/homework-submission-lifecycle";
import { assertTeacherOwnsSubmission } from "./assert-teacher-owns-submission";
import { observeHomeworkReview } from "./observe-homework-review";
import { NotFoundError, ConflictError } from "@/lib/errors";

export async function claimHomeworkReview(
  teacherId: string,
  submissionId: string
): Promise<HomeworkSubmission> {
  const { submission } = await assertTeacherOwnsSubmission(
    teacherId,
    submissionId
  );

  if (getTeacherReviewAvailability(submission.status) === "terminal") {
    throw new ConflictError(
      "Bài nộp đã được xuất bản kết quả đánh giá chính thức, không thể mở lại chấm.",
      { status: submission.status },
      "SUBMISSION_ALREADY_PUBLISHED"
    );
  }

  const result = await claimTeacherReview(submission.id);
  if (result.kind === "not_found") {
    throw new NotFoundError("Không tìm thấy bài nộp được yêu cầu.");
  }
  if (getTeacherReviewAvailability(result.submission.status) === "terminal") {
    throw new ConflictError(
      "Bài nộp đã được xuất bản kết quả đánh giá chính thức, không thể mở lại chấm.",
      { status: result.submission.status },
      "SUBMISSION_ALREADY_PUBLISHED"
    );
  }
  const updated = result.submission;

  observeHomeworkReview({
    userId: teacherId,
    eventName: "teacher_review_opened",
    userRole: "teacher",
    contextType: "homework",
    contextId: submission.id,
    properties: {
      assignmentId: submission.assignmentId,
      learnerId: submission.learnerId,
      reviewedAttemptNumber: updated.reviewedAttemptNumber,
    },
  });

  return updated;
}
