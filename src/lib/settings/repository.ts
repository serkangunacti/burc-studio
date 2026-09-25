import { eq } from 'drizzle-orm';
import { settings } from '@/db/schema';
import type { Db } from '@/db/types';
import { mergeSettings, parseStoredSettings, type Settings, type SettingsPatch } from './schema';

export async function getSettings(db: Db): Promise<Settings> {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  return parseStoredSettings(row?.data);
}

export async function saveSettings(db: Db, patch: SettingsPatch): Promise<Settings> {
  const next = mergeSettings(await getSettings(db), patch);
  const now = new Date();
  await db
    .insert(settings)
    .values({ id: 1, data: next, updatedAt: now })
    .onConflictDoUpdate({ target: settings.id, set: { data: next, updatedAt: now } });
  return next;
}
