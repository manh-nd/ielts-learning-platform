import {
  pgTable,
  text,
  varchar,
  timestamp,
  index,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "@/modules/identity/infrastructure/auth-schema";

/**
 * Classrooms Table (Issue #73, ADR-0009)
 * Represents a single-teacher learning cohort grouping learners.
 */
export const classrooms = pgTable(
  "classrooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_classrooms_teacher_id").on(table.teacherId)]
);

/**
 * Classroom Members Table (Issue #73, ADR-0009)
 * Association between a Learner and a Classroom.
 * Enforces unique membership per (classroom, learner).
 */
export const classroomMembers = pgTable(
  "classroom_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classroomId: uuid("classroom_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "cascade" }),
    learnerId: text("learner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_classroom_member").on(table.classroomId, table.learnerId),
    index("idx_classroom_members_classroom_id").on(table.classroomId),
    index("idx_classroom_members_learner_id").on(table.learnerId),
  ]
);

export type ClassroomTable = typeof classrooms.$inferSelect;
export type NewClassroomTable = typeof classrooms.$inferInsert;
export type ClassroomMemberTable = typeof classroomMembers.$inferSelect;
export type NewClassroomMemberTable = typeof classroomMembers.$inferInsert;
