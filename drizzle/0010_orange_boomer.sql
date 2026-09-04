CREATE TABLE "ai_assessment_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" varchar(20) DEFAULT 'ready' NOT NULL,
	"scores" jsonb NOT NULL,
	"overall_band" real NOT NULL,
	"feedback_summary" text,
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"improvements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"action_plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pronunciation_notes" jsonb DEFAULT '[]'::jsonb,
	"raw_proposal_json" jsonb,
	"model_version" varchar(64) DEFAULT 'gemini-2.5-flash' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"teacher_assessment_id" uuid NOT NULL,
	"ai_proposal_id" uuid,
	"attempt_number" integer NOT NULL,
	"teacher_id" text NOT NULL,
	"active_review_duration_ms" integer NOT NULL,
	"ai_proposal_accepted" boolean DEFAULT false NOT NULL,
	"score_deltas" jsonb NOT NULL,
	"teacher_modifications" jsonb,
	"model_version" varchar(64) DEFAULT 'gemini-2.5-flash',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "published_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"teacher_assessment_id" uuid NOT NULL,
	"learner_id" text NOT NULL,
	"teacher_id" text NOT NULL,
	"attempt_number" integer NOT NULL,
	"fluency_coherence" real NOT NULL,
	"lexical_resource" real NOT NULL,
	"grammatical_range_accuracy" real NOT NULL,
	"pronunciation" real NOT NULL,
	"overall_band" real NOT NULL,
	"overall_feedback" text NOT NULL,
	"criteria_feedback" jsonb,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"teacher_id" text NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"fluency_coherence" real NOT NULL,
	"lexical_resource" real NOT NULL,
	"grammatical_range_accuracy" real NOT NULL,
	"pronunciation" real NOT NULL,
	"overall_band" real NOT NULL,
	"overall_feedback" text NOT NULL,
	"criteria_feedback" jsonb,
	"annotations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_assessment_proposals" ADD CONSTRAINT "ai_assessment_proposals_submission_id_homework_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."homework_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_assessment_proposals" ADD CONSTRAINT "ai_assessment_proposals_attempt_id_submission_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."submission_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_feedbacks" ADD CONSTRAINT "evaluation_feedbacks_submission_id_homework_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."homework_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_feedbacks" ADD CONSTRAINT "evaluation_feedbacks_teacher_assessment_id_teacher_assessments_id_fk" FOREIGN KEY ("teacher_assessment_id") REFERENCES "public"."teacher_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_feedbacks" ADD CONSTRAINT "evaluation_feedbacks_ai_proposal_id_ai_assessment_proposals_id_fk" FOREIGN KEY ("ai_proposal_id") REFERENCES "public"."ai_assessment_proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_feedbacks" ADD CONSTRAINT "evaluation_feedbacks_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_assessments" ADD CONSTRAINT "published_assessments_submission_id_homework_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."homework_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_assessments" ADD CONSTRAINT "published_assessments_assignment_id_homework_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."homework_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_assessments" ADD CONSTRAINT "published_assessments_teacher_assessment_id_teacher_assessments_id_fk" FOREIGN KEY ("teacher_assessment_id") REFERENCES "public"."teacher_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_assessments" ADD CONSTRAINT "published_assessments_learner_id_user_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_assessments" ADD CONSTRAINT "published_assessments_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assessments" ADD CONSTRAINT "teacher_assessments_submission_id_homework_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."homework_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assessments" ADD CONSTRAINT "teacher_assessments_assignment_id_homework_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."homework_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_assessments" ADD CONSTRAINT "teacher_assessments_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_assessment_proposals_submission_id" ON "ai_assessment_proposals" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "idx_ai_assessment_proposals_attempt_id" ON "ai_assessment_proposals" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "idx_evaluation_feedbacks_submission_id" ON "evaluation_feedbacks" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "idx_evaluation_feedbacks_teacher_id" ON "evaluation_feedbacks" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "idx_published_assessments_submission_id" ON "published_assessments" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "idx_published_assessments_assignment_id" ON "published_assessments" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "idx_published_assessments_learner_id" ON "published_assessments" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "idx_teacher_assessments_submission_id" ON "teacher_assessments" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "idx_teacher_assessments_teacher_id" ON "teacher_assessments" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "idx_teacher_assessments_status" ON "teacher_assessments" USING btree ("status");