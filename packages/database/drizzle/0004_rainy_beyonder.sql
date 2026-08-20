CREATE TABLE "social_accounts" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"platform" varchar(32) NOT NULL,
	"platform_user_id" varchar(255) NOT NULL,
	"platform_username" varchar(255),
	"display_name" varchar(255),
	"avatar_url" text,
	"status" varchar(64) DEFAULT 'CONNECTED' NOT NULL,
	"scopes" jsonb DEFAULT '[]',
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"token_expires_at" timestamp with time zone,
	"refresh_expires_at" timestamp with time zone,
	"metadata" jsonb,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_refreshed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"video_id" varchar(128) NOT NULL,
	"render_id" varchar(128) NOT NULL,
	"social_account_id" varchar(128) NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"platform" varchar(32) NOT NULL,
	"status" varchar(64) DEFAULT 'DRAFT' NOT NULL,
	"metadata_json" jsonb NOT NULL,
	"platform_publication_id" varchar(255),
	"platform_url" text,
	"idempotency_key" varchar(255) NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publication_attempts" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"publication_id" varchar(128) NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"provider" varchar(64) NOT NULL,
	"status" varchar(64) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"latency_ms" integer,
	"provider_request_id" varchar(255),
	"error_code" varchar(128),
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_snapshots" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"publication_id" varchar(128) NOT NULL,
	"platform" varchar(32) NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"views" integer,
	"likes" integer,
	"comments" integer,
	"shares" integer,
	"watch_time_seconds" numeric(12, 2),
	"average_view_duration_seconds" numeric(10, 2),
	"followers_gained" integer,
	"raw_supported_metrics" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_render_id_renders_id_fk" FOREIGN KEY ("render_id") REFERENCES "public"."renders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_attempts" ADD CONSTRAINT "publication_attempts_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "social_accounts_user_platform_idx" ON "social_accounts" USING btree ("user_id","platform");--> statement-breakpoint
CREATE INDEX "social_accounts_status_idx" ON "social_accounts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_platform_user_idx" ON "social_accounts" USING btree ("user_id","platform","platform_user_id");--> statement-breakpoint
CREATE INDEX "publications_video_id_idx" ON "publications" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "publications_render_id_idx" ON "publications" USING btree ("render_id");--> statement-breakpoint
CREATE INDEX "publications_social_account_id_idx" ON "publications" USING btree ("social_account_id");--> statement-breakpoint
CREATE INDEX "publications_user_id_idx" ON "publications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "publications_status_idx" ON "publications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "publications_idempotency_key_idx" ON "publications" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "publications_scheduled_at_idx" ON "publications" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "publication_attempts_publication_id_idx" ON "publication_attempts" USING btree ("publication_id");--> statement-breakpoint
CREATE INDEX "publication_attempts_status_idx" ON "publication_attempts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "analytics_snapshots_pub_captured_idx" ON "analytics_snapshots" USING btree ("publication_id","captured_at");