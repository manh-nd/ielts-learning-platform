CREATE TABLE "speaking_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"part_number" integer NOT NULL,
	"item_index" integer DEFAULT 0 NOT NULL,
	"prompt_question" text NOT NULL,
	"storage_key" text,
	"audio_url" text,
	"mime_type" text DEFAULT 'audio/webm;codecs=opus',
	"start_ms" integer DEFAULT 0 NOT NULL,
	"end_ms" integer DEFAULT 0 NOT NULL,
	"duration_seconds" real DEFAULT 0 NOT NULL,
	"live_transcript" text DEFAULT '',
	"verified_transcript" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speaking_review_annotations" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"response_id" text,
	"category" text DEFAULT 'general' NOT NULL,
	"timestamp_seconds" real DEFAULT 0 NOT NULL,
	"audio_clip_start_ms" integer,
	"audio_clip_end_ms" integer,
	"original_quote" text,
	"comment" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speaking_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"topic_title" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"target_part" text DEFAULT 'full' NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"overall_band" real,
	"scorecard_json" jsonb,
	"evidence_json" jsonb,
	"practice_monologue" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "speaking_responses" ADD CONSTRAINT "speaking_responses_session_id_speaking_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."speaking_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speaking_review_annotations" ADD CONSTRAINT "speaking_review_annotations_session_id_speaking_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."speaking_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speaking_review_annotations" ADD CONSTRAINT "speaking_review_annotations_response_id_speaking_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."speaking_responses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speaking_sessions" ADD CONSTRAINT "speaking_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;