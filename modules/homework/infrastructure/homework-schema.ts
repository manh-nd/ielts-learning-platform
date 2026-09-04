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
} from "drizzle-orm/pg-core";
import { user } from "@/modules/identity/infrastructure/auth-schema";
import { classrooms } from "@/modules/classroom/infrastructure/classroom-schema";
import type {
  HomeworkPromptItem,
  AudioResponseClip,
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
