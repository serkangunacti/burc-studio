CREATE TYPE "public"."publication_format" AS ENUM('carousel', 'reels');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('ready', 'approved', 'publishing', 'published', 'skipped', 'expired', 'failed');--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"secret_encrypted" text NOT NULL,
	"account" jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"post_id" uuid NOT NULL,
	"kind" "reading_kind" NOT NULL,
	"audience" "audience" NOT NULL,
	"format" "publication_format" NOT NULL,
	"part" smallint NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "publication_status" DEFAULT 'ready' NOT NULL,
	"caption" text NOT NULL,
	"media" jsonb NOT NULL,
	"ig_container_id" text,
	"ig_media_id" text,
	"permalink" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"telegram_message_id" integer,
	"approved_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_files_position_uq" ON "media_files" USING btree ("publication_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "publications_slot_uq" ON "publications" USING btree ("date","kind","audience","format","part");--> statement-breakpoint
CREATE INDEX "publications_status_scheduled_idx" ON "publications" USING btree ("status","scheduled_at");