import { describe, it, expect, beforeEach } from "bun:test";
import { saveAiProposal } from "../infrastructure/homework-assessment-repository";
import { getTeacherReviewCockpit } from "./get-teacher-review-cockpit";
import { ForbiddenError } from "@/lib/errors";
import {
  createTeacherHomeworkReviewFixture,
  teacherId,
  otherTeacherId,
  learnerId,
} from "@/tests/fixtures/teacher-homework-review";

describe("get-teacher-review-cockpit", () => {
  let assignmentId: string;
  let submissionId: string;
  let attemptId: string;
  beforeEach(async () => {
    ({ assignmentId, submissionId, attemptId } =
      await createTeacherHomeworkReviewFixture());
  });
  describe("getTeacherReviewCockpit", () => {
    it("should reject a teacher who does not own the classroom (403 Forbidden)", async () => {
      await expect(
        getTeacherReviewCockpit(otherTeacherId, submissionId)
      ).rejects.toThrow(ForbiddenError);
    });

    it("should load review cockpit with attempt and learner info", async () => {
      const data = await getTeacherReviewCockpit(teacherId, submissionId);
      expect(data.assignment.id).toBe(assignmentId);
      expect(data.submission.id).toBe(submissionId);
      expect(data.attempt.attemptNumber).toBe(1);
      expect(data.student.id).toBe(learnerId);
      expect(data.aiProposal).toBeNull();
      expect(data.teacherDraft).toBeNull();
      expect(data.publishedAssessment).toBeNull();
    });

    it("should gracefully handle when AI proposal exists", async () => {
      await saveAiProposal({
        id: crypto.randomUUID(),
        submissionId,
        attemptId,
        attemptNumber: 1,
        status: "ready",
        scores: {
          fluencyAndCoherence: 6.5,
          lexicalResource: 6.0,
          grammaticalRangeAndAccuracy: 6.5,
          pronunciation: 6.0,
        },
        overallBand: 6.5,
        feedbackSummary: "AI summary",
        strengths: ["Clear pronunciation"],
        improvements: ["More vocabulary"],
        actionPlan: ["Practice Part 3"],
        pronunciationNotes: [],
        rawProposalJson: null,
        modelVersion: "gemini-2.5-flash",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const data = await getTeacherReviewCockpit(teacherId, submissionId);
      expect(data.aiProposal).not.toBeNull();
      expect(data.aiProposal?.scores.fluencyAndCoherence).toBe(6.5);
    });
  });
});
