// Buffer GraphQL API; TikTok paylaşımı Buffer'ın onaylı TikTok uygulaması üzerinden yapılır.
const API = 'https://api.buffer.com';

type Fetch = typeof fetch;

export class BufferError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'BufferError';
  }
}

export type BufferChannel = { id: string; name: string; service: string };
export type BufferPostStatus = 'draft' | 'error' | 'needs_approval' | 'scheduled' | 'sending' | 'sent';
export type BufferPost = { id: string; status: BufferPostStatus; externalLink: string | null; error: string | null };

export type BufferClient = ReturnType<typeof createBufferClient>;

export function createBufferClient(apiKey: string, fetchImpl: Fetch = fetch) {
  async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const response = await fetchImpl(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query, variables }),
    });
    const body = (await response.json().catch(() => ({}))) as { data?: T; errors?: { message: string }[] };
    if (!response.ok || body.errors?.length || !body.data) {
      const message = body.errors?.map((error) => error.message).join('; ') || `Buffer HTTP ${response.status}`;
      throw new BufferError(message, response.status === 429 || response.status >= 500);
    }
    return body.data;
  }

  return {
    tiktokChannels(): Promise<BufferChannel[]> {
      return this.channels('tiktok');
    },

    async channels(service: 'tiktok' | 'instagram'): Promise<BufferChannel[]> {
      const { account } = await gql<{ account: { organizations: { id: string }[] } }>('query { account { organizations { id } } }');
      const channels: BufferChannel[] = [];
      for (const organization of account.organizations) {
        const data = await gql<{ channels: { id: string; name: string; displayName: string | null; service: string }[] }>(
          'query Channels($input: ChannelsInput!) { channels(input: $input) { id name displayName service } }',
          { input: { organizationId: organization.id } },
        );
        channels.push(
          ...data.channels
            .filter((channel) => channel.service.toLowerCase() === service)
            .map((channel) => ({ id: channel.id, name: channel.displayName ?? channel.name, service: channel.service })),
        );
      }
      return channels;
    },

    async channel(id: string): Promise<{ id: string; name: string; isQueuePaused: boolean }> {
      const data = await gql<{ channel: { id: string; name: string; displayName: string | null; isQueuePaused: boolean } }>(
        'query Channel($input: ChannelInput!) { channel(input: $input) { id name displayName isQueuePaused } }',
        { input: { id } },
      );
      return { id: data.channel.id, name: data.channel.displayName ?? data.channel.name, isQueuePaused: data.channel.isQueuePaused };
    },

    // Planlama bizim kuyruğumuzda yapılır; Buffer'a paylaşım saatinde "şimdi paylaş" olarak gönderilir.
    // instagramReel: Instagram kanalında video Reels olarak (akışta da görünür) paylaşılır.
    async shareVideoNow(input: { channelId: string; text: string; videoUrl: string; instagramReel?: boolean }): Promise<string> {
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
            ...(input.instagramReel ? { metadata: { instagram: { type: 'reel', shouldShareToFeed: true } } } : {}),
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
