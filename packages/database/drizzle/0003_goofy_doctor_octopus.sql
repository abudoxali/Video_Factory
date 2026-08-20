CREATE TABLE "renders" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"video_id" varchar(128) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" varchar(64) DEFAULT 'PENDING' NOT NULL,
	"width" integer DEFAULT 1080 NOT NULL,
	"height" integer DEFAULT 1920 NOT NULL,
	"fps" integer DEFAULT 30 NOT NULL,
	"duration_seconds" numeric(10, 3),
	"duration_frames" integer,
	"manifest_json" jsonb,
	"storage_provider" varchar(64) DEFAULT 'r2',
	"bucket" varchar(255),
	"object_key" text,
	"mime_type" varchar(128) DEFAULT 'video/mp4',
	"size_bytes" bigint,
	"checksum" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "render_runs" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"render_id" varchar(128) NOT NULL,
	"video_id" varchar(128) NOT NULL,
	"engine" varchar(64) DEFAULT 'remotion' NOT NULL,
	"engine_version" varchar(64) DEFAULT '4.0.0',
	"status" varchar(64) DEFAULT 'PROCESSING' NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"latency_ms" integer,
	"error_code" varchar(128),
	"error_message" text,
	"input_metadata" jsonb,
	"output_metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "renders" ADD CONSTRAINT "renders_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_runs" ADD CONSTRAINT "render_runs_render_id_renders_id_fk" FOREIGN KEY ("render_id") REFERENCES "public"."renders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_runs" ADD CONSTRAINT "render_runs_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "renders_video_id_idx" ON "renders" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "renders_status_idx" ON "renders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "renders_video_version_idx" ON "renders" USING btree ("video_id","version");--> statement-breakpoint
CREATE INDEX "render_runs_render_id_idx" ON "render_runs" USING btree ("render_id");--> statement-breakpoint
CREATE INDEX "render_runs_video_id_idx" ON "render_runs" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "render_runs_status_idx" ON "render_runs" USING btree ("status");