import { describe, expect, it, vi } from 'vitest';
import { BufferError, createBufferClient } from './client';

function fakeFetch(responses: { status?: number; body: unknown; headers?: Record<string, string> }[]) {
  const calls: { headers: Record<string, string>; query: string; variables: Record<string, unknown> }[] = [];
  const impl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
    calls.push({ headers: init?.headers as Record<string, string>, ...payload });
    const next = responses.shift() ?? { body: {} };
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200, headers: next.headers });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

describe('Buffer istemcisi', () => {
  it('iki platformun kanal durumunu tek istekte okur', async () => {
    const {impl,calls}=fakeFetch([{body:{data:{c0:{id:'tt',name:'TikTok',displayName:null,isQueuePaused:false},c1:{id:'ig',name:'Instagram',displayName:null,isQueuePaused:true}}}}]);
    expect(await createBufferClient('KEY',impl).channelStates(['tt','ig'])).toEqual([
      {id:'tt',name:'TikTok',isQueuePaused:false}, {id:'ig',name:'Instagram',isQueuePaused:true},
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].variables).toEqual({i0:{id:'tt'},i1:{id:'ig'}});
  });
  it('tüm organizasyonlardaki TikTok kanallarını bulur', async () => {
    const { impl, calls } = fakeFetch([
      { body: { data: { account: { organizations: [{ id: 'org1' }] } } } },
      {
        body: {
          data: {
            channels: [
              { id: 'c1', name: 'kozmikarkan', displayName: null, service: 'tiktok' },
              { id: 'c2', name: 'kozmik', displayName: 'Kozmik', service: 'instagram' },
            ],
          },
        },
      },
    ]);
    expect(await createBufferClient('KEY', impl).tiktokChannels()).toEqual([{ id: 'c1', name: 'kozmikarkan', service: 'tiktok' }]);
    expect(calls[0].headers.authorization).toBe('Bearer KEY');
    expect(calls[1].variables).toEqual({ input: { organizationId: 'org1' } });
  });

  it('videoyu hemen paylaşılacak otomatik gönderi olarak oluşturur', async () => {
    const { impl, calls } = fakeFetch([{ body: { data: { createPost: { post: { id: 'p1' } } } } }]);
    expect(await createBufferClient('KEY', impl).shareVideoNow({ channelId: 'c1', text: 'Açıklama #burç', videoUrl: 'https://blob/v.mp4' })).toBe('p1');
    expect(calls[0].query).toContain('createPost(input: $input)');
    expect(calls[0].variables).toEqual({
      input: {
        channelId: 'c1',
        text: 'Açıklama #burç',
        schedulingType: 'automatic',
        mode: 'shareNow',
        needsApproval: false,
        assets: [{ video: { url: 'https://blob/v.mp4' } }],
      },
    });
  });

  it('YouTube Shorts için başlık ve ayarları içeren gönderi oluşturur', async () => {
    const { impl, calls } = fakeFetch([{ body: { data: { createPost: { post: { id: 'p2' } } } } }]);
    expect(
      await createBufferClient('KEY', impl).shareVideoNow({
        channelId: 'yt1',
        text: 'Açıklama',
        videoUrl: 'https://blob/v.mp4',
        youtube: { title: 'Koç Burcu Günlük Yorumu #Shorts' },
      })
    ).toBe('p2');
    expect((calls[0].variables.input as any).metadata).toEqual({
      youtube: { title: 'Koç Burcu Günlük Yorumu #Shorts', categoryId: '24', privacy: 'public', madeForKids: false },
    });
  });

  it('gönderi durumunu ve bağlantısını okur', async () => {
    const { impl } = fakeFetch([{ body: { data: { post: { id: 'p1', status: 'sent', externalLink: 'https://www.tiktok.com/@kozmikarkan/video/1', error: null } } } }]);
    expect(await createBufferClient('KEY', impl).post('p1')).toEqual({
      id: 'p1',
      status: 'sent',
      externalLink: 'https://www.tiktok.com/@kozmikarkan/video/1',
      error: null,
    });
  });

  it('hataları geçici ve kalıcı diye ayırır', async () => {
    const mutationError = fakeFetch([{ body: { data: { createPost: { message: 'Video çok uzun' } } } }]);
    await expect(createBufferClient('KEY', mutationError.impl).shareVideoNow({ channelId: 'c', text: 't', videoUrl: 'u' })).rejects.toMatchObject({
      message: 'Video çok uzun',
      retryable: false,
    });
    const limited = fakeFetch([{ status: 429, body: { errors: [{ message: 'Too many requests' }] } }]);
    const error = await createBufferClient('KEY', limited.impl).post('p').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BufferError);
    expect(error).toMatchObject({ retryable: true });
    const unauthorized = fakeFetch([{ status: 401, body: { errors: [{ message: 'Unauthorized' }] } }]);
    await expect(createBufferClient('KEY', unauthorized.impl).tiktokChannels()).rejects.toMatchObject({ retryable: false });
  });

  it('kota bilgisini mevcut yanıttan kaydeder; ek sorgu açmaz', async () => {
    const { impl, calls } = fakeFetch([{ body: { data: { post: { id: 'p1', status: 'sending', externalLink: null, error: null } } }, headers: {
      RateLimit: '"monthly"; r=2980; t=600',
      'RateLimit-Policy': '"monthly"; q=3000; w=2592000; pk=:bucket:',
    } }]);
    let saved: unknown = null;
    const client = createBufferClient('KEY', impl, { now: () => new Date('2026-10-03T12:00:00Z'), onRateLimits: (limits) => { saved = limits; } });
    expect((await client.post('p1')).status).toBe('sending');
    expect(saved).toEqual([{ windowSeconds: 2592000, limit: 3000, remaining: 2980, resetsAt: '2026-10-03T12:10:00.000Z' }]);
    expect(calls).toHaveLength(1);
  });

  it('429 yanıtındaki Retry-After süresini korur', async () => {
    const { impl } = fakeFetch([{ status: 429, body: { errors: [{ message: 'Too many requests' }] }, headers: { 'Retry-After': '900' } }]);
    await expect(createBufferClient('KEY', impl).post('p1')).rejects.toMatchObject({ retryable: true, rateLimited: true, retryAfterSeconds: 900 });
  });

  it('Retry-After tarihini saniyeye çevirir', async () => {
    const { impl } = fakeFetch([{ status: 429, body: {}, headers: { 'Retry-After': 'Sat, 03 Oct 2026 12:15:00 GMT' } }]);
    await expect(createBufferClient('KEY', impl, { now: () => new Date('2026-10-03T12:00:00Z') }).post('p1')).rejects.toMatchObject({ retryAfterSeconds: 900 });
  });

  it('tükenmiş ve henüz yenilenmemiş kotada yeni HTTP isteği yapmaz', async () => {
    const { impl, calls } = fakeFetch([{ body: { data: { post: { id: 'p1', status: 'sent', externalLink: null, error: null } } } }]);
    const client = createBufferClient('KEY', impl, { now: () => new Date('2026-10-03T12:00:00Z'), initialRateLimits: [{ windowSeconds: 900, limit: 100, remaining: 0, resetsAt: '2026-10-03T12:10:00Z' }] });
    await expect(client.post('p1')).rejects.toMatchObject({ rateLimited: true, retryAfterSeconds: 600 });
    expect(calls).toHaveLength(0);
  });

  it('kota kaydı başarısız olsa da oluşturulmuş gönderinin kimliğini kaybetmez', async () => {
    const { impl, calls } = fakeFetch([{ body: { data: { createPost: { post: { id: 'p1' } } } }, headers: { RateLimit: '"day";r=20;t=60', 'RateLimit-Policy': '"day";q=250;w=86400' } }]);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await createBufferClient('KEY', impl, { onRateLimits: () => { throw new Error('DB offline'); } }).shareVideoNow({ channelId: 'c1', text: 't', videoUrl: 'u' })).toBe('p1');
      expect(calls).toHaveLength(1);
    } finally { log.mockRestore(); }
  });

  it.each([false, true])('klonlanmış konuşmayı platformun AI bildirim alanına gönderir (Instagram=%s)', async (instagramReel) => {
    const { impl, calls } = fakeFetch([{ body: { data: { createPost: { post: { id: 'p1' } } } } }]);
    await createBufferClient('KEY', impl).shareVideoNow({ channelId: 'c1', text: 't', videoUrl: 'u', instagramReel, isAiGenerated: true });
    const input = calls[0].variables.input as { metadata: unknown };
    expect(input.metadata).toEqual(instagramReel ? { instagram: { type: 'reel', shouldShareToFeed: true, isAiGenerated: true } } : { tiktok: { isAiGenerated: true } });
  });
});
