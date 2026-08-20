CREATE TABLE "media_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"scene_id" text,
	"chapter_id" text,
	"type" text NOT NULL,
	"source" text DEFAULT 'GENERATED' NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"provider_request_id" text,
	"storage_provider" text DEFAULT 'r2' NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"duration_seconds" numeric(8, 2),
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"checksum" text,
	"generation_run_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"scene_id" text,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"provider_request_id" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"latency_ms" integer,
	"input_metadata" jsonb,
	"output_metadata" jsonb,
	"error_code" text,
	"error_message" text,
	"usage_metadata" jsonb,
	"cost_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "media_state" text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "voice_estimated_duration_seconds" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "voice_actual_duration_seconds" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "character_key" text;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "reference_asset_id" text;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "style_reference_asset_id" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_chapter_id_video_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."video_chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_runs" ADD CONSTRAINT "media_runs_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_runs" ADD CONSTRAINT "media_runs_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_assets_video_id_idx" ON "media_assets" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "media_assets_scene_id_idx" ON "media_assets" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "media_assets_status_idx" ON "media_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "media_assets_type_idx" ON "media_assets" USING btree ("type");--> statement-breakpoint
CREATE INDEX "media_runs_video_id_idx" ON "media_runs" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "media_runs_scene_id_idx" ON "media_runs" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "media_runs_status_idx" ON "media_runs" USING btree ("status");