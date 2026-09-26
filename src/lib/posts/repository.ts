import { and, asc, desc, eq, lt, type SQL } from 'drizzle-orm';
import { postSlides, posts, readings } from '@/db/schema';
import type { Db } from '@/db/types';
import type { PostRow, ReadingKey, ReadingRow, SlideRow } from '@/lib/content/repository';
import type { ReadingAudience, ReadingKind } from '@/lib/content/types';
import { addDays, type DateKey } from '@/lib/date/istanbul';

export type PostStatus = PostRow['status'];
export type SlideWithReading = SlideRow & { reading: ReadingRow | null };
export type PostDetail = { post: PostRow; slides: SlideWithReading[] };
export type PostVersion = Pick<PostRow, 'id' | 'version' | 'isCurrent' | 'status' | 'createdAt'>;
export type ArchiveFilter = {
  kind?: ReadingKind;
  audience?: ReadingAudience;
  status?: PostStatus;
  before?: DateKey;
  limit: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// URL'den gelen kimlik uuid değilse Postgres sorguyu 22P02 ile düşürür; önce biçim denetlenir.
export function isPostId(value: string): boolean {
  return UUID.test(value);
}

async function findPost(db: Db, id: string): Promise<PostRow | null> {
  if (!isPostId(id)) return null;
  const [post] = await db.select().from(posts).where(eq(posts.id, id));
  return post ?? null;
}

export async function getPostDetail(db: Db, id: string): Promise<PostDetail | null> {
  const post = await findPost(db, id);
  if (!post) return null;
  const rows = await db
    .select({ slide: postSlides, reading: readings })
    .from(postSlides)
    .leftJoin(readings, eq(postSlides.readingId, readings.id))
    .where(eq(postSlides.postId, id))
    .orderBy(asc(postSlides.position));
  return { post, slides: rows.map(({ slide, reading }) => ({ ...slide, reading })) };
}

export async function getPostVersions(db: Db, key: ReadingKey): Promise<PostVersion[]> {
  return db
    .select({ id: posts.id, version: posts.version, isCurrent: posts.isCurrent, status: posts.status, createdAt: posts.createdAt })
    .from(posts)
    .where(and(eq(posts.date, key.date), eq(posts.kind, key.kind), eq(posts.audience, key.audience)))
    .orderBy(desc(posts.version));
}

export async function listArchivePosts(db: Db, filter: ArchiveFilter): Promise<PostRow[]> {
  const conditions: SQL[] = [eq(posts.isCurrent, true)];
  if (filter.kind) conditions.push(eq(posts.kind, filter.kind));
  if (filter.audience) conditions.push(eq(posts.audience, filter.audience));
  if (filter.status) conditions.push(eq(posts.status, filter.status));
  if (filter.before) conditions.push(lt(posts.date, filter.before));
  return db
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.date), asc(posts.audience))
    .limit(filter.limit);
}

// Sayfa gün sınırında kesilir: sınırdaki günün gönderileri bir sonraki sayfaya bütün olarak geçer.
// Günde en fazla 5 gönderi var; tek bir gün sayfa boyunu aşamaz.
export async function listArchivePage(
  db: Db,
  filter: Omit<ArchiveFilter, 'limit'>,
  size: number,
): Promise<{ posts: PostRow[]; nextBefore: DateKey | null }> {
  const rows = await listArchivePosts(db, { ...filter, limit: size + 1 });
  if (rows.length <= size) return { posts: rows, nextBefore: null };
  const boundary = rows[size].date;
  const complete = rows.slice(0, size).filter((post) => post.date !== boundary);
  return { posts: complete, nextBefore: addDays(boundary, 1) };
}

export async function markPostDownloaded(db: Db, id: string, now: Date = new Date()): Promise<PostRow | null> {
  const post = await findPost(db, id);
  if (!post) return null;
  const [updated] = await db
    .update(posts)
    .set({ downloadedAt: now, status: post.status === 'paylasildi' ? 'paylasildi' : 'indirildi' })
    .where(eq(posts.id, id))
    .returning();
  return updated;
}

export async function setPostPublished(db: Db, id: string, published: boolean, now: Date = new Date()): Promise<PostRow | null> {
  const post = await findPost(db, id);
  if (!post) return null;
  const [updated] = await db
    .update(posts)
    .set(
      published
        ? { status: 'paylasildi', publishedAt: now }
        : { status: post.downloadedAt ? 'indirildi' : 'taslak', publishedAt: null },
    )
    .where(eq(posts.id, id))
    .returning();
  return updated;
}
