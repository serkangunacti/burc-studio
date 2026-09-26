import { getDb } from '@/db/client';
import { handleRegenerateSign } from '@/lib/content/http';
import { loadGenerationDeps } from '@/lib/content/runtime';
import { istanbulDateKey } from '@/lib/date/istanbul';

export const maxDuration = 300;

export async function POST(request: Request) {
  return handleRegenerateSign(request, { ...(await loadGenerationDeps(getDb())), today: istanbulDateKey() });
}
