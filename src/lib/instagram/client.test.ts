import { describe, expect, it, vi } from 'vitest';
import { createInstagramClient, fetchInstagramAccount, InstagramError, refreshInstagramToken } from './client';

function fakeFetch(responses: { status?: number; body: unknown }[]) {
  const calls: { url: string; method: string; params: Record<string, string> }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const parsed = new URL(String(url));
    const params = Object.fromEntries(init?.body instanceof URLSearchParams ? init.body : parsed.searchParams);
    calls.push({ url: `${parsed.origin}${parsed.pathname}`, method: init?.method ?? 'GET', params });
    const next = responses.shift() ?? { body: {} };
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

describe('Instagram istemcisi', () => {
  it('carousel öğesi, carousel ve paylaşım çağrılarını doğru parametrelerle yapar', async () => {
    const { impl, calls } = fakeFetch([{ body: { id: 'i1' } }, { body: { id: 'c1' } }, { body: { id: 'm1' } }]);
    const client = createInstagramClient({ token: 'T', userId: '17', fetch: impl });
    expect(await client.createCarouselItem('https://x/a.jpg')).toBe('i1');
    expect(await client.createCarousel(['i1', 'i2'], 'Açıklama #burç')).toBe('c1');
    expect(await client.publish('c1')).toBe('m1');
    expect(calls).toEqual([
      { url: 'https://graph.instagram.com/v25.0/17/media', method: 'POST', params: { image_url: 'https://x/a.jpg', is_carousel_item: 'true', access_token: 'T' } },
      { url: 'https://graph.instagram.com/v25.0/17/media', method: 'POST', params: { media_type: 'CAROUSEL', children: 'i1,i2', caption: 'Açıklama #burç', access_token: 'T' } },
      { url: 'https://graph.instagram.com/v25.0/17/media_publish', method: 'POST', params: { creation_id: 'c1', access_token: 'T' } },
    ]);
  });

  it('Reels container açar ve durumunu okur', async () => {
    const { impl, calls } = fakeFetch([{ body: { id: 'r1' } }, { body: { status_code: 'IN_PROGRESS', id: 'r1' } }]);
    const client = createInstagramClient({ token: 'T', userId: '17', fetch: impl });
    expect(await client.createReels('https://blob/v.mp4', 'cap')).toBe('r1');
    expect(await client.containerStatus('r1')).toBe('IN_PROGRESS');
    expect(calls[0].params).toMatchObject({ media_type: 'REELS', video_url: 'https://blob/v.mp4', share_to_feed: 'true' });
    expect(calls[1]).toMatchObject({ url: 'https://graph.instagram.com/v25.0/r1', method: 'GET', params: { fields: 'status_code' } });
  });

  it('hataları geçici ve kalıcı diye ayırır', async () => {
    const client = (status: number, error: object) =>
      createInstagramClient({ token: 'T', userId: '17', fetch: fakeFetch([{ status, body: { error } }]).impl });
    const rate = await client(400, { message: 'rate', code: 4 }).publish('c').catch((error: unknown) => error);
    expect(rate).toBeInstanceOf(InstagramError);
    expect(rate).toMatchObject({ code: 4, retryable: true });
    await expect(client(400, { message: 'bad token', code: 190 }).publish('c')).rejects.toMatchObject({ code: 190, retryable: false });
    await expect(client(503, { message: 'down' }).publish('c')).rejects.toMatchObject({ retryable: true });
  });

  it('hesap bilgisini ve anahtar yenilemeyi okur', async () => {
    const account = fakeFetch([{ body: { user_id: '17841', username: 'kozmikarkan' } }]);
    expect(await fetchInstagramAccount('T', account.impl)).toEqual({ id: '17841', username: 'kozmikarkan' });
    const refresh = fakeFetch([{ body: { access_token: 'T2', token_type: 'bearer', expires_in: 5_183_944 } }]);
    expect(await refreshInstagramToken('T', refresh.impl)).toEqual({ token: 'T2', expiresInSeconds: 5_183_944 });
    expect(refresh.calls[0]).toMatchObject({ url: 'https://graph.instagram.com/refresh_access_token', params: { grant_type: 'ig_refresh_token' } });
  });
});
