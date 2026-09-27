import { describe, expect, it, vi } from 'vitest';
import { BufferError, createBufferClient } from './client';

function fakeFetch(responses: { status?: number; body: unknown }[]) {
  const calls: { headers: Record<string, string>; query: string; variables: Record<string, unknown> }[] = [];
  const impl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
    calls.push({ headers: init?.headers as Record<string, string>, ...payload });
    const next = responses.shift() ?? { body: {} };
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

describe('Buffer istemcisi', () => {
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
});
