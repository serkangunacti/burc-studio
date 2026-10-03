import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { LuckyColorId } from '../lib/content/lucky-colors';
import { READING_AUDIENCES, READING_KINDS, RUN_TRIGGERS } from '../lib/content/types';
import type { SignSlug } from '../lib/zodiac/signs';

export const settings = pgTable(
  'settings',
  {
    id: smallint('id').primaryKey().default(1),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('settings_singleton', sql`${t.id} = 1`)],
);

export const loginAttempts = pgTable('login_attempts', {
  ip: text('ip').primaryKey(),
  count: integer('count').notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
});

export type ReadingMeta = {
  scores: { love: number; money: number; health: number };
  luckyColor: LuckyColorId;
  luckyNumber: number;
  tarotCardId?: string;
};
export type PostCover = { hook: string };
export type PostFormat = '4x5' | '3x4';

export const readingKindEnum = pgEnum('reading_kind', READING_KINDS);
export const audienceEnum = pgEnum('audience', READING_AUDIENCES);
export const postStatusEnum = pgEnum('post_status', ['taslak', 'hazir', 'indirildi', 'paylasildi']);
export const slideTypeEnum = pgEnum('slide_type', ['cover', 'sign', 'cta']);
export const runStatusEnum = pgEnum('run_status', ['running', 'succeeded', 'failed']);
export const runTriggerEnum = pgEnum('run_trigger', RUN_TRIGGERS);

export const generationRuns = pgTable(
  'generation_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date', { mode: 'string' }).notNull(),
    kind: readingKindEnum('kind').notNull(),
    audience: audienceEnum('audience').notNull(),
    sign: text('sign').$type<SignSlug>(),
    trigger: runTriggerEnum('trigger').notNull(),
    status: runStatusEnum('status').notNull().default('running'),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('generation_runs_running_uq').on(t.date, t.kind, t.audience).where(sql`${t.status} = 'running'`)],
);

export const llmCalls = pgTable(
  'llm_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id').references(() => generationRuns.id),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    status: text('status').notNull(),
    httpStatus: integer('http_status'),
    error: text('error'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    latencyMs: integer('latency_ms').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('llm_calls_provider_created_idx').on(t.provider, t.createdAt)],
);

export const readings = pgTable(
  'readings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date', { mode: 'string' }).notNull(),
    kind: readingKindEnum('kind').notNull(),
    audience: audienceEnum('audience').notNull(),
    sign: text('sign').$type<SignSlug>().notNull(),
    version: integer('version').notNull(),
    isCurrent: boolean('is_current').notNull().default(true),
    headline: text('headline').notNull(),
    body: text('body').notNull(),
    short: text('short').notNull(),
    meta: jsonb('meta').$type<ReadingMeta>().notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    runId: uuid('run_id').references(() => generationRuns.id),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('readings_current_uq').on(t.date, t.kind, t.audience, t.sign).where(sql`${t.isCurrent}`),
    uniqueIndex('readings_version_uq').on(t.date, t.kind, t.audience, t.sign, t.version),
  ],
);

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date', { mode: 'string' }).notNull(),
    kind: readingKindEnum('kind').notNull(),
    audience: audienceEnum('audience').notNull(),
    version: integer('version').notNull(),
    isCurrent: boolean('is_current').notNull().default(true),
    status: postStatusEnum('status').notNull().default('taslak'),
    templateVersion: text('template_version').notNull(),
    format: text('format').$type<PostFormat>().notNull().default('4x5'),
    cover: jsonb('cover').$type<PostCover>().notNull(),
    caption: text('caption').notNull(),
    hashtags: text('hashtags').array().notNull(),
    downloadedAt: timestamp('downloaded_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('posts_current_uq').on(t.date, t.kind, t.audience).where(sql`${t.isCurrent}`),
    uniqueIndex('posts_version_uq').on(t.date, t.kind, t.audience, t.version),
  ],
);

export const postSlides = pgTable(
  'post_slides',
  {
    postId: uuid('post_id').notNull().references(() => posts.id),
    position: integer('position').notNull(),
    type: slideTypeEnum('type').notNull(),
    readingId: uuid('reading_id').references(() => readings.id),
  },
  (t) => [primaryKey({ columns: [t.postId, t.position] })],
);

export const PUBLICATION_FORMATS = ['carousel', 'reels', 'tiktok'] as const;
export type PublicationFormat = (typeof PUBLICATION_FORMATS)[number];
export const PUBLICATION_STATUSES = ['ready', 'approved', 'publishing', 'published', 'skipped', 'expired', 'failed'] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
export type PublicationMedia = { imageIds?: string[]; videoUrl?: string; isAiGenerated?: boolean };

export const publicationFormatEnum = pgEnum('publication_format', PUBLICATION_FORMATS);
export const publicationStatusEnum = pgEnum('publication_status', PUBLICATION_STATUSES);

// Carousel'ler Instagram'ın 10 görsel sınırı yüzünden üç parça (part 1–3) hâlinde paylaşılır; Reels ve TikTok'ta part 0.
export const publications = pgTable(
  'publications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date', { mode: 'string' }).notNull(),
    postId: uuid('post_id').notNull().references(() => posts.id),
    kind: readingKindEnum('kind').notNull(),
    audience: audienceEnum('audience').notNull(),
    format: publicationFormatEnum('format').notNull(),
    part: smallint('part').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    status: publicationStatusEnum('status').notNull().default('ready'),
    caption: text('caption').notNull(),
    media: jsonb('media').$type<PublicationMedia>().notNull(),
    igContainerId: text('ig_container_id'),
    igMediaId: text('ig_media_id'),
    // TikTok veya Instagram Reels paylaşımının Buffer gönderi kimliği.
    remoteId: text('remote_id'),
    permalink: text('permalink'),
    error: text('error'),
    attempts: integer('attempts').notNull().default(0),
    // Instagram'ın ERROR/EXPIRED verdiği container'ın baştan kurulma sayısı.
    rebuilds: smallint('rebuilds').notNull().default(0),
    // Instagram'a yayınla / Buffer'a oluştur isteği gönderildiği an. Belirsiz sonuçta kopya oluşturulmaz.
    publishAttemptedAt: timestamp('publish_attempted_at', { withTimezone: true }),
    telegramMessageId: integer('telegram_message_id'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('publications_slot_uq').on(t.date, t.kind, t.audience, t.format, t.part),
    index('publications_status_scheduled_idx').on(t.status, t.scheduledAt),
  ],
);

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({ dataType: () => 'bytea' });

// Carousel JPEG'leri Blob yerine burada durur: Hobby planında Blob ayda 2.000 yükleme işlemiyle sınırlı.
export const mediaFiles = pgTable(
  'media_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicationId: uuid('publication_id')
      .notNull()
      .references(() => publications.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    contentType: text('content_type').notNull(),
    data: bytea('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('media_files_position_uq').on(t.publicationId, t.position)],
);

export const INTEGRATION_IDS = ['instagram', 'telegram', 'buffer', 'buffer_instagram', 'github'] as const;
export type IntegrationId = (typeof INTEGRATION_IDS)[number];
export type IntegrationAccount = { id: string; username: string | null; rateLimits?: { windowSeconds: number; limit: number; remaining: number; resetsAt: string }[] };

// Instagram ve Telegram anahtarları Ayarlar'dan girilir; INTEGRATIONS_KEY ile şifreli saklanır.
export const integrations = pgTable('integrations', {
  id: text('id').$type<IntegrationId>().primaryKey(),
  secretEncrypted: text('secret_encrypted').notNull(),
  account: jsonb('account').$type<IntegrationAccount>().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
