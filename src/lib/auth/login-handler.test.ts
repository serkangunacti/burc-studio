import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loginAttempts } from '@/db/schema';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { handleLogin } from './login-handler';
import { hashPassword } from './password';
import { recordFailedLogin } from './rate-limit';

const T0 = new Date('2026-09-26T10:00:00Z');
let db: Db;
let hash: string;

beforeAll(async () => {
  hash = await hashPassword('dogru-sifre-1234');
});
beforeEach(async () => {
  db = await createTestDb();
  vi.stubEnv('SESSION_SECRET', 'giris-test-anahtari-'.padEnd(40, 'x'));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function loginRequest(body: unknown, ip = '203.0.113.7') {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('handleLogin', () => {
  it('doğru şifre oturum çerezi verir ve deneme sayacını temizler', async () => {
    await recordFailedLogin(db, '203.0.113.7', T0);
    const res = await handleLogin(loginRequest({ password: 'dogru-sifre-1234' }), { db, passwordHash: hash, now: T0 });
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^bs_session=[^;]+; Path=\//);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=lax');
    expect(await db.select().from(loginAttempts)).toHaveLength(0);
  });

  it('yanlış şifre 401 döner ve denemeyi kaydeder', async () => {
    const res = await handleLogin(loginRequest({ password: 'yanlis-sifre-00' }), { db, passwordHash: hash, now: T0 });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Şifre hatalı.' });
    expect(await db.select().from(loginAttempts)).toEqual([{ ip: '203.0.113.7', count: 1, windowStart: T0 }]);
  });

  it('5 hatadan sonra doğru şifre bile 429 alır', async () => {
    for (let i = 0; i < 5; i++) {
      await handleLogin(loginRequest({ password: 'yanlis-sifre-00' }), { db, passwordHash: hash, now: T0 });
    }
    const res = await handleLogin(loginRequest({ password: 'dogru-sifre-1234' }), { db, passwordHash: hash, now: T0 });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('900');
    expect(await res.json()).toEqual({ error: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar dene.' });
  });

  it('APP_PASSWORD_HASH yoksa 503 döner ve kimseyi içeri almaz', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handleLogin(loginRequest({ password: 'dogru-sifre-1234' }), { db, passwordHash: undefined, now: T0 });
    expect(res.status).toBe(503);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('bozuk gövde 400 döner', async () => {
    const res = await handleLogin(loginRequest('{bozuk'), { db, passwordHash: hash, now: T0 });
    expect(res.status).toBe(400);
  });
});
