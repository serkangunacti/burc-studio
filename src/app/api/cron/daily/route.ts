import { getDb } from '@/db/client';
import { loadGenerationDeps } from '@/lib/content/runtime';
import { handleDailyCron } from '@/lib/cron/daily';
import { istanbulDateKey } from '@/lib/date/istanbul';

export const maxDuration = 300;

export async function GET(request: Request) {
  return handleDailyCron(request, {
    secret: process.env.CRON_SECRET,
    today: istanbulDateKey(),
    loadDeps: () => loadGenerationDeps(getDb()),
  });
}
