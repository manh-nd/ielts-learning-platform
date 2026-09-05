import * as submissionRepository from "../infrastructure/homework-submission-repository";
import { describe, it, expect, beforeEach, spyOn } from "bun:test";
import {
  clearDevHomeworkCache,
  createAssignment,
} from "../infrastructure/homework-assignment-repository";
import {
  clearDevHomeworkSubmissionCache,
  createInitialSubmissionWithAttempt,
} from "../infrastructure/homework-submission-repository";
import {
  clearDevHomeworkAssessmentCache,
  saveAiProposal,
} from "../infrastructure/homework-assessment-repository";
import {
  clearDevClassroomCache,
  createClassroom,
  addMembership,
} from "@/modules/classroom/infrastructure/classroom-repository";
import {
  getTeacherReviewCockpit,
  startTeacherReview,
  publishTeacherAssessment,
} from "./homework-review-service";
import { submitLearnerHomeworkAttempt } from "./homework-submission-service";
import { ForbiddenError, ConflictError, ValidationError } from "@/lib/errors";

describe("Homework Review Service (Issue #76, ADR-0008, ADR-0009, Ticket #51, #58)", () => {
  const teacherId = "teacher_owner";
  const otherTeacherId = "teacher_stranger";
  const learnerId = "learner_123";

  let classroomId: string;
  let assignmentId: string;
  let submissionId: string;
  let attemptId: string;

  beforeEach(async () => {
    clearDevHomeworkCache();
    clearDevHomeworkSubmissionCache();
    clearDevHomeworkAssessmentCache();
    clearDevClassroomCache();

    // Setup classroom owned by teacherId
    const classroom = await createClassroom(teacherId, {
      name: "IELTS Masterclass",
      description: "Classroom for pilot testing",
    });
    classroomId = classroom.id;

    // Enroll learner
    await addMembership(classroomId, learnerId);

    // Create published assignment with 2 prompts
    const assignment = await createAssignment({
      classroomId,
      teacherId,
      title: "Speaking Homework Week 1",
      instructions: "Answer both prompts carefully.",
      prompts: [
        {
          promptId: "prompt_p1_1",
          text: "Do you like flowers?",
          partNumber: 1,
        },
        {
          promptId: "prompt_p1_2",
          text: "What is your favorite flower?",
          partNumber: 1,
        },
      ],
      submissionDeadline: new Date(Date.now() + 86400000), // Tomorrow
      status: "published",
    });
    assignmentId = assignment.id;

    // Learner submits attempt #1
    const { submission, attempt } = await createInitialSubmissionWithAttempt({
      assignmentId,
      learnerId,
      audioResponses: [
        {
          promptId: "prompt_p1_1",
          storageKey: `homework/${learnerId}/${assignmentId}/p1.webm`,
          durationMs: 45000,
          audioBytes: 150000,
        },
        {
          promptId: "prompt_p1_2",
          storageKey: `homework/${learnerId}/${assignmentId}/p2.webm`,
          durationMs: 38000,
          audioBytes: 120000,
        },
      ],
      status: "submitted",
    });
    submissionId = submission.id;
    attemptId = attempt.id;
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

  describe("First-Committed-Wins Concurrency Lock (startTeacherReview vs Learner Resubmit)", () => {
    it("opens the newly committed attempt even if ownership checked an older snapshot", async () => {
      const originalClaim = submissionRepository.claimTeacherReview;
      const claim = spyOn(
        submissionRepository,
        "claimTeacherReview"
      ).mockImplementation(async (id) => {
        await submissionRepository.commitResubmission({
          submissionId: id,
          expectedCurrentAttemptNumber: 1,
          audioResponses: [],
        });
        return originalClaim(id);
      });
      try {
        expect(await startTeacherReview(teacherId, submissionId)).toMatchObject(
          {
            currentAttemptNumber: 2,
            reviewedAttemptNumber: 2,
            status: "in_review",
          }
        );
      } finally {
        claim.mockRestore();
      }
      const reopened = await startTeacherReview(teacherId, submissionId);
      expect(reopened.reviewedAttemptNumber).toBe(2);
    });

    it("maps a published conditional claim result to the existing conflict", async () => {
      const submission =
        await submissionRepository.findSubmissionById(submissionId);
      if (!submission) throw new Error("Missing fixture");
      const claim = spyOn(
        submissionRepository,
        "claimTeacherReview"
      ).mockResolvedValue({
        kind: "no_transition",
        submission: {
          ...submission,
          status: "published",
          reviewedAttemptNumber: 1,
        },
      });
      try {
        await expect(
          startTeacherReview(teacherId, submissionId)
        ).rejects.toMatchObject({
          code: "SUBMISSION_ALREADY_PUBLISHED",
          statusCode: 409,
        });
      } finally {
        claim.mockRestore();
      }
    });

    it("should transition status to in_review and lock reviewedAttemptNumber", async () => {
      const updated = await startTeacherReview(teacherId, submissionId);
      expect(updated.status).toBe("in_review");
      expect(updated.reviewedAttemptNumber).toBe(1);
    });

    it("should reject learner resubmission with 409 Conflict once review has started", async () => {
      // 1. Teacher starts review
      await startTeacherReview(teacherId, submissionId);

      // 2. Learner attempts to resubmit
      await expect(
        submitLearnerHomeworkAttempt(learnerId, assignmentId, {
          audioResponses: [
            {
              promptId: "prompt_p1_1",
              storageKey: `homework/${learnerId}/${assignmentId}/p1_v2.webm`,
              durationMs: 50000,
              audioBytes: 160000,
            },
            {
              promptId: "prompt_p1_2",
              storageKey: `homework/${learnerId}/${assignmentId}/p2_v2.webm`,
              durationMs: 40000,
              audioBytes: 130000,
            },
          ],
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("Atomic Publish & Calibration Persistence", () => {
    it("should validate IELTS criteria completeness and bounds", async () => {
      await startTeacherReview(teacherId, submissionId);

      // Score out of bounds (> 9.0)
      await expect(
        publishTeacherAssessment(teacherId, submissionId, {
          fluencyCoherence: 9.5,
          lexicalResource: 7.0,
          grammaticalRangeAccuracy: 7.0,
          pronunciation: 7.0,
          overallFeedback: "Great work",
          activeReviewDurationMs: 120000,
        })
      ).rejects.toThrow(ValidationError);

      // Missing overall feedback
      await expect(
        publishTeacherAssessment(teacherId, submissionId, {
          fluencyCoherence: 7.0,
          lexicalResource: 7.0,
          grammaticalRangeAccuracy: 7.0,
          pronunciation: 7.0,
          overallFeedback: "   ",
          activeReviewDurationMs: 120000,
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should execute Single-Action Atomic Publish and persist evaluation feedback", async () => {
      // Seed AI proposal
      await saveAiProposal({
        id: crypto.randomUUID(),
        submissionId,
        attemptId,
        attemptNumber: 1,
        status: "ready",
        scores: {
          fluencyAndCoherence: 6.5,
          lexicalResource: 6.5,
          grammaticalRangeAndAccuracy: 6.5,
          pronunciation: 6.5,
        },
        overallBand: 6.5,
        feedbackSummary: "AI summary",
        strengths: [],
        improvements: [],
        actionPlan: [],
        pronunciationNotes: [],
        rawProposalJson: null,
        modelVersion: "gemini-2.5-flash",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await startTeacherReview(teacherId, submissionId);

      const result = await publishTeacherAssessment(teacherId, submissionId, {
        fluencyCoherence: 7.0,
        lexicalResource: 6.5,
        grammaticalRangeAccuracy: 7.0,
        pronunciation: 6.5,
        overallFeedback:
          "Detailed teacher feedback: strong fluency and accurate grammar.",
        criteriaFeedback: {
          fluencyAndCoherence: "Impressive natural pacing.",
        },
        activeReviewDurationMs: 150000,
      });

      // Verification: Status is published
      expect(result.submission.status).toBe("published");

      // Verification: TeacherAssessment is saved
      expect(result.teacherAssessment.status).toBe("published");
      expect(result.teacherAssessment.overallBand).toBe(7.0); // Mean (7.0 + 6.5 + 7.0 + 6.5)/4 = 6.75 -> 7.0
      expect(result.teacherAssessment.overallFeedback).toContain(
        "Detailed teacher feedback"
      );

      // Verification: PublishedAssessment is created (TeacherAssessment != PublishedAssessment)
      expect(result.publishedAssessment.id).not.toBe(
        result.teacherAssessment.id
      );
      expect(result.publishedAssessment.overallBand).toBe(7.0);
      expect(result.publishedAssessment.learnerId).toBe(learnerId);

      // Verification: EvaluationFeedback is captured
      expect(result.evaluationFeedback.activeReviewDurationMs).toBe(150000);
      expect(result.evaluationFeedback.aiProposalAccepted).toBe(true);
      expect(result.evaluationFeedback.scoreDeltas.overallBand).toBe(0.5);
    });

    it("should calculate aiProposalAccepted = false when teacher overall diff > 0.5", async () => {
      // Seed AI proposal with band 5.5
      await saveAiProposal({
        id: crypto.randomUUID(),
        submissionId,
        attemptId,
        attemptNumber: 1,
        status: "ready",
        scores: {
          fluencyAndCoherence: 5.5,
          lexicalResource: 5.5,
          grammaticalRangeAndAccuracy: 5.5,
          pronunciation: 5.5,
        },
        overallBand: 5.5,
        feedbackSummary: null,
        strengths: [],
        improvements: [],
        actionPlan: [],
        pronunciationNotes: [],
        rawProposalJson: null,
        modelVersion: "gemini-2.5-flash",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await startTeacherReview(teacherId, submissionId);

      // Teacher scores 7.0 (delta = +1.5 > 0.5)
      const result = await publishTeacherAssessment(teacherId, submissionId, {
        fluencyCoherence: 7.0,
        lexicalResource: 7.0,
        grammaticalRangeAccuracy: 7.0,
        pronunciation: 7.0,
        overallFeedback: "Much better than AI estimated!",
        activeReviewDurationMs: 90000,
      });

      expect(result.evaluationFeedback.aiProposalAccepted).toBe(false);
      expect(result.evaluationFeedback.scoreDeltas.overallBand).toBe(1.5);
    });
  });
});
