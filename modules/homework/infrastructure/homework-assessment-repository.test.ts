import { describe, it, expect, beforeEach } from "bun:test";
import {
  clearDevHomeworkAssessmentCache,
  saveAiProposal,
  findAiProposalByAttemptId,
  saveTeacherAssessment,
  findTeacherAssessmentBySubmission,
  createPublishedAssessment,
  findPublishedAssessmentBySubmission,
  createEvaluationFeedback,
  listEvaluationFeedbacksBySubmissionId,
} from "./homework-assessment-repository";
import type {
  AiAssessmentProposal,
  TeacherAssessment,
  PublishedAssessment,
  EvaluationFeedback,
} from "../domain/homework-types";

describe("Homework Assessment Repository (Issue #76, ADR-0008, ADR-0009)", () => {
  beforeEach(() => {
    clearDevHomeworkAssessmentCache();
  });

  it("should persist and retrieve AI assessment proposals by attempt ID", async () => {
    const proposal: AiAssessmentProposal = {
      id: crypto.randomUUID(),
      submissionId: crypto.randomUUID(),
      attemptId: crypto.randomUUID(),
      attemptNumber: 1,
      status: "ready",
      scores: {
        fluencyAndCoherence: 6.5,
        lexicalResource: 6.0,
        grammaticalRangeAndAccuracy: 6.5,
        pronunciation: 6.0,
      },
      overallBand: 6.5,
      feedbackSummary: "Good fluency with minor grammatical slips.",
      strengths: ["Clear pronunciation", "Good discourse markers"],
      improvements: ["Expand C1 vocabulary"],
      actionPlan: ["Practice Part 3 questions"],
      pronunciationNotes: [],
      rawProposalJson: { raw: true },
      modelVersion: "gemini-2.5-flash",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const saved = await saveAiProposal(proposal);
    expect(saved.id).toBe(proposal.id);

    const retrieved = await findAiProposalByAttemptId(proposal.attemptId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.scores.fluencyAndCoherence).toBe(6.5);
    expect(retrieved?.overallBand).toBe(6.5);
  });

  it("should persist and retrieve Teacher assessments", async () => {
    const assessment: TeacherAssessment = {
      id: crypto.randomUUID(),
      submissionId: crypto.randomUUID(),
      assignmentId: crypto.randomUUID(),
      teacherId: "teacher_123",
      attemptNumber: 1,
      status: "draft",
      fluencyCoherence: 7.0,
      lexicalResource: 6.5,
      grammaticalRangeAccuracy: 6.5,
      pronunciation: 6.5,
      overallBand: 6.5,
      overallFeedback: "Great effort! Work on grammatical range.",
      criteriaFeedback: {
        fluencyAndCoherence: "Very fluent",
      },
      annotations: [],
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const saved = await saveTeacherAssessment(assessment);
    expect(saved.id).toBe(assessment.id);

    const retrieved = await findTeacherAssessmentBySubmission(
      assessment.submissionId
    );
    expect(retrieved).not.toBeNull();
    expect(retrieved?.status).toBe("draft");
    expect(retrieved?.overallFeedback).toBe(
      "Great effort! Work on grammatical range."
    );
  });

  it("should persist and retrieve Published assessments", async () => {
    const published: PublishedAssessment = {
      id: crypto.randomUUID(),
      submissionId: crypto.randomUUID(),
      assignmentId: crypto.randomUUID(),
      teacherAssessmentId: crypto.randomUUID(),
      learnerId: "learner_456",
      teacherId: "teacher_123",
      attemptNumber: 1,
      fluencyCoherence: 7.0,
      lexicalResource: 7.0,
      grammaticalRangeAccuracy: 6.5,
      pronunciation: 7.0,
      overallBand: 7.0,
      overallFeedback: "Official band 7.0.",
      criteriaFeedback: null,
      publishedAt: new Date(),
    };

    const saved = await createPublishedAssessment(published);
    expect(saved.id).toBe(published.id);

    const retrieved = await findPublishedAssessmentBySubmission(
      published.submissionId
    );
    expect(retrieved).not.toBeNull();
    expect(retrieved?.overallBand).toBe(7.0);
  });

  it("should persist and retrieve Evaluation Feedback records", async () => {
    const feedback: EvaluationFeedback = {
      id: crypto.randomUUID(),
      submissionId: crypto.randomUUID(),
      teacherAssessmentId: crypto.randomUUID(),
      aiProposalId: crypto.randomUUID(),
      attemptNumber: 1,
      teacherId: "teacher_123",
      activeReviewDurationMs: 145000,
      aiProposalAccepted: true,
      scoreDeltas: {
        fluencyCoherence: 0.5,
        lexicalResource: 0.0,
        grammaticalRangeAccuracy: 0.0,
        pronunciation: 0.5,
        overallBand: 0.5,
      },
      teacherModifications: {
        modifiedCriteria: ["fluencyCoherence", "pronunciation"],
        teacherOverallDiff: 0.5,
      },
      modelVersion: "gemini-2.5-flash",
      createdAt: new Date(),
    };

    const saved = await createEvaluationFeedback(feedback);
    expect(saved.id).toBe(feedback.id);

    const list = await listEvaluationFeedbacksBySubmissionId(
      feedback.submissionId
    );
    expect(list.length).toBe(1);
    expect(list[0].activeReviewDurationMs).toBe(145000);
    expect(list[0].aiProposalAccepted).toBe(true);
  });
});
