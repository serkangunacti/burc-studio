import { getDb } from '@/db/client';
import { requireSession } from '@/lib/auth/require-session';
import { handleGenerate } from '@/lib/content/http';
import { loadGenerationDeps } from '@/lib/content/runtime';
import { istanbulDateKey } from '@/lib/date/istanbul';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    await requireSession();
  } catch {
    return Response.json({ error: 'Oturum gerekli.' }, { status: 401 });
  }
  return handleGenerate(request, { ...(await loadGenerationDeps(getDb())), today: istanbulDateKey() });
}
