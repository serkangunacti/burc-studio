import { handleStatus } from '@/lib/automation/http';
import { automationDeps } from '@/lib/automation/runtime';

export async function GET(request: Request) {
  return handleStatus(request, { ...automationDeps(), cronSecret: process.env.CRON_SECRET });
}
