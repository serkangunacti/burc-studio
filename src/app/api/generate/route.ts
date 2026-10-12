import { timingSafeEqual } from 'node:crypto';
import { getDb } from '@/db/client';
import { requireSession } from '@/lib/auth/require-session';
import { handleGenerate } from '@/lib/content/http';
import { loadGenerationDeps } from '@/lib/content/runtime';
import { istanbulDateKey } from '@/lib/date/istanbul';

export const maxDuration = 300;

function isAuthorizedSecret(request: Request): boolean {
  const secret = process.env.AUTOMATION_SECRET;
  if (!secret) return false;
  const received = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function POST(request: Request) {
  if (!isAuthorizedSecret(request)) {
    try {
      await requireSession();
    } catch {
      return Response.json({ error: 'Oturum gerekli.' }, { status: 401 });
    }
  }
  return handleGenerate(request, { ...(await loadGenerationDeps(getDb())), today: istanbulDateKey() });
}
