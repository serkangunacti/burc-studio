import { SignJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions, verifySessionToken } from './session';

const SECRET = 'oturum-test-anahtari-'.padEnd(40, 'x');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('oturum belirteci', () => {
  it('oluşturulan belirteç doğrulanır', async () => {
    vi.stubEnv('SESSION_SECRET', SECRET);
    expect(await verifySessionToken(await createSessionToken())).toBe(true);
  });

  it('boş veya değiştirilmiş belirteç reddedilir', async () => {
    vi.stubEnv('SESSION_SECRET', SECRET);
    const token = await createSessionToken();
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken(`${token.slice(0, -2)}aa`)).toBe(false);
  });

  it('süresi dolmuş belirteç reddedilir', async () => {
    vi.stubEnv('SESSION_SECRET', SECRET);
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('owner')
      .setIssuedAt(1_700_000_000)
      .setExpirationTime(1_700_000_060)
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySessionToken(expired)).toBe(false);
  });

  it('SESSION_SECRET kısa ya da yoksa her oturum reddedilir (fail closed)', async () => {
    vi.stubEnv('SESSION_SECRET', SECRET);
    const token = await createSessionToken();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('SESSION_SECRET', 'kisa');
    expect(await verifySessionToken(token)).toBe(false);
    vi.stubEnv('SESSION_SECRET', '');
    expect(await verifySessionToken(token)).toBe(false);
    expect(logged).toHaveBeenCalled();
    await expect(createSessionToken()).rejects.toThrow('SESSION_SECRET');
  });

  it("çerez production'da secure, geliştirmede değil", () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(sessionCookieOptions()).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 2_592_000 });
    vi.stubEnv('NODE_ENV', 'development');
    expect(sessionCookieOptions().secure).toBe(false);
    expect(SESSION_COOKIE).toBe('bs_session');
  });
});
