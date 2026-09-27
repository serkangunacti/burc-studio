import { handleMaintenanceCron } from '@/lib/automation/http';
import { automationDeps } from '@/lib/automation/runtime';

export async function GET(request: Request) {
  return handleMaintenanceCron(request, { ...automationDeps(), cronSecret: process.env.CRON_SECRET });
}
