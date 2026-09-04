import {
  pgTable,
  text,
  varchar,
  timestamp,
  index,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";
import { user } from "@/modules/identity/infrastructure/auth-schema";
import { classrooms } from "@/modules/classroom/infrastructure/classroom-schema";
import type { HomeworkPromptItem } from "../domain/homework-types";

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
