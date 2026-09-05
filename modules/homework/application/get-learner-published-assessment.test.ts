import { beforeEach, describe, expect, it } from "bun:test";
import { getLearnerPublishedAssessment } from "./get-learner-published-assessment";
import { submitLearnerHomeworkAttempt } from "./submit-homework-attempt";
import { claimHomeworkReview } from "./claim-homework-review";
import { publishHomeworkAssessment } from "./publish-homework-assessment";
import {
  createAssignment,
  clearDevHomeworkCache,
} from "../infrastructure/homework-assignment-repository";
import {
  clearDevHomeworkSubmissionCache,
  updateSubmissionStatus,
} from "../infrastructure/homework-submission-repository";
import {
  clearDevHomeworkAssessmentCache,
  saveAiProposal,
} from "../infrastructure/homework-assessment-repository";
import {
  createClassroom,
  addMembership,
  clearDevClassroomCache,
  registerDevUser,
} from "@/modules/classroom/infrastructure/classroom-repository";

const teacherId = "published-query-teacher";
const learnerId = "published-query-learner";

beforeEach(() => {
  clearDevHomeworkCache();
  clearDevHomeworkSubmissionCache();
  clearDevHomeworkAssessmentCache();
  clearDevClassroomCache();
  registerDevUser({
    id: teacherId,
    name: "Teacher",
    email: "teacher@test.com",
    role: "teacher",
  });
  registerDevUser({
    id: learnerId,
    name: "Learner",
    email: "learner@test.com",
    role: "learner",
  });
});

async function setupAssignment(status: "draft" | "published" = "published") {
  const classroom = await createClassroom(teacherId, {
    name: "Speaking classroom",
  });
  await addMembership(classroom.id, learnerId);
  const assignment = await createAssignment({
    classroomId: classroom.id,
    teacherId,
    title: "Speaking",
    prompts: [
      { promptId: "p1", text: "Describe your hometown", partNumber: 2 },
    ],
    submissionDeadline: new Date(Date.now() + 3600000),
    status,
  });
  const input = {
    audioResponses: [
      {
        promptId: "p1",
        storageKey: `homework/${learnerId}/${assignment.id}/audio.webm`,
        durationMs: 30000,
        audioBytes: 50000,
      },
    ],
  };
  return { assignment, input };
}

describe("Learner PublishedAssessment query", () => {
  it("rejects non-members and teacher-private draft assignments", async () => {
    const { assignment } = await setupAssignment();
    await expect(
      getLearnerPublishedAssessment("outsider", assignment.id)
    ).rejects.toMatchObject({ statusCode: 403 });
    const draft = await setupAssignment("draft");
    await expect(
      getLearnerPublishedAssessment(learnerId, draft.assignment.id)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("preserves missing-assignment and missing-submission errors", async () => {
    await expect(
      getLearnerPublishedAssessment(learnerId, "missing")
    ).rejects.toMatchObject({ statusCode: 404 });
    const { assignment } = await setupAssignment();
    await expect(
      getLearnerPublishedAssessment(learnerId, assignment.id)
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Chưa tìm thấy bài nộp cho bài tập này.",
    });
  });

  it("withholds results until publication", async () => {
    const { assignment, input } = await setupAssignment();
    const { submission } = await submitLearnerHomeworkAttempt(
      learnerId,
      assignment.id,
      input
    );
    for (const status of ["submitted", "in_review"] as const) {
      if (status === "in_review")
        await claimHomeworkReview(teacherId, submission.id);
      await expect(
        getLearnerPublishedAssessment(learnerId, assignment.id)
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "SUBMISSION_NOT_PUBLISHED",
        details: { status },
      });
    }
  });

  it("reports missing official data instead of exposing a draft", async () => {
    const { assignment, input } = await setupAssignment();
    const { submission } = await submitLearnerHomeworkAttempt(
      learnerId,
      assignment.id,
      input
    );
    await updateSubmissionStatus(submission.id, "published", 1);
    await expect(
      getLearnerPublishedAssessment(learnerId, assignment.id)
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Không tìm thấy dữ liệu đánh giá chính thức đã công bố.",
    });
  });

  it("returns the ReviewedAttempt and official assessment without AI proposals or teacher drafts", async () => {
    const { assignment, input } = await setupAssignment();
    const first = await submitLearnerHomeworkAttempt(
      learnerId,
      assignment.id,
      input
    );
    await submitLearnerHomeworkAttempt(learnerId, assignment.id, input);
    // Historical state: CurrentAttempt differs from the locked ReviewedAttempt.
    await updateSubmissionStatus(first.submission.id, "in_review", 1);
    await saveAiProposal({
      id: "private-proposal",
      submissionId: first.submission.id,
      attemptId: first.attempt.id,
      attemptNumber: 1,
      status: "ready",
      scores: {
        fluencyAndCoherence: 5,
        lexicalResource: 5,
        grammaticalRangeAndAccuracy: 5,
        pronunciation: 5,
      },
      overallBand: 5,
      feedbackSummary: "Private AI summary",
      strengths: [],
      improvements: [],
      actionPlan: [],
      pronunciationNotes: [],
      rawProposalJson: { private: "raw-ai-secret" },
      modelVersion: "test",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const official = await publishHomeworkAssessment(
      teacherId,
      first.submission.id,
      {
        fluencyCoherence: 7,
        lexicalResource: 7,
        grammaticalRangeAccuracy: 7,
        pronunciation: 7,
        overallFeedback: "Official teacher feedback",
        activeReviewDurationMs: 150000,
      }
    );
    const result = await getLearnerPublishedAssessment(
      learnerId,
      assignment.id
    );
    expect(result.attempt.id).toBe(first.attempt.id);
    expect(result.submission.currentAttemptNumber).toBe(2);
    expect(result.publishedAssessment).toEqual(official.publishedAssessment);
    expect(result.publishedAssessment.overallBand).toBe(7);
    expect(result.teacher).toEqual({ id: teacherId, name: "Teacher" });
    expect(Object.keys(result).sort()).toEqual([
      "assignment",
      "attempt",
      "classroom",
      "publishedAssessment",
      "submission",
      "teacher",
    ]);
    expect(JSON.stringify(result)).not.toContain("raw-ai-secret");
    expect(JSON.stringify(result)).not.toContain("Private AI summary");
  });
});
