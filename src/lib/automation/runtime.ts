import { del, list } from '@vercel/blob';
import { send } from '@vercel/queue';
import { getDb } from '@/db/client';
import type { AutomationDeps } from './service';

export const PUBLISH_TOPIC = 'instagram-publish';

export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return production ? `https://${production}` : 'http://localhost:3000';
}

async function deleteVideosBefore(before: Date): Promise<number> {
  try {
    let deleted = 0;
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: 'reels/', cursor, limit: 1000 });
      const old = page.blobs.filter((blob) => blob.uploadedAt < before).map((blob) => blob.url);
      if (old.length > 0) await del(old);
      deleted += old.length;
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return deleted;
  } catch {
    return 0;
  }
}

export function automationDeps(): AutomationDeps {
  return {
    db: getDb(),
    appUrl: appUrl(),
    repository: process.env.GITHUB_REPOSITORY ?? 'serkangunacti/burc-studio',
    integrationsKey: process.env.INTEGRATIONS_KEY,
    automationSecret: process.env.AUTOMATION_SECRET,
    now: () => new Date(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    fetch,
    enqueue: async (publicationId, options) => {
      await send(PUBLISH_TOPIC, { publicationId }, options);
    },
    deleteVideosBefore,
  };
}
