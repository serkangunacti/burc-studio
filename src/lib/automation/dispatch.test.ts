import { describe, expect, it, vi } from 'vitest';
import { checkRecentRenderFailure, dispatchRenderWorkflow } from './dispatch';

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

  it('tetikleme sonrası kota/ödeme nedeniyle başlatılmayan işi yakalar ve açıklamasını döndürür', async () => {
    const since = new Date('2026-10-18T02:11:30Z');
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/runs?per_page=3')) {
        return Response.json({
          workflow_runs: [{ id: 39089205951, status: 'completed', conclusion: 'failure', created_at: '2026-10-18T02:11:32Z' }],
        });
      }
      if (url.includes('/runs/39089205951/jobs')) {
        return Response.json({ jobs: [{ id: 117562100203, conclusion: 'failure' }] });
      }
      if (url.includes('/check-runs/117562100203/annotations')) {
        return Response.json([
          {
            message:
              "The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings",
          },
        ]);
      }
      return new Response(null, { status: 404 });
    });

    const reason = await checkRecentRenderFailure({
      token: 'T',
      repository: 'o/r',
      since,
      fetch: fetchImpl as unknown as typeof fetch,
    });
    expect(reason).toContain('GitHub Actions işi başlatılamadı (Run #39089205951)');
    expect(reason).toContain('spending limit needs to be increased');
  });
});
