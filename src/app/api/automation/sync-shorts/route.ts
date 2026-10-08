import { isAuthorizedCronRequest } from '@/lib/cron/auth';
import { istanbulDateKey } from '@/lib/date/istanbul';
import { syncYouTubeShorts } from '@/lib/automation/service';
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

export async function GET() {
  return Response.json({ error: 'POST kullanın.' }, { status: 405 });
}
