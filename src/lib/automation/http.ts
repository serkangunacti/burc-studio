import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { isAuthorizedCronRequest } from '@/lib/cron/auth';
import { isDateKey } from '@/lib/date/istanbul';
import { isPostId } from '@/lib/posts/repository';
import { getMediaFile } from './repository';
import { telegramWebhookSecret } from './secrets';
import { automationStatus, bufferPostStatus, instagramRecentMedia, diagnoseCarousel, handleTelegramUpdate, publishDayNow, publishDueNow, requeueDay, runMaintenance, sendDayPlan, type AutomationDeps, type TelegramUpdate } from './service';

const readySchema = z.object({ date: z.string().refine(isDateKey), failures: z.array(z.string()).max(50).default([]) });

// Render işçisi (GitHub Actions) günü hazırlayınca çağırır.
export async function handleReady(request: Request, deps: AutomationDeps): Promise<Response> {
  if (!isAuthorizedCronRequest(request.headers, deps.automationSecret)) return Response.json({ error: 'Yetkisiz.' }, { status: 401 });
  const parsed = readySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Geçersiz istek.' }, { status: 400 });
  const result = await sendDayPlan(deps, parsed.data.date, parsed.data.failures);
  return Response.json(result, { status: result.sent ? 200 : 409 });
}

function sameSecret(received: string | null, expected: string): boolean {
  const a = Buffer.from(received ?? '');
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Telegram 200 dışındaki yanıtlarda güncellemeyi tekrar tekrar gönderir; işlem hatası günlüğe yazılıp 200 dönülür.
export async function handleTelegramWebhook(request: Request, deps: AutomationDeps): Promise<Response> {
  if (!deps.automationSecret || !sameSecret(request.headers.get('x-telegram-bot-api-secret-token'), telegramWebhookSecret(deps.automationSecret))) {
    return Response.json({ error: 'Yetkisiz.' }, { status: 401 });
  }
  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  if (update) {
    try {
      await handleTelegramUpdate(deps, update);
    } catch (error) {
      console.error('Telegram güncellemesi işlenemedi', error);
    }
  }
  return Response.json({ ok: true });
}

export async function handleMedia(id: string, deps: Pick<AutomationDeps, 'db'>): Promise<Response> {
  const file = isPostId(id) ? await getMediaFile(deps.db, id) : null;
  if (!file) return new Response('Bulunamadı', { status: 404 });
  return new Response(Buffer.from(file.data), {
    headers: { 'content-type': file.contentType, 'cache-control': 'public, max-age=86400, immutable', 'x-robots-tag': 'noindex' },
  });
}

export async function handleMaintenanceCron(request: Request, deps: AutomationDeps & { cronSecret: string | undefined }): Promise<Response> {
  if (!isAuthorizedCronRequest(request.headers, deps.cronSecret)) return Response.json({ error: 'Yetkisiz.' }, { status: 401 });
  return Response.json({ ok: true, ...(await runMaintenance(deps)) });
}

// Salt okunur tanı: bağlantılar, webhook ve Instagram paylaşım izni.
export async function handleStatus(request: Request, deps: AutomationDeps & { cronSecret: string | undefined }): Promise<Response> {
  if (!isAuthorizedCronRequest(request.headers, deps.cronSecret)) return Response.json({ error: 'Yetkisiz.' }, { status: 401 });
  return Response.json(await automationStatus(deps));
}

export async function handleRequeue(request: Request, deps: AutomationDeps): Promise<Response> {
  if (!isAuthorizedCronRequest(request.headers, deps.automationSecret)) return Response.json({ error: 'Yetkisiz.' }, { status: 401 });
  const parsed = z.object({ date: z.string().refine(isDateKey) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Geçersiz istek.' }, { status: 400 });
  return Response.json(await requeueDay(deps, parsed.data.date));
}

export async function handlePublishNow(request: Request, deps: AutomationDeps): Promise<Response> {
  if (!isAuthorizedCronRequest(request.headers, deps.automationSecret)) return Response.json({ error: 'Yetkisiz.' }, { status: 401 });
  const parsed = z.object({ date: z.string().refine(isDateKey), limit: z.number().int().min(1).max(5).default(2) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Geçersiz istek.' }, { status: 400 });
  return Response.json(await publishDayNow(deps, parsed.data.date));
}

export async function handleDiagnoseCarousel(request: Request, deps: AutomationDeps): Promise<Response> {
  if (!isAuthorizedCronRequest(request.headers, deps.automationSecret)) return Response.json({ error: 'Yetkisiz.' }, { status: 401 });
  const parsed = z
    .object({ publicationId: z.string().uuid(), variants: z.array(z.array(z.number().int().min(0).max(9)).min(2).max(10)).min(1).max(4) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Geçersiz istek.' }, { status: 400 });
  try {
    return Response.json(await diagnoseCarousel(deps, parsed.data.publicationId, parsed.data.variants));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function handleBufferPost(request: Request, deps: AutomationDeps): Promise<Response> {
  if (!isAuthorizedCronRequest(request.headers, deps.automationSecret)) return Response.json({ error: 'Yetkisiz.' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !/^[a-f0-9]{24}$/.test(id)) return Response.json({ error: 'Geçersiz istek.' }, { status: 400 });
  try {
    return Response.json(await bufferPostStatus(deps, id));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function handleInstagramMedia(request: Request, deps: AutomationDeps): Promise<Response> {
  if (!isAuthorizedCronRequest(request.headers, deps.automationSecret)) return Response.json({ error: 'Yetkisiz.' }, { status: 401 });
  try {
    return Response.json(await instagramRecentMedia(deps, 50));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
