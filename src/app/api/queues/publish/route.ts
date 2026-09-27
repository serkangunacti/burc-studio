import { handleCallback } from '@vercel/queue';
import { automationDeps } from '@/lib/automation/runtime';
import { publishPublication, RetryLater } from '@/lib/automation/service';

export const maxDuration = 120;

export const POST = handleCallback(
  async (message: { publicationId: string }) => {
    await publishPublication(automationDeps(), message.publicationId);
  },
  { retry: (error) => (error instanceof RetryLater ? { afterSeconds: error.afterSeconds } : undefined) },
);
