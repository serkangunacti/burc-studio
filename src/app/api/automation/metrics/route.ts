import { getDb } from '@/db/client';
import { requireSession } from '@/lib/auth/require-session';
import { metricsCsv } from '@/lib/automation/metrics';
import { listPublications } from '@/lib/automation/repository';
import { isDateKey, istanbulDateKey } from '@/lib/date/istanbul';

export async function GET(request: Request) {
  try { await requireSession(); }
  catch { return Response.json({error: 'Oturum gerekli'}, {status: 401}); }
  const date = new URL(request.url).searchParams.get('tarih') ?? istanbulDateKey();
  if (!isDateKey(date)) return Response.json({error: 'Geçerli bir tarih gerekli'}, {status: 400});
  const rows = await listPublications(getDb(), date);
  return new Response(metricsCsv(rows), {headers: {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="kozmikarkan-${date}.csv"`,
    'cache-control': 'private, no-store',
  }});
}
