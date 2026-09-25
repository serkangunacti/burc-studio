import { isAuthorizedCronRequest } from '@/lib/cron/auth';

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers, process.env.CRON_SECRET)) {
    return Response.json({ error: 'Yetkisiz.' }, { status: 401 });
  }
  return Response.json({ ok: true, generated: [] });
}
