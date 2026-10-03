import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), list: vi.fn() }));
vi.mock('@/lib/auth/require-session', () => ({requireSession: mocks.authorize}));
vi.mock('@/db/client', () => ({getDb: () => ({})}));
vi.mock('@/lib/automation/repository', () => ({listPublications: mocks.list}));
import { GET } from './route';

beforeEach(() => { vi.resetAllMocks(); mocks.authorize.mockResolvedValue(undefined); mocks.list.mockResolvedValue([]); });

describe('ölçüm CSV indirme yetkisi', () => {
  it('oturumsuz istekte yayın kayıtlarını okumaz', async () => {
    mocks.authorize.mockRejectedValue(new Error('Oturum gerekli'));
    expect((await GET(new Request('https://app/api/automation/metrics?tarih=2026-10-05'))).status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('geçersiz tarihi reddeder; geçerli tarihte özel CSV indirir', async () => {
    expect((await GET(new Request('https://app/api/automation/metrics?tarih=2026-02-31'))).status).toBe(400);
    const response = await GET(new Request('https://app/api/automation/metrics?tarih=2026-10-05'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toContain('kozmikarkan-2026-10-05.csv');
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });
});
