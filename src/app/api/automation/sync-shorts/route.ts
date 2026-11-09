import { getDb } from '@/db/client';
import { isAuthorizedCronRequest } from '@/lib/cron/auth';
import { generateDailyPackage, packageItemsFor } from '@/lib/content/daily-package';
import { loadGenerationDeps } from '@/lib/content/runtime';
import { istanbulDateKey } from '@/lib/date/istanbul';
import { automationStatus, syncYouTubeShorts } from '@/lib/automation/service';
import { automationDeps } from '@/lib/automation/runtime';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const deps = automationDeps();
    if (!isAuthorizedCronRequest(request.headers, deps.automationSecret)) return Response.json({ error: 'Yetkisiz.' }, { status: 401 });
    const date = istanbulDateKey(deps.now());
    const result = await syncYouTubeShorts(deps, date);
    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get('generate') === '1') {
      const generation = await loadGenerationDeps(getDb());
      const today = istanbulDateKey();
      const generated = await generateDailyPackage(generation, {
        date: today,
        items: packageItemsFor(today, generation.settings.dailyPlan),
        trigger: 'cron',
        skipIfExists: true,
      });
      return Response.json({ ok: true, generated });
    }
    const status = await automationStatus(automationDeps());
    return Response.json({
      ok: true,
      tiktok: status.tiktok?.ok ?? false,
      instagramReels: status.instagramReels?.ok ?? false,
      youtube: status.youtube?.ok ?? false,
    });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
