CREATE TABLE "homework_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"learner_id" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"current_attempt_number" integer DEFAULT 1 NOT NULL,
	"reviewed_attempt_number" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"audio_responses" jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_assignment_id_homework_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."homework_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_learner_id_user_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_attempts" ADD CONSTRAINT "submission_attempts_submission_id_homework_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."homework_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_homework_submissions_assignment_id" ON "homework_submissions" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "idx_homework_submissions_learner_id" ON "homework_submissions" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "idx_homework_submissions_status" ON "homework_submissions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_homework_submissions_assignment_learner" ON "homework_submissions" USING btree ("assignment_id","learner_id");--> statement-breakpoint
CREATE INDEX "idx_submission_attempts_submission_id" ON "submission_attempts" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_submission_attempts_submission_attempt_number" ON "submission_attempts" USING btree ("submission_id","attempt_number");