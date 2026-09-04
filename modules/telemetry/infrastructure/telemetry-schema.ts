import {
  pgTable,
  text,
  varchar,
  integer,
  jsonb,
  timestamp,
  index,
  uuid,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "@/modules/identity/infrastructure/auth-schema";
import type {
  TelemetryUserRole,
  TelemetryContextType,
} from "../domain/telemetry-types";

/**
 * Telemetry Events Table (Acceptance Contract §7.1)
 * Stores structured behavioral, reliability, and pilot success measurement events.
 */
export const telemetryEvents = pgTable(
  "telemetry_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    userRole: varchar("user_role", { length: 20 })
      .$type<TelemetryUserRole>()
      .notNull(),
    eventName: varchar("event_name", { length: 64 }).notNull(),
    contextType: varchar("context_type", { length: 20 })
      .$type<TelemetryContextType>()
      .notNull(),
    contextId: text("context_id"),
    durationMs: integer("duration_ms"),
    properties: jsonb("properties")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_telemetry_event_name_created").on(
      table.eventName,
      table.createdAt
    ),
    index("idx_telemetry_context").on(table.contextType, table.contextId),
    check(
      "check_telemetry_user_role",
      sql`${table.userRole} IN ('learner', 'teacher', 'system')`
    ),
    check(
      "check_telemetry_context_type",
      sql`${table.contextType} IN ('practice', 'homework', 'system')`
    ),
  ]
);

export type TelemetryEventTable = typeof telemetryEvents.$inferSelect;
export type NewTelemetryEventTable = typeof telemetryEvents.$inferInsert;
