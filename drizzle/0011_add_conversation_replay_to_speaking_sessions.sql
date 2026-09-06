ALTER TABLE "speaking_sessions" ADD COLUMN "conversation_replay_storage_key" text;--> statement-breakpoint
ALTER TABLE "speaking_sessions" ADD COLUMN "conversation_replay_mime_type" text;--> statement-breakpoint
ALTER TABLE "speaking_sessions" ADD COLUMN "conversation_replay_duration_seconds" real;
