import { and, asc, eq, gte, lt, max } from 'drizzle-orm';
import { postSlides, posts, readings, type PostCover, type PostFormat, type ReadingMeta } from '@/db/schema';
import type { Db } from '@/db/types';
import { addDays, type DateKey } from '@/lib/date/istanbul';
import { SIGN_SLUGS, type SignSlug } from '@/lib/zodiac/signs';
import type { ReadingAudience, ReadingKind, RecentHeadline } from './types';

export type ReadingKey = { date: DateKey; kind: ReadingKind; audience: ReadingAudience };
export type NewReading = {
  sign: SignSlug;
  headline: string;
  body: string;
  short: string;
  meta: ReadingMeta;
  provider: string;
  model: string;
  promptVersion: string;
  runId: string | null;
  editedAt?: Date;
};
export type ReadingRow = typeof readings.$inferSelect;
export type PostRow = typeof posts.$inferSelect;
export type SlideRow = typeof postSlides.$inferSelect;
export type NewPost = ReadingKey & {
  templateVersion: string;
  format: PostFormat;
  cover: PostCover;
  caption: string;
  hashtags: string[];
  signReadingIds: readonly string[];
  // Düzenleme ve tek burç yenileme bu sürümün üzerine kurulur; o sırada başka bir sürüm açılmışsa kayıt reddedilir.
  basePostId?: string;
};

export class PostConflictError extends Error {
  constructor() {
    super('Gönderi bu sırada değişti; sayfayı yenile.');
    this.name = 'PostConflictError';
  }
}

function readingWhere(key: ReadingKey, sign: SignSlug) {
  return and(eq(readings.date, key.date), eq(readings.kind, key.kind), eq(readings.audience, key.audience), eq(readings.sign, sign));
}

function postWhere(key: ReadingKey) {
  return and(eq(posts.date, key.date), eq(posts.kind, key.kind), eq(posts.audience, key.audience));
}

export async function saveReadings(db: Db, key: ReadingKey, items: readonly NewReading[]): Promise<ReadingRow[]> {
  return db.transaction(async (tx) => {
    const saved: ReadingRow[] = [];
    for (const item of items) {
      const where = readingWhere(key, item.sign);
      const [{ latest }] = await tx.select({ latest: max(readings.version) }).from(readings).where(where);
      await tx.update(readings).set({ isCurrent: false }).where(and(where, eq(readings.isCurrent, true)));
      const [row] = await tx
        .insert(readings)
        .values({ ...key, ...item, version: (latest ?? 0) + 1, isCurrent: true })
        .returning();
      saved.push(row);
    }
    return saved;
  });
}

export async function getCurrentReadings(db: Db, key: ReadingKey): Promise<ReadingRow[]> {
  const rows = await db
    .select()
    .from(readings)
    .where(and(eq(readings.date, key.date), eq(readings.kind, key.kind), eq(readings.audience, key.audience), eq(readings.isCurrent, true)));
  return rows.sort((a, b) => SIGN_SLUGS.indexOf(a.sign) - SIGN_SLUGS.indexOf(b.sign));
}

export async function getRecentHeadlines(
  db: Db,
  key: Omit<ReadingKey, 'date'>,
  beforeDate: DateKey,
  days: number,
): Promise<RecentHeadline[]> {
  return db
    .select({ date: readings.date, sign: readings.sign, headline: readings.headline, short: readings.short })
    .from(readings)
    .where(
      and(
        eq(readings.kind, key.kind),
        eq(readings.audience, key.audience),
        eq(readings.isCurrent, true),
        gte(readings.date, addDays(beforeDate, -days)),
        lt(readings.date, beforeDate),
      ),
    )
    .orderBy(asc(readings.date), asc(readings.sign));
}

export async function createPostVersion(db: Db, input: NewPost): Promise<PostRow> {
  if (input.signReadingIds.length !== SIGN_SLUGS.length) throw new Error('Gönderi için 12 burç yorumu gerekir');
  return db.transaction(async (tx) => {
    if (input.basePostId) {
      const released = await tx
        .update(posts)
        .set({ isCurrent: false })
        .where(and(eq(posts.id, input.basePostId), eq(posts.isCurrent, true)))
        .returning({ id: posts.id });
      if (released.length === 0) throw new PostConflictError();
    }
    const [{ latest }] = await tx.select({ latest: max(posts.version) }).from(posts).where(postWhere(input));
    await tx.update(posts).set({ isCurrent: false }).where(and(postWhere(input), eq(posts.isCurrent, true)));
    const [post] = await tx
      .insert(posts)
      .values({
        date: input.date,
        kind: input.kind,
        audience: input.audience,
        version: (latest ?? 0) + 1,
        isCurrent: true,
        templateVersion: input.templateVersion,
        format: input.format,
        cover: input.cover,
        caption: input.caption,
        hashtags: input.hashtags,
      })
      .returning();
    await tx.insert(postSlides).values([
      { postId: post.id, position: 0, type: 'cover', readingId: null },
      ...input.signReadingIds.map((readingId, index) => ({ postId: post.id, position: index + 1, type: 'sign' as const, readingId })),
      { postId: post.id, position: input.signReadingIds.length + 1, type: 'cta', readingId: null },
    ]);
    return post;
  });
}

export async function getCurrentPost(db: Db, key: ReadingKey): Promise<{ post: PostRow; slides: SlideRow[] } | null> {
  const [post] = await db.select().from(posts).where(and(postWhere(key), eq(posts.isCurrent, true)));
  if (!post) return null;
  const slides = await db.select().from(postSlides).where(eq(postSlides.postId, post.id)).orderBy(asc(postSlides.position));
  return { post, slides };
}

export async function getCurrentPostsForDate(db: Db, date: DateKey): Promise<PostRow[]> {
  return db.select().from(posts).where(and(eq(posts.date, date), eq(posts.isCurrent, true)));
}
