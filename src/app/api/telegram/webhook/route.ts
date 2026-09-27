import { handleTelegramWebhook } from '@/lib/automation/http';
import { automationDeps } from '@/lib/automation/runtime';

export async function POST(request: Request) {
  return handleTelegramWebhook(request, automationDeps());
}
