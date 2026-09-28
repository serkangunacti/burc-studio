import { handleRequeue } from '@/lib/automation/http';
import { automationDeps } from '@/lib/automation/runtime';

export async function POST(request: Request) {
  return handleRequeue(request, automationDeps());
}
