import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { getSettings, saveSettings } from './repository';
import { DEFAULT_SETTINGS } from './schema';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('ayar deposu', () => {
  it('kayıt yokken varsayılanları döner', async () => {
    expect(await getSettings(db)).toEqual(DEFAULT_SETTINGS);
  });

  it('kaydedilen ayarlar geri okunur ve kısmi yamalar birikir', async () => {
    await saveSettings(db, { instagramHandle: 'burc.studio' });
    await saveSettings(db, { watermark: { opacity: 0.8 } });
    expect(await getSettings(db)).toEqual({
      ...DEFAULT_SETTINGS,
      instagramHandle: 'burc.studio',
      watermark: { enabled: true, position: 'bottom-center', opacity: 0.8 },
    });
  });

  it('geçersiz yama hiçbir şey kaydetmez', async () => {
    await expect(saveSettings(db, { instagramHandle: 'foo bar' })).rejects.toThrow();
    expect(await getSettings(db)).toEqual(DEFAULT_SETTINGS);
  });
});
