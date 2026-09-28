import { describe, expect, it, vi } from 'vitest';
import { dispatchRenderWorkflow } from './dispatch';

describe('hazırlık tetikleyicisi', () => {
  it('günün tarihiyle iş akışını main dalında başlatır', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const result = await dispatchRenderWorkflow({ token: 'T', repository: 'o/r', date: '2026-09-29', fetch: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({ dispatched: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/o/r/actions/workflows/render-publications.yml/dispatches');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer T');
    expect(JSON.parse(String(init.body))).toEqual({ ref: 'main', inputs: { date: '2026-09-29' } });
  });

  it('anahtar yoksa ya da GitHub reddederse nedenini döndürür', async () => {
    expect(await dispatchRenderWorkflow({ token: undefined, repository: 'o/r', date: '2026-09-29' })).toEqual({ dispatched: false, reason: 'GitHub anahtarı bağlı değil' });
    const denied = vi.fn(async () => new Response('Resource not accessible', { status: 403 }));
    expect(await dispatchRenderWorkflow({ token: 'T', repository: 'o/r', date: '2026-09-29', fetch: denied as unknown as typeof fetch })).toEqual({
      dispatched: false,
      reason: 'GitHub 403: Resource not accessible',
    });
  });
});
