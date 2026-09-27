import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { isAuthorizedCronRequest } from '@/lib/cron/auth';
import { isDateKey } from '@/lib/date/istanbul';
import { isPostId } from '@/lib/posts/repository';
import { getMediaFile } from './repository';
import { telegramWebhookSecret } from './secrets';
import { handleTelegramUpdate, runMaintenance, sendDayPlan, type AutomationDeps, type TelegramUpdate } from './service';

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
