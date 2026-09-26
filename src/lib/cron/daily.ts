import { generateDailyPackage } from '@/lib/content/daily-package';
import type { GenerationDeps } from '@/lib/content/horoscope-service';
import type { DateKey } from '@/lib/date/istanbul';
import type { Settings } from '@/lib/settings/schema';
import { isAuthorizedCronRequest } from './auth';

export async function handleDailyCron(
  request: Request,
  deps: { secret: string | undefined; today: DateKey; loadDeps: () => Promise<GenerationDeps & { settings: Settings }> },
): Promise<Response> {
  if (!isAuthorizedCronRequest(request.headers, deps.secret)) return Response.json({ error: 'Yetkisiz.' }, { status: 401 });
  const generation = await deps.loadDeps();
  if (!generation.settings.cronEnabled) return Response.json({ ok: true, skipped: 'Otomatik üretim kapalı.', generated: [] });
  const generated = await generateDailyPackage(generation, {
    date: deps.today,
    items: generation.settings.dailyPlan,
    trigger: 'cron',
    skipIfExists: true,
  });
  return Response.json({ ok: generated.every((entry) => 'result' in entry), generated });
}
