ALTER TABLE "speaking_sessions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "speaking_sessions" ADD COLUMN "candidate_name" text;