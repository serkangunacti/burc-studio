import { getDb } from '@/db/client';
import { automationDeps } from '@/lib/automation/runtime';
import { startRender } from '@/lib/automation/service';
import { loadGenerationDeps } from '@/lib/content/runtime';
import { handleDailyCron } from '@/lib/cron/daily';
import { istanbulDateKey } from '@/lib/date/istanbul';

export const maxDuration = 300;

export async function GET(request: Request) {
  return handleDailyCron(request, {
    secret: [process.env.CRON_SECRET, process.env.AUTOMATION_SECRET],
    today: istanbulDateKey(),
    loadDeps: () => loadGenerationDeps(getDb()),
    startRender: (date) => startRender(automationDeps(), date),
  });
}
