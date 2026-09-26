import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
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

export type ReadingMeta = { scores: { love: number; money: number; health: number }; luckyColor: LuckyColorId; luckyNumber: number };
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
