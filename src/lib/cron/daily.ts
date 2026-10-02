import { generateDailyPackage, packageItemsFor } from '@/lib/content/daily-package';
import type { GenerationDeps } from '@/lib/content/horoscope-service';
import type { DateKey } from '@/lib/date/istanbul';
import type { Settings } from '@/lib/settings/schema';
import { isAuthorizedCronRequest } from './auth';
import { automationStartReason } from '@/lib/automation/start';

export async function handleDailyCron(
  request: Request,
  deps: {
    secret: string | undefined;
    today: DateKey;
    now?: () => Date;
    loadDeps: () => Promise<GenerationDeps & { settings: Settings }>;
    // Üretim bitince görsel hazırlığını başlatır; hata üretimin sonucunu bozmaz.
    startRender?: (date: DateKey) => Promise<{ dispatched: boolean; reason?: string }>;
  },
): Promise<Response> {
  if (!isAuthorizedCronRequest(request.headers, deps.secret)) return Response.json({ error: 'Yetkisiz.' }, { status: 401 });
  const generation = await deps.loadDeps();
  if (!generation.settings.cronEnabled) return Response.json({ ok: true, skipped: 'Otomatik üretim kapalı.', generated: [] });
  const paused = automationStartReason(generation.settings.automation.startDate, deps.today, deps.now?.());
  if (paused) return Response.json({ ok: true, skipped: paused, generated: [] });
  const generated = await generateDailyPackage(generation, {
    date: deps.today,
    items: packageItemsFor(deps.today, generation.settings.dailyPlan),
    trigger: 'cron',
    skipIfExists: true,
  });
  const render = generation.settings.automation.enabled && deps.startRender
    ? await deps.startRender(deps.today).catch((error: unknown) => ({ dispatched: false, reason: error instanceof Error ? error.message : String(error) }))
    : undefined;
  if (render && !render.dispatched) console.error('Görsel hazırlığı başlatılamadı', render.reason);
  return Response.json({ ok: generated.every((entry) => 'result' in entry), generated, render });
}
