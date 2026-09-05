import { getTeacherReviewCockpit } from "./get-teacher-review-cockpit";
import * as assessmentRepository from "../infrastructure/homework-assessment-repository";
import * as telemetryRepository from "@/modules/telemetry/infrastructure/telemetry-repository";
import * as submissionRepository from "../infrastructure/homework-submission-repository";
import { describe, it, expect, beforeEach, spyOn } from "bun:test";
import { saveAiProposal } from "../infrastructure/homework-assessment-repository";
import { claimHomeworkReview } from "./claim-homework-review";
import { publishHomeworkAssessment } from "./publish-homework-assessment";
import { ValidationError } from "@/lib/errors";
import {
  createTeacherHomeworkReviewFixture,
  teacherId,
  otherTeacherId,
  learnerId,
} from "@/tests/fixtures/teacher-homework-review";

describe("publish-homework-assessment", () => {
  let submissionId: string;
  let attemptId: string;
  beforeEach(async () => {
    ({ submissionId, attemptId } = await createTeacherHomeworkReviewFixture());
  });
  const publishInput = {
    fluencyCoherence: 7,
    lexicalResource: 7,
    grammaticalRangeAccuracy: 7,
    pronunciation: 7,
    overallFeedback: "Teacher feedback",
    activeReviewDurationMs: 1000,
  };

  it("rejects a foreign Teacher without publishing the submission", async () => {
    await expect(
      publishHomeworkAssessment(otherTeacherId, submissionId, publishInput)
    ).rejects.toMatchObject({ statusCode: 403 });
    const cockpit = await getTeacherReviewCockpit(teacherId, submissionId);
    expect(cockpit.submission.status).toBe("submitted");
    expect(cockpit.publishedAssessment).toBeNull();
  });

  it("publishes directly with one atomic call and missing AI calibration defaults", async () => {
    const commit = spyOn(assessmentRepository, "commitHomeworkPublication");
    try {
      const result = await publishHomeworkAssessment(
        teacherId,
        submissionId,
        publishInput
      );
      expect(commit).toHaveBeenCalledTimes(1);
      expect(result.submission.reviewedAttemptNumber).toBe(1);
      expect(result.evaluationFeedback.aiProposalId).toBeNull();
      expect(result.evaluationFeedback.aiProposalAccepted).toBe(false);
      expect(result.evaluationFeedback.scoreDeltas.overallBand).toBe(0);
    } finally {
      commit.mockRestore();
    }
  });

  it("publishes manually when the AI proposal failed without changing it", async () => {
    const proposal = {
      id: crypto.randomUUID(),
      submissionId,
      attemptId,
      attemptNumber: 1,
      status: "failed" as const,
      scores: {
        fluencyAndCoherence: 0,
        lexicalResource: 0,
        grammaticalRangeAndAccuracy: 0,
        pronunciation: 0,
      },
      overallBand: 0,
      feedbackSummary: null,
      strengths: [],
      improvements: [],
      actionPlan: [],
      pronunciationNotes: [],
      rawProposalJson: null,
      modelVersion: "test-model",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await saveAiProposal(proposal);
    const cockpit = await getTeacherReviewCockpit(teacherId, submissionId);
    expect(cockpit.aiProposal?.status).toBe("failed");
    expect(cockpit.attempt.id).toBe(attemptId);
    const result = await publishHomeworkAssessment(
      teacherId,
      submissionId,
      publishInput
    );
    expect(result.evaluationFeedback.aiProposalId).toBe(proposal.id);
    expect(result.evaluationFeedback.aiProposalAccepted).toBe(false);
    expect(
      result.evaluationFeedback.teacherModifications?.modifiedCriteria
    ).toEqual([]);
    expect(
      await assessmentRepository.findAiProposalByAttemptId(attemptId)
    ).toEqual(proposal);
  });

  it("maps a disappeared submission from the atomic operation to 404", async () => {
    const commit = spyOn(
      assessmentRepository,
      "commitHomeworkPublication"
    ).mockResolvedValue({ kind: "not_found" });
    try {
      await expect(
        publishHomeworkAssessment(teacherId, submissionId, publishInput)
      ).rejects.toMatchObject({ statusCode: 404 });
    } finally {
      commit.mockRestore();
    }
  });

  it("publishes the ReviewedAttempt even when CurrentAttempt is newer", async () => {
    await claimHomeworkReview(teacherId, submissionId);
    const existing = submissionRepository.devSubmissionCache.get(submissionId)!;
    submissionRepository.devSubmissionCache.set(submissionId, {
      ...existing,
      currentAttemptNumber: 2,
    });
    const result = await publishHomeworkAssessment(
      teacherId,
      submissionId,
      publishInput
    );
    expect(result.teacherAssessment.attemptNumber).toBe(1);
    expect(result.publishedAssessment.attemptNumber).toBe(1);
    expect(result.evaluationFeedback.attemptNumber).toBe(1);
    expect(result.submission.currentAttemptNumber).toBe(2);
  });

  for (const status of ["submitted", "published"] as const) {
    it(
      "maps a competing " + status + " state and emits no telemetry",
      async () => {
        const existing =
          submissionRepository.devSubmissionCache.get(submissionId)!;
        const commit = spyOn(
          assessmentRepository,
          "commitHomeworkPublication"
        ).mockResolvedValue({
          kind: "no_transition",
          submission: { ...existing, status, currentAttemptNumber: 2 },
        });
        const telemetry = spyOn(telemetryRepository, "recordTelemetryEvent");
        try {
          await expect(
            publishHomeworkAssessment(teacherId, submissionId, publishInput)
          ).rejects.toMatchObject({
            code:
              status === "published"
                ? "SUBMISSION_ALREADY_PUBLISHED"
                : "SUBMISSION_STATE_CHANGED",
            statusCode: 409,
          });
          expect(telemetry).not.toHaveBeenCalled();
        } finally {
          commit.mockRestore();
          telemetry.mockRestore();
        }
      }
    );
  }

  it("validates input and attempt existence before committing", async () => {
    const commit = spyOn(assessmentRepository, "commitHomeworkPublication");
    try {
      await expect(
        publishHomeworkAssessment(teacherId, submissionId, {
          ...publishInput,
          fluencyCoherence: 10,
        })
      ).rejects.toThrow(ValidationError);
      submissionRepository.devAttemptCache.clear();
      await expect(
        publishHomeworkAssessment(teacherId, submissionId, publishInput)
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(commit).not.toHaveBeenCalled();
    } finally {
      commit.mockRestore();
    }
  });

  it("does not emit telemetry when persistence fails", async () => {
    const commit = spyOn(
      assessmentRepository,
      "commitHomeworkPublication"
    ).mockRejectedValue(new Error("DB failure"));
    const telemetry = spyOn(telemetryRepository, "recordTelemetryEvent");
    try {
      await expect(
        publishHomeworkAssessment(teacherId, submissionId, publishInput)
      ).rejects.toThrow("DB failure");
      expect(telemetry).not.toHaveBeenCalled();
    } finally {
      commit.mockRestore();
      telemetry.mockRestore();
    }
  });

  for (const synchronous of [true, false]) {
    it(
      "preserves committed success when telemetry " +
        (synchronous ? "throws" : "rejects"),
      async () => {
        const telemetry = spyOn(
          telemetryRepository,
          "recordTelemetryEvent"
        ).mockImplementation(() => {
          if (synchronous) throw new Error("telemetry failed");
          return Promise.reject(new Error("telemetry failed"));
        });
        try {
          const result = await publishHomeworkAssessment(
            teacherId,
            submissionId,
            publishInput
          );
          expect(result.submission.status).toBe("published");
          expect(telemetry).toHaveBeenCalledTimes(1);
        } finally {
          telemetry.mockRestore();
        }
      }
    );
  }

  describe("Atomic Publish & Calibration Persistence", () => {
    it("should validate IELTS criteria completeness and bounds", async () => {
      await claimHomeworkReview(teacherId, submissionId);

      // Score out of bounds (> 9.0)
      await expect(
        publishHomeworkAssessment(teacherId, submissionId, {
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
        publishHomeworkAssessment(teacherId, submissionId, {
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

      await claimHomeworkReview(teacherId, submissionId);

      const result = await publishHomeworkAssessment(teacherId, submissionId, {
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

      await claimHomeworkReview(teacherId, submissionId);

      // Teacher scores 7.0 (delta = +1.5 > 0.5)
      const result = await publishHomeworkAssessment(teacherId, submissionId, {
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
