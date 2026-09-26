import { getDb } from '@/db/client';
import { handleGenerate } from '@/lib/content/http';
import { loadGenerationDeps } from '@/lib/content/runtime';
import { istanbulDateKey } from '@/lib/date/istanbul';

export const maxDuration = 300;

export async function POST(request: Request) {
  return handleGenerate(request, { ...(await loadGenerationDeps(getDb())), today: istanbulDateKey() });
}
