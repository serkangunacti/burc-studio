import type { PostRow } from '@/lib/content/repository';
import { getLuckyColor } from '@/lib/content/lucky-colors';
import type { Audience, ReadingAudience, ReadingKind } from '@/lib/content/types';
import { formatDateLongTr, formatDateShortTr } from '@/lib/date/istanbul';
import type { Settings } from '@/lib/settings/schema';
import { getSign } from '@/lib/zodiac/signs';
import type { BrandProps, SlideProps } from '@/remotion/slide-types';
import type { PostDetail } from './repository';

const upper = (text: string) => text.toLocaleUpperCase('tr-TR');

export function audienceOf(post: Pick<PostRow, 'audience'>): Audience {
  if (post.audience === 'genel') throw new Error('Genel kitleli gönderiler bu şablonda desteklenmiyor');
  return post.audience;
}

// Aynı günün gönderileri farklı, ardışık günler de farklı zeminle açılsın; pazartesi 7 gönderi 7 zeminin hepsini kullanır.
const KIND_OFFSETS: Record<ReadingKind, number> = { horoscope: 0, tarot: 1, special: 5, weekly: 6 };
const AUDIENCE_OFFSETS: Record<ReadingAudience, number> = { kadin: 0, erkek: 3, genel: 0 };

export function variantFor(post: Pick<PostRow, 'date' | 'kind' | 'audience'>): number {
  const day = Math.floor(Date.parse(`${post.date}T00:00:00Z`) / 86_400_000);
  return day + KIND_OFFSETS[post.kind] + AUDIENCE_OFFSETS[post.audience];
}

export function brandFromSettings(settings: Settings): BrandProps {
  return { handle: settings.instagramHandle, ...settings.watermark };
}

export function buildCoverProps(post: PostRow, brand: BrandProps): SlideProps {
  return {
    format: post.format,
    brand,
    variant: variantFor(post),
    slide: { type: 'cover', audience: audienceOf(post), dateLabel: upper(formatDateLongTr(post.date)), hook: post.cover.hook },
  };
}

export function buildSlideProps(detail: PostDetail, brand: BrandProps): SlideProps[] {
  const { post } = detail;
  const audience = audienceOf(post);
  const variant = variantFor(post);
  return detail.slides.map((slide): SlideProps => {
    if (slide.type === 'cover') return buildCoverProps(post, brand);
    if (slide.type === 'cta') return { format: post.format, brand, variant, slide: { type: 'cta', audience } };
    const { reading } = slide;
    if (!reading) throw new Error(`Slayt ${slide.position} için yorum bulunamadı`);
    const sign = getSign(reading.sign);
    const color = getLuckyColor(reading.meta.luckyColor);
    return {
      format: post.format,
      brand,
      variant,
      slide: {
        type: 'sign',
        audience,
        dateLabel: upper(formatDateShortTr(post.date)),
        sign: sign.slug,
        signName: sign.name,
        dateRange: sign.dateRange,
        element: sign.element,
        headline: reading.headline,
        body: reading.body,
        scores: reading.meta.scores,
        luckyColor: { name: color.name, hex: color.hex },
        luckyNumber: reading.meta.luckyNumber,
      },
    };
  });
}
