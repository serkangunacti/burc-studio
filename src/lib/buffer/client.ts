// Buffer GraphQL API; TikTok paylaşımı Buffer'ın onaylı TikTok uygulaması üzerinden yapılır.
const API = 'https://api.buffer.com';

type Fetch = typeof fetch;
export type BufferRateLimit = { windowSeconds: number; limit: number; remaining: number; resetsAt: string };
type ClientOptions = {
  now?: () => Date;
  initialRateLimits?: readonly BufferRateLimit[];
  onRateLimits?: (limits: BufferRateLimit[]) => void | Promise<void>;
};

function readLimits(headers: Headers, now: Date): BufferRateLimit[] {
  const policies = new Map<string, { limit: number; windowSeconds: number }>();
  for (const entry of (headers.get('ratelimit-policy') ?? '').split(/,\s*(?=")/)) {
    const name = entry.match(/^\s*"([^"]+)"/)?.[1];
    const limit = Number(entry.match(/;\s*q=(\d+)/)?.[1]);
    const windowSeconds = Number(entry.match(/;\s*w=(\d+)/)?.[1]);
    if (name && Number.isSafeInteger(limit) && limit > 0 && Number.isSafeInteger(windowSeconds) && windowSeconds > 0) policies.set(name, { limit, windowSeconds });
  }
  const result: BufferRateLimit[] = [];
  for (const entry of (headers.get('ratelimit') ?? '').split(/,\s*(?=")/)) {
    const name = entry.match(/^\s*"([^"]+)"/)?.[1];
    const policy = name ? policies.get(name) : undefined;
    const remaining = Number(entry.match(/;\s*r=(\d+)/)?.[1]);
    const seconds = Number(entry.match(/;\s*t=(\d+)/)?.[1]);
    if (policy && Number.isSafeInteger(remaining) && remaining >= 0 && Number.isSafeInteger(seconds) && seconds >= 0 && seconds <= 31_536_000) {
      result.push({ ...policy, remaining, resetsAt: new Date(now.getTime() + seconds * 1000).toISOString() });
    }
  }
  return result;
}

function retryAfter(headers: Headers, now: Date): number | undefined {
  const value = headers.get('retry-after');
  if (!value) return undefined;
  const seconds = /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : (Date.parse(value) - now.getTime()) / 1000;
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
}

export class BufferError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly retryAfterSeconds?: number,
    readonly rateLimited = false,
    readonly outcomeUnknown = false,
  ) {
    super(message);
    this.name = 'BufferError';
  }
}

export type BufferChannel = { id: string; name: string; service: string };
export type BufferPostStatus = 'draft' | 'error' | 'needs_approval' | 'scheduled' | 'sending' | 'sent';
export type BufferPost = { id: string; status: BufferPostStatus; externalLink: string | null; error: string | null };

export type BufferClient = ReturnType<typeof createBufferClient>;

export function createBufferClient(apiKey: string, fetchImpl: Fetch = fetch, options: ClientOptions = {}) {
  const now = options.now ?? (() => new Date());
  let limits: BufferRateLimit[] = [...(options.initialRateLimits ?? [])];
  async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const blockedUntil = Math.max(0, ...limits.filter((limit) => limit.remaining === 0).map((limit) => Date.parse(limit.resetsAt)));
    if (blockedUntil > now().getTime()) throw new BufferError('Buffer API kotası yenilenene kadar bekleniyor', true, Math.ceil((blockedUntil - now().getTime()) / 1000), true);
    const response = await fetchImpl(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query, variables }),
    });
    const receivedAt = now();
    const receivedLimits = readLimits(response.headers, receivedAt);
    if (receivedLimits.length) {
      limits = receivedLimits;
      try { await options.onRateLimits?.(limits); } catch { console.error('Buffer kota bilgisi kaydedilemedi'); }
    }
    const body = (await response.json().catch(() => ({}))) as { data?: T; errors?: { message: string }[] };
    if (!response.ok || body.errors?.length || !body.data) {
      const message = body.errors?.map((error) => error.message).join('; ') || `Buffer HTTP ${response.status}`;
      const limited = response.status === 429;
      const wait = limited ? retryAfter(response.headers, receivedAt) ?? 300 : undefined;
      // GraphQL can report errors after a mutation ran, including with HTTP 200.
      const outcomeUnknown = !limited && (response.ok || response.status >= 500 || response.status === 408);
      throw new BufferError(message, limited || response.status >= 500, wait, limited, outcomeUnknown);
    }
    return body.data;
  }

  return {
    rateLimits: (): readonly BufferRateLimit[] => limits,
    tiktokChannels(): Promise<BufferChannel[]> {
      return this.channels('tiktok');
    },

    async allChannels(): Promise<BufferChannel[]> {
      const { account } = await gql<{ account: { organizations: { id: string }[] } }>('query { account { organizations { id } } }');
      const channels: BufferChannel[] = [];
      for (const organization of account.organizations) {
        const data = await gql<{ channels: { id: string; name: string; displayName: string | null; service: string }[] }>(
          'query Channels($input: ChannelsInput!) { channels(input: $input) { id name displayName service } }',
          { input: { organizationId: organization.id } },
        );
        channels.push(
          ...data.channels.map((channel) => ({ id: channel.id, name: channel.displayName ?? channel.name, service: channel.service })),
        );
      }
      return channels;
    },

    async channels(service: 'tiktok' | 'instagram' | 'youtube'): Promise<BufferChannel[]> {
      const all = await this.allChannels();
      return all.filter((channel) => {
        const s = channel.service.toLowerCase();
        if (service === 'youtube') return s.includes('youtube') || s.includes('google');
        return s === service || s.includes(service);
      });
    },

    async channel(id: string): Promise<{ id: string; name: string; isQueuePaused: boolean }> {
      const data = await gql<{ channel: { id: string; name: string; displayName: string | null; isQueuePaused: boolean } }>(
        'query Channel($input: ChannelInput!) { channel(input: $input) { id name displayName isQueuePaused } }',
        { input: { id } },
      );
      return { id: data.channel.id, name: data.channel.displayName ?? data.channel.name, isQueuePaused: data.channel.isQueuePaused };
    },

    async channelStates(ids: string[]): Promise<{ id: string; name: string; isQueuePaused: boolean }[]> {
      if (!ids.length) return [];
      const definitions = ids.map((_,i)=>`$i${i}: ChannelInput!`).join(', ');
      const fields = ids.map((_,i)=>`c${i}: channel(input: $i${i}) { id name displayName isQueuePaused }`).join(' ');
      const variables = Object.fromEntries(ids.map((id,i)=>[`i${i}`,{id}]));
      const data = await gql<Record<string,{id:string;name:string;displayName:string|null;isQueuePaused:boolean}>>(`query ChannelStates(${definitions}) { ${fields} }`,variables);
      return ids.map((_,i)=>{
        const channel=data[`c${i}`];
        if (!channel) throw new BufferError('Buffer kanal bilgisi alınamadı',false);
        return {id:channel.id,name:channel.displayName ?? channel.name,isQueuePaused:channel.isQueuePaused};
      });
    },

    // Planlama bizim kuyruğumuzda yapılır; Buffer'a paylaşım saatinde "şimdi paylaş" olarak gönderilir.
    // instagramReel: Instagram kanalında video Reels olarak (akışta da görünür) paylaşılır.
    async shareVideoNow(input: {
      channelId: string;
      text: string;
      videoUrl: string;
      instagramReel?: boolean;
      youtube?: { title: string };
      isAiGenerated?: boolean;
    }): Promise<string> {
      const data = await gql<{ createPost: { post?: { id: string }; message?: string } }>(
        `mutation CreatePost($input: CreatePostInput!) {
          createPost(input: $input) {
            ... on PostActionSuccess { post { id } }
            ... on MutationError { message }
          }
        }`,
        {
          input: {
            channelId: input.channelId,
            text: input.text,
            schedulingType: 'automatic',
            mode: 'shareNow',
            needsApproval: false,
            assets: [{ video: { url: input.videoUrl } }],
            ...(input.instagramReel
              ? { metadata: { instagram: { type: 'reel', shouldShareToFeed: true, ...(input.isAiGenerated ? { isAiGenerated: true } : {}) } } }
              : input.youtube
              ? { metadata: { youtube: { title: input.youtube.title.slice(0, 95), categoryId: '24', privacy: 'public', madeForKids: false, ...(input.isAiGenerated ? { isAiGenerated: true } : {}) } } }
              : input.isAiGenerated ? { metadata: { tiktok: { isAiGenerated: true } } } : {}),
          },
        },
      );
      if (!data.createPost.post) throw new BufferError(data.createPost.message ?? 'Buffer gönderiyi oluşturmadı', false);
      return data.createPost.post.id;
    },

    async post(id: string): Promise<BufferPost> {
      const data = await gql<{ post: { id: string; status: BufferPostStatus; externalLink: string | null; error: { message: string } | null } }>(
        'query Post($input: PostInput!) { post(input: $input) { id status externalLink error { message } } }',
        { input: { id } },
      );
      return { id: data.post.id, status: data.post.status, externalLink: data.post.externalLink, error: data.post.error?.message ?? null };
    },
  };
}
