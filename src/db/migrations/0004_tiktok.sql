ALTER TYPE "public"."publication_format" ADD VALUE 'tiktok';--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "remote_id" text;