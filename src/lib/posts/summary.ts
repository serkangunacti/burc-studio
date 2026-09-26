import type { PostRow } from '@/lib/content/repository';
import type { Audience, ReadingKind } from '@/lib/content/types';
import type { DateKey } from '@/lib/date/istanbul';
import type { PostFormat } from '@/remotion/slide-types';
import type { DraftSource } from './draft';
import type { PostDetail, PostStatus, PostVersion } from './repository';
import { audienceOf } from './slide-props';

export type PostSummary = {
  id: string;
  date: DateKey;
  kind: ReadingKind;
  audience: Audience;
  version: number;
  isCurrent: boolean;
  status: PostStatus;
  templateVersion: string;
  format: PostFormat;
  caption: string;
  hashtags: string[];
  downloadedAt: string | null;
  publishedAt: string | null;
};

export type VersionSummary = { id: string; version: number; isCurrent: boolean; status: PostStatus; createdAt: string };

export const STATUS_LABELS: Record<PostStatus, string> = {
  taslak: 'Taslak',
  hazir: 'Hazır',
  indirildi: 'İndirildi',
  paylasildi: 'Paylaşıldı',
};

export function toPostSummary(post: PostRow): PostSummary {
  return {
    id: post.id,
    date: post.date,
    kind: post.kind,
    audience: audienceOf(post),
    version: post.version,
    isCurrent: post.isCurrent,
    status: post.status,
    templateVersion: post.templateVersion,
    format: post.format,
    caption: post.caption,
    hashtags: post.hashtags,
    downloadedAt: post.downloadedAt?.toISOString() ?? null,
    publishedAt: post.publishedAt?.toISOString() ?? null,
  };
}

export function toVersionSummary(version: PostVersion): VersionSummary {
  return { ...version, createdAt: version.createdAt.toISOString() };
}

export function toDraftSource(detail: PostDetail): DraftSource {
  return {
    format: detail.post.format,
    hook: detail.post.cover.hook,
    caption: detail.post.caption,
    hashtags: detail.post.hashtags,
    signs: detail.slides.flatMap((slide) =>
      slide.type === 'sign' && slide.reading
        ? [{ sign: slide.reading.sign, headline: slide.reading.headline, body: slide.reading.body, short: slide.reading.short }]
        : [],
    ),
  };
}
