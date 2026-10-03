import { handleCallback } from '@vercel/queue';
import { automationDeps } from '@/lib/automation/runtime';
import { publishPublication, RetryLater } from '@/lib/automation/service';

export const maxDuration = 300;

// The SDK also accepts event wrappers; Next.js route handlers receive Request.
export const POST: (request: Request) => Promise<Response> = handleCallback(
  async (message: { publicationId: string }) => {
    await publishPublication(automationDeps(), message.publicationId);
  },
  { retry: (error) => (error instanceof RetryLater ? { afterSeconds: error.afterSeconds } : undefined) },
);
