CREATE TABLE "video_briefs" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"working_title" text NOT NULL,
	"core_idea" text NOT NULL,
	"objective" text NOT NULL,
	"target_audience" text NOT NULL,
	"tone" text NOT NULL,
	"content_angle" text NOT NULL,
	"hook_strategy" text NOT NULL,
	"narrative_style" text NOT NULL,
	"visual_direction" text NOT NULL,
	"pacing" text DEFAULT 'moderate' NOT NULL,
	"call_to_action" text,
	"key_points" jsonb DEFAULT '[]' NOT NULL,
	"constraints" jsonb DEFAULT '[]' NOT NULL,
	"planning_notes" text,
	"requires_research" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'READY_FOR_REVIEW' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_scripts" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"brief_id" text,
	"title" text NOT NULL,
	"hook" text NOT NULL,
	"sections" jsonb DEFAULT '[]' NOT NULL,
	"full_narration" text NOT NULL,
	"estimated_word_count" integer DEFAULT 0 NOT NULL,
	"estimated_duration_seconds" integer DEFAULT 0 NOT NULL,
	"language" text DEFAULT 'ar' NOT NULL,
	"call_to_action" text,
	"script_version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'READY_FOR_REVIEW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"purpose" text NOT NULL,
	"summary" text NOT NULL,
	"target_duration_seconds" integer NOT NULL,
	"script_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenes" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"chapter_id" text,
	"position" integer NOT NULL,
	"purpose" text DEFAULT '' NOT NULL,
	"narration" text DEFAULT '' NOT NULL,
	"on_screen_text" text,
	"visual_description" text NOT NULL,
	"visual_prompt" text NOT NULL,
	"media_strategy" text DEFAULT 'AI_VIDEO' NOT NULL,
	"animation_direction" text,
	"camera_direction" text,
	"transition" text,
	"duration_seconds" integer NOT NULL,
	"start_time" integer DEFAULT 0 NOT NULL,
	"end_time" integer DEFAULT 0 NOT NULL,
	"shot_type" text,
	"lighting" text,
	"environment" text,
	"subject" text,
	"character_notes" text,
	"continuity_notes" text,
	"status" text DEFAULT 'PLANNED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"job_id" text NOT NULL,
	"stage" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"status" text DEFAULT 'SUCCESS' NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"latency_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"input_metadata" jsonb,
	"output_metadata" jsonb,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "plan_status" text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "video_briefs" ADD CONSTRAINT "video_briefs_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_scripts" ADD CONSTRAINT "video_scripts_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_scripts" ADD CONSTRAINT "video_scripts_brief_id_video_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."video_briefs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_chapters" ADD CONSTRAINT "video_chapters_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_chapter_id_video_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."video_chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_job_id_video_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."video_jobs"("id") ON DELETE cascade ON UPDATE no action;