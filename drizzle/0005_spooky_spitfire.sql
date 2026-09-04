CREATE TABLE "telemetry_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"user_role" varchar(20) NOT NULL,
	"event_name" varchar(64) NOT NULL,
	"context_type" varchar(20) NOT NULL,
	"context_id" text,
	"duration_ms" integer,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_telemetry_event_name_created" ON "telemetry_events" USING btree ("event_name","created_at");--> statement-breakpoint
CREATE INDEX "idx_telemetry_context" ON "telemetry_events" USING btree ("context_type","context_id");