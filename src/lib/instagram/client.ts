// Instagram API with Instagram Login (graph.instagram.com); yalnızca paylaşım için gereken çağrılar.
const API = 'https://graph.instagram.com/v25.0';
const REFRESH_URL = 'https://graph.instagram.com/refresh_access_token';

// Meta'nın geçici saydığı hata kodları: hız sınırı, servis kesintisi, bilinmeyen hata.
const TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 341, 613]);

export class InstagramError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'InstagramError';
  }
}

export type ContainerStatus = 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED';
type Fetch = typeof fetch;

async function call<T>(fetchImpl: Fetch, url: string, init?: RequestInit): Promise<T> {
  const response = await fetchImpl(url, init);
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string; code?: number; is_transient?: boolean } } & T;
  if (response.ok && !body.error) return body;
  const code = body.error?.code ?? null;
  const retryable = response.status >= 500 || body.error?.is_transient === true || (code !== null && TRANSIENT_CODES.has(code));
  throw new InstagramError(body.error?.message ?? `Instagram HTTP ${response.status}`, code, retryable);
}

export type InstagramClient = ReturnType<typeof createInstagramClient>;

export function createInstagramClient(input: { token: string; userId: string; fetch?: Fetch }) {
  const fetchImpl = input.fetch ?? fetch;
  const post = <T>(path: string, params: Record<string, string>) =>
    call<T>(fetchImpl, `${API}/${path}`, { method: 'POST', body: new URLSearchParams({ ...params, access_token: input.token }) });
  const get = <T>(path: string, params: Record<string, string>) =>
    call<T>(fetchImpl, `${API}/${path}?${new URLSearchParams({ ...params, access_token: input.token })}`);
  const media = (params: Record<string, string>) => post<{ id: string }>(`${input.userId}/media`, params).then((body) => body.id);

  return {
    createCarouselItem: (imageUrl: string) => media({ image_url: imageUrl, is_carousel_item: 'true' }),
    createCarousel: (children: string[], caption: string) => media({ media_type: 'CAROUSEL', children: children.join(','), caption }),
    createReels: (videoUrl: string, caption: string) => media({ media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true' }),
    containerStatus: (containerId: string) =>
      get<{ status_code: ContainerStatus }>(containerId, { fields: 'status_code' }).then((body) => body.status_code),
    // Hata durumunda Instagram'ın verdiği açıklama (ör. "Error: … 2207052").
    containerDetail: (containerId: string) => get<{ status?: string }>(containerId, { fields: 'status' }).then((body) => body.status ?? null),
    publish: (containerId: string) => post<{ id: string }>(`${input.userId}/media_publish`, { creation_id: containerId }).then((body) => body.id),
    permalink: (mediaId: string) => get<{ permalink?: string }>(mediaId, { fields: 'permalink' }).then((body) => body.permalink ?? null),
    // Yalnız instagram_business_content_publish izniyle çalışır; bağlanırken izin denetimi olarak da kullanılır.
    publishingLimit: () =>
      get<{ data?: { quota_usage?: number; config?: { quota_total?: number } }[] }>(`${input.userId}/content_publishing_limit`, {
        fields: 'quota_usage,config',
      }).then((body) => ({ used: body.data?.[0]?.quota_usage ?? 0, total: body.data?.[0]?.config?.quota_total ?? 100 })),
  };
}

export async function fetchInstagramAccount(token: string, fetchImpl: Fetch = fetch): Promise<{ id: string; username: string | null }> {
  const body = await call<{ user_id?: string; id?: string; username?: string }>(
    fetchImpl,
    `${API}/me?${new URLSearchParams({ fields: 'user_id,username', access_token: token })}`,
  );
  const id = body.user_id ?? body.id;
  if (!id) throw new InstagramError('Instagram hesap kimliği alınamadı', null, false);
  return { id: String(id), username: body.username ?? null };
}

// Uzun ömürlü anahtar 60 gün geçerli; en az 24 saatlik anahtar yenilenebilir.
export async function refreshInstagramToken(token: string, fetchImpl: Fetch = fetch): Promise<{ token: string; expiresInSeconds: number }> {
  const body = await call<{ access_token: string; expires_in: number }>(
    fetchImpl,
    `${REFRESH_URL}?${new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token })}`,
  );
  return { token: body.access_token, expiresInSeconds: body.expires_in };
}
