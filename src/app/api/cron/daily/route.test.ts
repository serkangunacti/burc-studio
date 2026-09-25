import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

afterEach(() => vi.unstubAllEnvs());

describe('GET /api/cron/daily', () => {
  it('anahtarsız istek 401 alır', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-anahtari');
    const res = await GET(new Request('http://localhost/api/cron/daily'));
    expect(res.status).toBe(401);
  });

  it('doğru anahtarla 200 döner', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-anahtari');
    const res = await GET(new Request('http://localhost/api/cron/daily', { headers: { authorization: 'Bearer cron-anahtari' } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, generated: [] });
  });
});
