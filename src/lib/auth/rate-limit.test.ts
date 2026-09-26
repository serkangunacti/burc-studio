import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { clearLoginAttempts, reserveLoginAttempt } from './rate-limit';

const T0 = new Date('2026-09-26T10:00:00Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('giriş deneme sınırı', () => {
  it('5 denemeye izin verir, 6. denemeyi kalan süreyle reddeder', async () => {
    for (let i = 0; i < 5; i++) expect(await reserveLoginAttempt(db, '1.1.1.1', at(i))).toEqual({ allowed: true });
    expect(await reserveLoginAttempt(db, '1.1.1.1', at(5))).toEqual({ allowed: false, retryAfterSeconds: 600 });
  });

  it('pencere dolunca kilit kalkar ve sayaç yeni pencerede sıfırdan başlar', async () => {
    for (let i = 0; i < 6; i++) await reserveLoginAttempt(db, '1.1.1.1', at(0));
    expect(await reserveLoginAttempt(db, '1.1.1.1', at(15))).toEqual({ allowed: true });
    for (let i = 0; i < 4; i++) expect(await reserveLoginAttempt(db, '1.1.1.1', at(16))).toEqual({ allowed: true });
    expect((await reserveLoginAttempt(db, '1.1.1.1', at(16))).allowed).toBe(false);
  });

  it('eşzamanlı denemelerde yalnızca 5 tanesine izin verir', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => reserveLoginAttempt(db, '1.1.1.1', at(0))));
    expect(results.filter((result) => result.allowed)).toHaveLength(5);
  });

  it('başarılı giriş sayacı temizler', async () => {
    for (let i = 0; i < 6; i++) await reserveLoginAttempt(db, '1.1.1.1', at(0));
    await clearLoginAttempts(db, '1.1.1.1');
    expect(await reserveLoginAttempt(db, '1.1.1.1', at(1))).toEqual({ allowed: true });
  });

  it('farklı IP adresleri birbirini etkilemez', async () => {
    for (let i = 0; i < 6; i++) await reserveLoginAttempt(db, '1.1.1.1', at(0));
    expect(await reserveLoginAttempt(db, '2.2.2.2', at(1))).toEqual({ allowed: true });
  });
});
