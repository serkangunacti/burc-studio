import { NextRequest } from 'next/server';
import { getRedirectUrl, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionToken } from '@/lib/auth/session';
import { config, proxy } from './proxy';

beforeEach(() => vi.stubEnv('SESSION_SECRET', 'proxy-test-anahtari-'.padEnd(40, 'x')));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function request(path: string, token?: string) {
  return new NextRequest(`http://localhost${path}`, token ? { headers: { cookie: `bs_session=${token}` } } : undefined);
}

describe('proxy matcher', () => {
  it.each([
    ['/_next/static/chunks/app.js', false],
    ['/_next/image', false],
    ['/robots.txt', false],
    ['/favicon.ico', false],
    ['/icon.svg', false],
    ['/', true],
    ['/ayarlar', true],
    ['/api/cron/daily', true],
  ])('%s → %s', (url, expected) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(expected);
  });
});

describe('proxy', () => {
  it('girişsiz sayfa isteğini next parametresiyle giriş sayfasına yönlendirir', async () => {
    expect(getRedirectUrl(await proxy(request('/ayarlar?sekme=1')))).toBe(
      'http://localhost/giris?next=%2Fayarlar%3Fsekme%3D1',
    );
  });

  it('kök sayfada next parametresi eklemez', async () => {
    expect(getRedirectUrl(await proxy(request('/')))).toBe('http://localhost/giris');
  });

  it('girişsiz API isteğine 401 JSON döner', async () => {
    const res = await proxy(request('/api/generate'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Oturum gerekli.' });
  });

  it.each(['/giris', '/api/auth/login', '/api/cron/daily'])('%s herkese açıktır', async (path) => {
    expect((await proxy(request(path))).headers.get('x-middleware-next')).toBe('1');
  });

  it('geçerli oturumla geçer, bozuk oturum yönlendirilir', async () => {
    const token = await createSessionToken();
    expect((await proxy(request('/ayarlar', token))).headers.get('x-middleware-next')).toBe('1');
    expect(getRedirectUrl(await proxy(request('/ayarlar', 'bozuk')))).toBe('http://localhost/giris?next=%2Fayarlar');
  });

  it('SESSION_SECRET kaybolursa mevcut oturum da reddedilir', async () => {
    const token = await createSessionToken();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('SESSION_SECRET', '');
    expect(getRedirectUrl(await proxy(request('/ayarlar', token)))).toBe('http://localhost/giris?next=%2Fayarlar');
  });
});
