import {
  pgTable,
  text,
  varchar,
  timestamp,
  index,
  uuid,
  jsonb,
  integer,
  uniqueIndex,
  real,
  boolean,
} from "drizzle-orm/pg-core";
import { user } from "@/modules/identity/infrastructure/auth-schema";
import { classrooms } from "@/modules/classroom/infrastructure/classroom-schema";
import type {
  HomeworkPromptItem,
  AudioResponseClip,
  SpeakingCriteriaScores,
  SpeakingCriteriaFeedback,
  SpeakingReviewAnnotationItem,
} from "../domain/homework-types";

/**
 * Homework Assignments Table (Issue #74, Ticket #53, ADR-0008, ADR-0009)
 * Represents a teacher-assigned speaking homework with 1-3 discrete prompt items.
 */
export const homeworkAssignments = pgTable(
  "homework_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classroomId: uuid("classroom_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "cascade" }),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    instructions: text("instructions"),
    prompts: jsonb("prompts").$type<HomeworkPromptItem[]>().notNull(),
    submissionDeadline: timestamp("submission_deadline", {
      withTimezone: true,
    }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_homework_assignments_classroom_id").on(table.classroomId),
    index("idx_homework_assignments_teacher_id").on(table.teacherId),
    index("idx_homework_assignments_status").on(table.status),
    index("idx_homework_assignments_deadline").on(table.submissionDeadline),
  ]
);

export type HomeworkAssignmentTable = typeof homeworkAssignments.$inferSelect;
export type NewHomeworkAssignmentTable =
  typeof homeworkAssignments.$inferInsert;

/**
 * Homework Submissions Table (Issue #75, Ticket #58, ADR-0008, ADR-0009)
 * Represents the aggregate root connecting a learner to an assignment.
 */
export const homeworkSubmissions = pgTable(
  "homework_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => homeworkAssignments.id, { onDelete: "cascade" }),
    learnerId: text("learner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    currentAttemptNumber: integer("current_attempt_number")
      .notNull()
      .default(1),
    reviewedAttemptNumber: integer("reviewed_attempt_number"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_homework_submissions_assignment_id").on(table.assignmentId),
    index("idx_homework_submissions_learner_id").on(table.learnerId),
    index("idx_homework_submissions_status").on(table.status),
    uniqueIndex("idx_homework_submissions_assignment_learner").on(
      table.assignmentId,
      table.learnerId
    ),
  ]
);

export type HomeworkSubmissionTable = typeof homeworkSubmissions.$inferSelect;
export type NewHomeworkSubmissionTable =
  typeof homeworkSubmissions.$inferInsert;

/**
 * Submission Attempts Table (Issue #75, Ticket #58, ADR-0009)
 * Stores immutable submission attempt snapshots with discrete audio clips.
 */
export const submissionAttempts = pgTable(
  "submission_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => homeworkSubmissions.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    audioResponses: jsonb("audio_responses")
      .$type<AudioResponseClip[]>()
      .notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_submission_attempts_submission_id").on(table.submissionId),
    uniqueIndex("idx_submission_attempts_submission_attempt_number").on(
      table.submissionId,
      table.attemptNumber
    ),
  ]
);

export type SubmissionAttemptTable = typeof submissionAttempts.$inferSelect;
export type NewSubmissionAttemptTable = typeof submissionAttempts.$inferInsert;

/**
 * AI Assessment Proposals Table (Ticket #55, #56, ADR-0008, ADR-0009)
 * Untouched AI proposal for a submission attempt. Strictly hidden from Learner.
 */
export const aiAssessmentProposals = pgTable(
  "ai_assessment_proposals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => homeworkSubmissions.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => submissionAttempts.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("ready"),
    scores: jsonb("scores").$type<SpeakingCriteriaScores>().notNull(),
    overallBand: real("overall_band").notNull(),
    feedbackSummary: text("feedback_summary"),
    strengths: jsonb("strengths").$type<string[]>().notNull().default([]),
    improvements: jsonb("improvements").$type<string[]>().notNull().default([]),
    actionPlan: jsonb("action_plan").$type<string[]>().notNull().default([]),
    pronunciationNotes: jsonb("pronunciation_notes")
      .$type<unknown[]>()
      .default([]),
    rawProposalJson:
      jsonb("raw_proposal_json").$type<Record<string, unknown>>(),
    modelVersion: varchar("model_version", { length: 64 })
      .notNull()
      .default("gemini-2.5-flash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_ai_assessment_proposals_submission_id").on(table.submissionId),
    index("idx_ai_assessment_proposals_attempt_id").on(table.attemptId),
  ]
);

export type AiAssessmentProposalTable =
  typeof aiAssessmentProposals.$inferSelect;
export type NewAiAssessmentProposalTable =
  typeof aiAssessmentProposals.$inferInsert;

/**
 * Teacher Assessments Table (Ticket #51, ADR-0009)
 * Teacher evaluation draft and official validated scores.
 */
export const teacherAssessments = pgTable(
  "teacher_assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => homeworkSubmissions.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => homeworkAssignments.id, { onDelete: "cascade" }),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    fluencyCoherence: real("fluency_coherence").notNull(),
    lexicalResource: real("lexical_resource").notNull(),
    grammaticalRangeAccuracy: real("grammatical_range_accuracy").notNull(),
    pronunciation: real("pronunciation").notNull(),
    overallBand: real("overall_band").notNull(),
    overallFeedback: text("overall_feedback").notNull(),
    criteriaFeedback:
      jsonb("criteria_feedback").$type<SpeakingCriteriaFeedback>(),
    annotations: jsonb("annotations")
      .$type<SpeakingReviewAnnotationItem[]>()
      .notNull()
      .default([]),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_teacher_assessments_submission_id").on(table.submissionId),
    index("idx_teacher_assessments_teacher_id").on(table.teacherId),
    index("idx_teacher_assessments_status").on(table.status),
  ]
);

export type TeacherAssessmentTable = typeof teacherAssessments.$inferSelect;
export type NewTeacherAssessmentTable = typeof teacherAssessments.$inferInsert;

/**
 * Published Assessments Table (Ticket #51, ADR-0009)
 * Immutable official snapshot visible to the Learner.
 */
export const publishedAssessments = pgTable(
  "published_assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => homeworkSubmissions.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => homeworkAssignments.id, { onDelete: "cascade" }),
    teacherAssessmentId: uuid("teacher_assessment_id")
      .notNull()
      .references(() => teacherAssessments.id, { onDelete: "cascade" }),
    learnerId: text("learner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    fluencyCoherence: real("fluency_coherence").notNull(),
    lexicalResource: real("lexical_resource").notNull(),
    grammaticalRangeAccuracy: real("grammatical_range_accuracy").notNull(),
    pronunciation: real("pronunciation").notNull(),
    overallBand: real("overall_band").notNull(),
    overallFeedback: text("overall_feedback").notNull(),
    criteriaFeedback:
      jsonb("criteria_feedback").$type<SpeakingCriteriaFeedback>(),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_published_assessments_submission_id").on(table.submissionId),
    index("idx_published_assessments_assignment_id").on(table.assignmentId),
    index("idx_published_assessments_learner_id").on(table.learnerId),
  ]
);

export type PublishedAssessmentTable = typeof publishedAssessments.$inferSelect;
export type NewPublishedAssessmentTable =
  typeof publishedAssessments.$inferInsert;

/**
 * Evaluation Feedbacks Table (ADR-0008, ADR-0010, Ticket #52, #76)
 * Calibration difference record between AI proposal and finalized Teacher scores.
 */
export const evaluationFeedbacks = pgTable(
  "evaluation_feedbacks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => homeworkSubmissions.id, { onDelete: "cascade" }),
    teacherAssessmentId: uuid("teacher_assessment_id")
      .notNull()
      .references(() => teacherAssessments.id, { onDelete: "cascade" }),
    aiProposalId: uuid("ai_proposal_id").references(
      () => aiAssessmentProposals.id,
      { onDelete: "set null" }
    ),
    attemptNumber: integer("attempt_number").notNull(),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeReviewDurationMs: integer("active_review_duration_ms").notNull(),
    aiProposalAccepted: boolean("ai_proposal_accepted")
      .notNull()
      .default(false),
    scoreDeltas: jsonb("score_deltas").notNull(),
    teacherModifications: jsonb("teacher_modifications"),
    modelVersion: varchar("model_version", { length: 64 }).default(
      "gemini-2.5-flash"
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_evaluation_feedbacks_submission_id").on(table.submissionId),
    index("idx_evaluation_feedbacks_teacher_id").on(table.teacherId),
  ]
);

export type EvaluationFeedbackTable = typeof evaluationFeedbacks.$inferSelect;
export type NewEvaluationFeedbackTable =
  typeof evaluationFeedbacks.$inferInsert;
