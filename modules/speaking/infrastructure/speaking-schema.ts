import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  jsonb,
} from "drizzle-orm/pg-core";
import { user } from "@/modules/identity/infrastructure/auth-schema";

export type SpeakingSessionStatus =
  "in_progress" | "completed" | "evaluated" | "abandoned" | "audio_purged";
export type SpeakingAnnotationCategory =
  "pronunciation" | "grammar" | "lexical" | "fluency" | "general";

/**
 * Speaking Sessions Table
 * Stores metadata and overall scorecards for IELTS Speaking mock tests & practice sessions
 */
export const speakingSessions = pgTable("speaking_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  candidateName: text("candidate_name"),
  topicTitle: text("topic_title").notNull(),
  status: text("status")
    .$type<SpeakingSessionStatus>()
    .notNull()
    .default("in_progress"),
  targetPart: text("target_part").notNull().default("full"),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  overallBand: real("overall_band"),
  scorecardJson: jsonb("scorecard_json"),
  evidenceJson: jsonb("evidence_json"),
  practiceMonologue: text("practice_monologue"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Speaking Responses Table (ADR-0004)
 * Stores granular audio clips and transcript markers for individual questions across Part 1, 2, 3
 */
export const speakingResponses = pgTable("speaking_responses", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => speakingSessions.id, { onDelete: "cascade" }),
  partNumber: integer("part_number").notNull(), // 1, 2, 3
  itemIndex: integer("item_index").notNull().default(0),
  promptQuestion: text("prompt_question").notNull(),
  storageKey: text("storage_key"),
  audioUrl: text("audio_url"),
  mimeType: text("mime_type").default("audio/webm;codecs=opus"),
  startMs: integer("start_ms").notNull().default(0),
  endMs: integer("end_ms").notNull().default(0),
  durationSeconds: real("duration_seconds").notNull().default(0),
  liveTranscript: text("live_transcript").default(""),
  verifiedTranscript: text("verified_transcript"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Speaking Review Annotations Table (ADR-0004)
 * Stores timestamped evidence, phonetic corrections, and teacher feedback
 */
export const speakingReviewAnnotations = pgTable(
  "speaking_review_annotations",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => speakingSessions.id, { onDelete: "cascade" }),
    responseId: text("response_id").references(() => speakingResponses.id, {
      onDelete: "set null",
    }),
    category: text("category")
      .$type<SpeakingAnnotationCategory>()
      .notNull()
      .default("general"),
    timestampSeconds: real("timestamp_seconds").notNull().default(0),
    audioClipStartMs: integer("audio_clip_start_ms"),
    audioClipEndMs: integer("audio_clip_end_ms"),
    originalQuote: text("original_quote"),
    comment: text("comment").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  }
);

export type SpeakingSessionTable = typeof speakingSessions.$inferSelect;
export type NewSpeakingSessionTable = typeof speakingSessions.$inferInsert;
export type SpeakingResponseTable = typeof speakingResponses.$inferSelect;
export type NewSpeakingResponseTable = typeof speakingResponses.$inferInsert;
export type SpeakingReviewAnnotationTable =
  typeof speakingReviewAnnotations.$inferSelect;
export type NewSpeakingReviewAnnotationTable =
  typeof speakingReviewAnnotations.$inferInsert;
