import { handleBufferPost } from '@/lib/automation/http';
import { automationDeps } from '@/lib/automation/runtime';

export async function GET(request: Request) {
  return handleBufferPost(request, automationDeps());
}
