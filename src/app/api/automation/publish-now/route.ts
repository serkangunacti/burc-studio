import { handlePublishNow } from '@/lib/automation/http';
import { automationDeps } from '@/lib/automation/runtime';

export const maxDuration = 300;

export async function POST(request: Request) {
  return handlePublishNow(request, automationDeps());
}
