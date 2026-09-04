CREATE TABLE "homework_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"classroom_id" uuid NOT NULL,
	"teacher_id" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"instructions" text,
	"prompts" jsonb NOT NULL,
	"submission_deadline" timestamp with time zone NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "homework_assignments" ADD CONSTRAINT "homework_assignments_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_assignments" ADD CONSTRAINT "homework_assignments_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_homework_assignments_classroom_id" ON "homework_assignments" USING btree ("classroom_id");--> statement-breakpoint
CREATE INDEX "idx_homework_assignments_teacher_id" ON "homework_assignments" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "idx_homework_assignments_status" ON "homework_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_homework_assignments_deadline" ON "homework_assignments" USING btree ("submission_deadline");