import { describe, it, expect } from "bun:test";
import {
  homeworkAssignments,
  homeworkSubmissions,
  submissionAttempts,
  aiAssessmentProposals,
  teacherAssessments,
  publishedAssessments,
  evaluationFeedbacks,
} from "./homework-schema";
import { getTableColumns } from "drizzle-orm";

describe("Homework Database Schema (Issue #74, Issue #75, Issue #76, ADR-0009)", () => {
  it("should define homework_assignments table with expected columns and constraints", () => {
    const columns = getTableColumns(homeworkAssignments);

    expect(columns.id).toBeDefined();
    expect(columns.id.primary).toBe(true);

    expect(columns.classroomId).toBeDefined();
    expect(columns.classroomId.notNull).toBe(true);

    expect(columns.teacherId).toBeDefined();
    expect(columns.teacherId.notNull).toBe(true);

    expect(columns.title).toBeDefined();
    expect(columns.title.notNull).toBe(true);

    expect(columns.instructions).toBeDefined();
    expect(columns.instructions.notNull).toBe(false);

    expect(columns.prompts).toBeDefined();
    expect(columns.prompts.notNull).toBe(true);

    expect(columns.submissionDeadline).toBeDefined();
    expect(columns.submissionDeadline.notNull).toBe(true);

    expect(columns.status).toBeDefined();
    expect(columns.status.notNull).toBe(true);
    expect(columns.status.default).toBe("draft");

    expect(columns.createdAt).toBeDefined();
    expect(columns.createdAt.notNull).toBe(true);

    expect(columns.updatedAt).toBeDefined();
    expect(columns.updatedAt.notNull).toBe(true);
  });

  it("should define homework_submissions table with expected columns and constraints", () => {
    const columns = getTableColumns(homeworkSubmissions);

    expect(columns.id).toBeDefined();
    expect(columns.id.primary).toBe(true);

    expect(columns.assignmentId).toBeDefined();
    expect(columns.assignmentId.notNull).toBe(true);

    expect(columns.learnerId).toBeDefined();
    expect(columns.learnerId.notNull).toBe(true);

    expect(columns.status).toBeDefined();
    expect(columns.status.notNull).toBe(true);
    expect(columns.status.default).toBe("pending");

    expect(columns.currentAttemptNumber).toBeDefined();
    expect(columns.currentAttemptNumber.notNull).toBe(true);
    expect(columns.currentAttemptNumber.default).toBe(1);

    expect(columns.reviewedAttemptNumber).toBeDefined();
    expect(columns.reviewedAttemptNumber.notNull).toBe(false);

    expect(columns.createdAt).toBeDefined();
    expect(columns.createdAt.notNull).toBe(true);

    expect(columns.updatedAt).toBeDefined();
    expect(columns.updatedAt.notNull).toBe(true);
  });

  it("should define submission_attempts table with expected columns and constraints", () => {
    const columns = getTableColumns(submissionAttempts);

    expect(columns.id).toBeDefined();
    expect(columns.id.primary).toBe(true);

    expect(columns.submissionId).toBeDefined();
    expect(columns.submissionId.notNull).toBe(true);

    expect(columns.attemptNumber).toBeDefined();
    expect(columns.attemptNumber.notNull).toBe(true);

    expect(columns.audioResponses).toBeDefined();
    expect(columns.audioResponses.notNull).toBe(true);

    expect(columns.submittedAt).toBeDefined();
    expect(columns.submittedAt.notNull).toBe(true);
  });

  it("should define ai_assessment_proposals table with expected columns and constraints", () => {
    const columns = getTableColumns(aiAssessmentProposals);

    expect(columns.id).toBeDefined();
    expect(columns.id.primary).toBe(true);

    expect(columns.submissionId).toBeDefined();
    expect(columns.submissionId.notNull).toBe(true);

    expect(columns.attemptId).toBeDefined();
    expect(columns.attemptId.notNull).toBe(true);

    expect(columns.attemptNumber).toBeDefined();
    expect(columns.attemptNumber.notNull).toBe(true);

    expect(columns.scores).toBeDefined();
    expect(columns.scores.notNull).toBe(true);

    expect(columns.overallBand).toBeDefined();
    expect(columns.overallBand.notNull).toBe(true);

    expect(columns.modelVersion).toBeDefined();
    expect(columns.modelVersion.notNull).toBe(true);
  });

  it("should define teacher_assessments table with expected columns and constraints", () => {
    const columns = getTableColumns(teacherAssessments);

    expect(columns.id).toBeDefined();
    expect(columns.id.primary).toBe(true);

    expect(columns.submissionId).toBeDefined();
    expect(columns.submissionId.notNull).toBe(true);

    expect(columns.assignmentId).toBeDefined();
    expect(columns.assignmentId.notNull).toBe(true);

    expect(columns.teacherId).toBeDefined();
    expect(columns.teacherId.notNull).toBe(true);

    expect(columns.status).toBeDefined();
    expect(columns.status.notNull).toBe(true);
    expect(columns.status.default).toBe("draft");

    expect(columns.fluencyCoherence).toBeDefined();
    expect(columns.fluencyCoherence.notNull).toBe(true);

    expect(columns.lexicalResource).toBeDefined();
    expect(columns.lexicalResource.notNull).toBe(true);

    expect(columns.grammaticalRangeAccuracy).toBeDefined();
    expect(columns.grammaticalRangeAccuracy.notNull).toBe(true);

    expect(columns.pronunciation).toBeDefined();
    expect(columns.pronunciation.notNull).toBe(true);

    expect(columns.overallBand).toBeDefined();
    expect(columns.overallBand.notNull).toBe(true);

    expect(columns.overallFeedback).toBeDefined();
    expect(columns.overallFeedback.notNull).toBe(true);
  });

  it("should define published_assessments table with expected columns and constraints", () => {
    const columns = getTableColumns(publishedAssessments);

    expect(columns.id).toBeDefined();
    expect(columns.id.primary).toBe(true);

    expect(columns.submissionId).toBeDefined();
    expect(columns.submissionId.notNull).toBe(true);

    expect(columns.teacherAssessmentId).toBeDefined();
    expect(columns.teacherAssessmentId.notNull).toBe(true);

    expect(columns.learnerId).toBeDefined();
    expect(columns.learnerId.notNull).toBe(true);

    expect(columns.teacherId).toBeDefined();
    expect(columns.teacherId.notNull).toBe(true);

    expect(columns.overallBand).toBeDefined();
    expect(columns.overallBand.notNull).toBe(true);

    expect(columns.overallFeedback).toBeDefined();
    expect(columns.overallFeedback.notNull).toBe(true);
  });

  it("should define evaluation_feedbacks table with expected columns and constraints", () => {
    const columns = getTableColumns(evaluationFeedbacks);

    expect(columns.id).toBeDefined();
    expect(columns.id.primary).toBe(true);

    expect(columns.submissionId).toBeDefined();
    expect(columns.submissionId.notNull).toBe(true);

    expect(columns.teacherAssessmentId).toBeDefined();
    expect(columns.teacherAssessmentId.notNull).toBe(true);

    expect(columns.teacherId).toBeDefined();
    expect(columns.teacherId.notNull).toBe(true);

    expect(columns.activeReviewDurationMs).toBeDefined();
    expect(columns.activeReviewDurationMs.notNull).toBe(true);

    expect(columns.aiProposalAccepted).toBeDefined();
    expect(columns.aiProposalAccepted.notNull).toBe(true);

    expect(columns.scoreDeltas).toBeDefined();
    expect(columns.scoreDeltas.notNull).toBe(true);
  });
});
