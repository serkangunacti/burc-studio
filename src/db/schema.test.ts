import { describe, expect, it } from 'vitest';
import { settings } from '@/db/schema';
import { createTestDb } from '@/test/db';

describe('veritabanı şeması', () => {
  it('ayarlar tablosu yalnızca id=1 satırını kabul eder', async () => {
    const db = await createTestDb();
    await db.insert(settings).values({ id: 1, data: {} });
    await expect(db.insert(settings).values({ id: 2, data: {} })).rejects.toThrow();
  });
});
