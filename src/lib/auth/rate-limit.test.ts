import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { checkLoginAllowed, clearLoginAttempts, recordFailedLogin } from './rate-limit';

const T0 = new Date('2026-09-26T10:00:00Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('giriş deneme sınırı', () => {
  it('4 hataya kadar izin verir, 5. hatadan sonra kalan süreyle kilitler', async () => {
    for (let i = 0; i < 4; i++) await recordFailedLogin(db, '1.1.1.1', at(i));
    expect(await checkLoginAllowed(db, '1.1.1.1', at(4))).toEqual({ allowed: true });
    await recordFailedLogin(db, '1.1.1.1', at(4));
    expect(await checkLoginAllowed(db, '1.1.1.1', at(5))).toEqual({ allowed: false, retryAfterSeconds: 600 });
  });

  it('pencere dolunca kilit kalkar ve sayaç yeni pencerede sıfırdan başlar', async () => {
    for (let i = 0; i < 5; i++) await recordFailedLogin(db, '1.1.1.1', at(0));
    expect(await checkLoginAllowed(db, '1.1.1.1', at(15))).toEqual({ allowed: true });
    for (let i = 0; i < 4; i++) await recordFailedLogin(db, '1.1.1.1', at(16));
    expect(await checkLoginAllowed(db, '1.1.1.1', at(17))).toEqual({ allowed: true });
  });

  it('başarılı giriş sayacı temizler', async () => {
    for (let i = 0; i < 5; i++) await recordFailedLogin(db, '1.1.1.1', at(0));
    await clearLoginAttempts(db, '1.1.1.1');
    expect(await checkLoginAllowed(db, '1.1.1.1', at(1))).toEqual({ allowed: true });
  });

  it('farklı IP adresleri birbirini etkilemez', async () => {
    for (let i = 0; i < 5; i++) await recordFailedLogin(db, '1.1.1.1', at(0));
    expect(await checkLoginAllowed(db, '2.2.2.2', at(1))).toEqual({ allowed: true });
  });
});
