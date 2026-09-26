CREATE TYPE "public"."audience" AS ENUM('kadin', 'erkek', 'genel');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('taslak', 'hazir', 'indirildi', 'paylasildi');--> statement-breakpoint
CREATE TYPE "public"."reading_kind" AS ENUM('horoscope', 'tarot', 'special');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."run_trigger" AS ENUM('cron', 'button', 'regenerate', 'local');--> statement-breakpoint
CREATE TYPE "public"."slide_type" AS ENUM('cover', 'sign', 'cta');--> statement-breakpoint
CREATE TABLE "generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"kind" "reading_kind" NOT NULL,
	"audience" "audience" NOT NULL,
	"sign" text,
	"trigger" "run_trigger" NOT NULL,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "llm_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"http_status" integer,
	"error" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_slides" (
	"post_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"type" "slide_type" NOT NULL,
	"reading_id" uuid,
	CONSTRAINT "post_slides_post_id_position_pk" PRIMARY KEY("post_id","position")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"kind" "reading_kind" NOT NULL,
	"audience" "audience" NOT NULL,
	"version" integer NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"status" "post_status" DEFAULT 'taslak' NOT NULL,
	"template_version" text NOT NULL,
	"format" text DEFAULT '4x5' NOT NULL,
	"cover" jsonb NOT NULL,
	"caption" text NOT NULL,
	"hashtags" text[] NOT NULL,
	"downloaded_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"kind" "reading_kind" NOT NULL,
	"audience" "audience" NOT NULL,
	"sign" text NOT NULL,
	"version" integer NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"headline" text NOT NULL,
	"body" text NOT NULL,
	"short" text NOT NULL,
	"meta" jsonb NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"run_id" uuid,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_run_id_generation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."generation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_slides" ADD CONSTRAINT "post_slides_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_slides" ADD CONSTRAINT "post_slides_reading_id_readings_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."readings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_run_id_generation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."generation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "generation_runs_running_uq" ON "generation_runs" USING btree ("date","kind","audience") WHERE "generation_runs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "llm_calls_provider_created_idx" ON "llm_calls" USING btree ("provider","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_current_uq" ON "posts" USING btree ("date","kind","audience") WHERE "posts"."is_current";--> statement-breakpoint
CREATE UNIQUE INDEX "posts_version_uq" ON "posts" USING btree ("date","kind","audience","version");--> statement-breakpoint
CREATE UNIQUE INDEX "readings_current_uq" ON "readings" USING btree ("date","kind","audience","sign") WHERE "readings"."is_current";--> statement-breakpoint
CREATE UNIQUE INDEX "readings_version_uq" ON "readings" USING btree ("date","kind","audience","sign","version");