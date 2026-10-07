import { and, asc, eq, gte, inArray, isNotNull, lt, ne, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { integrations, mediaFiles, publications, type IntegrationId, type PublicationFormat, type PublicationMedia } from '@/db/schema';
import type { Db } from '@/db/types';
import type { DateKey } from '@/lib/date/istanbul';
import type { BufferRateLimit } from '@/lib/buffer/client';
import type { PlannedPublication } from './plan';

export type PublicationRow = typeof publications.$inferSelect;
export type IntegrationRow = typeof integrations.$inferSelect;
export type RenderedMedia = { images: Uint8Array[] } | { videoUrl: string; isAiGenerated?: boolean };

// Yalnız onaylanmamış veya zorla yenilenen satır yeniden çizimle ezilir.
const REPLACEABLE = ['ready', 'approved'] as const;
// Sonuç yazılmadan düşen bir paylaşım bu süreden sonra yeniden sahiplenilebilir.
const PUBLISH_LEASE_MS = 10 * 60_000;

export async function savePublication(
  db: Db,
  date: DateKey,
  planned: PlannedPublication,
  media: RenderedMedia,
  options: { force?: boolean } = {},
): Promise<PublicationRow | null> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(publications)
      .where(
        and(
          eq(publications.date, date),
          eq(publications.kind, planned.kind),
          eq(publications.audience, planned.audience),
          eq(publications.format, planned.format),
          eq(publications.part, planned.part),
        ),
      );
    const replaceable = options.force
      ? (['ready', 'approved', 'published', 'failed', 'skipped'] as const)
      : REPLACEABLE;
    if (existing && !(replaceable as readonly string[]).includes(existing.status)) return null;
    const isPublishedReset = Boolean(options.force && existing?.status === 'published');
    const values = {
      postId: planned.postId,
      scheduledAt: isPublishedReset && planned.scheduledAt.getTime() < Date.now() ? new Date() : planned.scheduledAt,
      caption: planned.caption,
      status: (isPublishedReset ? 'ready' : (existing?.status === 'approved' ? 'approved' : 'ready')) as const,
      media: 'videoUrl' in media ? { videoUrl: media.videoUrl, ...(media.isAiGenerated ? { isAiGenerated: true } : {}) } : {},
      error: null,
      igContainerId: null,
      remoteId: isPublishedReset ? null : (existing?.remoteId ?? null),
      permalink: isPublishedReset ? null : (existing?.permalink ?? null),
      publishedAt: isPublishedReset ? null : (existing?.publishedAt ?? null),
      approvedAt: isPublishedReset ? null : (existing?.approvedAt ?? null),
      updatedAt: new Date(),
    };
    const [row] = existing
      ? await tx.update(publications).set(values).where(eq(publications.id, existing.id)).returning()
      : await tx
          .insert(publications)
          .values({ ...values, date, kind: planned.kind, audience: planned.audience, format: planned.format, part: planned.part })
          .returning();
    if (!('images' in media)) return row;
    await tx.delete(mediaFiles).where(eq(mediaFiles.publicationId, row.id));
    const inserted = await tx
      .insert(mediaFiles)
      .values(media.images.map((data, position) => ({ publicationId: row.id, position, contentType: 'image/jpeg', data })))
      .returning({ id: mediaFiles.id, position: mediaFiles.position });
    const imageIds = inserted.sort((a, b) => a.position - b.position).map((file) => file.id);
    const [withMedia] = await tx
      .update(publications)
      .set({ media: { imageIds } satisfies PublicationMedia })
      .where(eq(publications.id, row.id))
      .returning();
    return withMedia;
  });
}

// Buffer'ın kabul ettiği ancak kotadan dolayı doğrulanamayan gönderiler kuyruk süresi dolsa da izlenir.
export async function listPendingBufferVerifications(db: Db): Promise<PublicationRow[]> {
  return db.select().from(publications).where(and(eq(publications.status, 'approved'), isNotNull(publications.remoteId)));
}

export async function listPublications(db: Db, date: DateKey): Promise<PublicationRow[]> {
  return db
    .select()
    .from(publications)
    .where(eq(publications.date, date))
    .orderBy(asc(publications.scheduledAt), asc(publications.part));
}

export async function getPublication(db: Db, id: string): Promise<PublicationRow | null> {
  const [row] = await db.select().from(publications).where(eq(publications.id, id));
  return row ?? null;
}

export async function approveDay(db: Db, date: DateKey, now = new Date()): Promise<PublicationRow[]> {
  return db
    .update(publications)
    .set({ status: 'approved', approvedAt: now, updatedAt: now })
    .where(and(eq(publications.date, date), eq(publications.status, 'ready')))
    .returning();
}

// Atlanan grup geri alınırsa gün onaylanmışsa yeniden onaya, değilse hazıra döner; onaya dönenler kuyruğa yeniden girer.
export async function setGroupSkipped(
  db: Db,
  input: { postId: string; format: PublicationFormat; skipped: boolean },
  now = new Date(),
): Promise<PublicationRow[]> {
  const group = and(eq(publications.postId, input.postId), eq(publications.format, input.format));
  if (input.skipped) {
    return db
      .update(publications)
      .set({ status: 'skipped', updatedAt: now })
      .where(and(group, inArray(publications.status, ['ready', 'approved'])))
      .returning();
  }
  const [target] = await db.select({ date: publications.date }).from(publications).where(group).limit(1);
  if (!target) return [];
  const [approved] = await db
    .select({ id: publications.id })
    .from(publications)
    .where(and(eq(publications.date, target.date), inArray(publications.status, ['approved', 'publishing', 'published'])))
    .limit(1);
  return db
    .update(publications)
    .set(approved ? { status: 'approved', approvedAt: now, updatedAt: now } : { status: 'ready', updatedAt: now })
    .where(and(group, eq(publications.status, 'skipped')))
    .returning();
}

// Instagram paylaşımları tane tane yapılır: başka bir Instagram paylaşımı sürerken sahiplenme yapılmaz.
export async function claimForPublishing(db: Db, id: string, now = new Date(), options: { exclusiveInstagram?: boolean } = {}): Promise<PublicationRow | null> {
  const leaseStart = new Date(now.getTime() - PUBLISH_LEASE_MS);
  const other = alias(publications, 'other');
  const noOtherInstagram = sql`not exists (${db
    .select({ id: other.id })
    .from(other)
    .where(and(ne(other.id, id), eq(other.status, 'publishing'), eq(other.format, 'carousel'), gte(other.updatedAt, leaseStart)))})`;
  const [row] = await db
    .update(publications)
    .set({ status: 'publishing', attempts: sql`${publications.attempts} + 1`, updatedAt: now })
    .where(
      and(
        eq(publications.id, id),
        or(eq(publications.status, 'approved'), and(eq(publications.status, 'publishing'), lt(publications.updatedAt, leaseStart))),
        options.exclusiveInstagram ? noOtherInstagram : undefined,
      ),
    )
    .returning();
  return row ?? null;
}

export async function markExpired(db: Db, id: string, error: string): Promise<void> {
  await db.update(publications).set({ status: 'expired', error, updatedAt: new Date() }).where(and(eq(publications.id, id), eq(publications.status, 'approved')));
}

// Instagram ya da TikTok medyayı işlerken satır onaya geri bırakılır; kuyruğun sonraki teslimi kayıtlı kimlikle sürer.
export async function releaseForRetry(db: Db, id: string): Promise<void> {
  await db.update(publications).set({ status: 'approved', updatedAt: new Date() }).where(eq(publications.id, id));
}

export async function markPublished(
  db: Db,
  id: string,
  result: { igContainerId?: string; igMediaId?: string | null; remoteId?: string; permalink: string | null },
  now = new Date(),
) {
  await db
    .update(publications)
    .set({ status: 'published', ...result, error: null, publishedAt: now, updatedAt: now })
    .where(eq(publications.id, id));
}

export async function markFailed(db: Db, id: string, error: string): Promise<void> {
  await db.update(publications).set({ status: 'failed', error, updatedAt: new Date() }).where(eq(publications.id, id));
}

export async function hasPlanMessage(db: Db, date: DateKey): Promise<boolean> {
  const [row] = await db
    .select({ id: publications.id })
    .from(publications)
    .where(and(eq(publications.date, date), isNotNull(publications.telegramMessageId)))
    .limit(1);
  return row !== undefined;
}

export async function setTelegramMessageId(db: Db, date: DateKey, messageId: number): Promise<void> {
  await db.update(publications).set({ telegramMessageId: messageId }).where(eq(publications.date, date));
}

// Gün bitmeden onaylanmayan paylaşımlar bir daha sorulmaz.
export async function expireUnapproved(db: Db, before: DateKey): Promise<number> {
  const rows = await db
    .update(publications)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(and(lt(publications.date, before), eq(publications.status, 'ready')))
    .returning({ id: publications.id });
  return rows.length;
}

export async function deleteMediaBefore(db: Db, before: Date): Promise<number> {
  const rows = await db.delete(mediaFiles).where(lt(mediaFiles.createdAt, before)).returning({ id: mediaFiles.id });
  return rows.length;
}

export async function getMediaFile(db: Db, id: string): Promise<{ contentType: string; data: Uint8Array } | null> {
  const [row] = await db.select({ contentType: mediaFiles.contentType, data: mediaFiles.data }).from(mediaFiles).where(eq(mediaFiles.id, id));
  return row ?? null;
}

export async function getIntegration(db: Db, id: IntegrationId): Promise<IntegrationRow | null> {
  const [row] = await db.select().from(integrations).where(eq(integrations.id, id));
  return row ?? null;
}

export async function saveIntegration(db: Db, values: Omit<IntegrationRow, 'updatedAt'>): Promise<void> {
  const now = new Date();
  await db
    .insert(integrations)
    .values({ ...values, updatedAt: now })
    .onConflictDoUpdate({ target: integrations.id, set: { ...values, updatedAt: now } });
}

// Kota kaydı kanal kimliğini veya şifreli anahtarı yeniden yazmaz.
export async function saveBufferRateLimits(db: Db, limits: readonly BufferRateLimit[]): Promise<void> {
  await db.update(integrations)
    .set({ account: sql`${integrations.account} || ${JSON.stringify({ rateLimits: limits })}::jsonb` })
    .where(eq(integrations.id, 'buffer'));
}

// Instagram container'ı ERROR/EXPIRED olduysa bir sonraki teslim sıfırdan kurar.
export async function markForRebuild(db: Db, id: string): Promise<void> {
  await db
    .update(publications)
    .set({ status: 'approved', igContainerId: null, rebuilds: sql`${publications.rebuilds} + 1`, updatedAt: new Date() })
    .where(eq(publications.id, id));
}

// Başarısız grup yeniden onaya alınır; sayaçlar ve dış kimlikler sıfırlanır, kuyruğa yeniden girer.
export async function retryFailedGroup(db: Db, input: { postId: string; format: PublicationFormat }, now = new Date()): Promise<PublicationRow[]> {
  return db
    .update(publications)
    // Yayın denemesi ve Buffer gönderisi korunur: yeniden deneme önce bunların sonucunu doğrular, kopya paylaşım açmaz.
    .set({ status: 'approved', error: null, attempts: 0, rebuilds: 0, approvedAt: now, updatedAt: now })
    .where(and(eq(publications.postId, input.postId), eq(publications.format, input.format), eq(publications.status, 'failed')))
    .returning();
}

// "Yayınla" isteğinden hemen önce yazılır: istek hata dönse ya da işlem yarıda kalsa da sonraki deneme yeniden yayınlamaz, doğrular.
export async function markPublishAttempt(db: Db, id: string, igContainerId: string, now = new Date()): Promise<void> {
  await db.update(publications).set({ igContainerId, publishAttemptedAt: now, updatedAt: now }).where(eq(publications.id, id));
}

// TikTok gönderisi Buffer'da oluşturulur oluşturulmaz kimliği yazılır; yarıda kalan deneme ikinci gönderi açmasın.
export async function setRemoteId(db: Db, id: string, remoteId: string): Promise<void> {
  await db.update(publications).set({ remoteId, publishAttemptedAt:null, updatedAt: new Date() }).where(eq(publications.id, id));
}

// Buffer isteğinin sonucu bilinmeden yeni bir oluşturma isteği açılmasını önler.
export async function markBufferSubmission(db:Db,id:string,at:Date|null):Promise<void> {
  await db.update(publications).set({publishAttemptedAt:at,updatedAt:new Date()}).where(eq(publications.id,id));
}

// Instagram carousel parçası gönderilmeden önce container kimliği yazılır; yarıda kalan deneme yeniden paylaşmasın.
export async function setContainer(db: Db, id: string, igContainerId: string): Promise<void> {
  await db.update(publications).set({ igContainerId, updatedAt: new Date() }).where(eq(publications.id, id));
}
