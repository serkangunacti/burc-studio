import { getLuckyColor } from '@/lib/content/lucky-colors';
import type { Audience } from '@/lib/content/types';
import { getSign, type SignSlug } from '@/lib/zodiac/signs';
import type { BrandProps, CoverSlideData, CtaSlideData, SignSlideData, SlideData, SlideProps } from './slide-types';

const graphemes = new Intl.Segmenter('tr', { granularity: 'grapheme' });

function cutGraphemes(text: string, count: number): string {
  return [...graphemes.segment(text)]
    .slice(0, count)
    .map((part) => part.segment)
    .join('');
}

export const SAMPLE_BRAND: BrandProps = { handle: 'burc.studio', enabled: true, position: 'bottom-center', opacity: 0.55 };

export const SAMPLE_BODY =
  'Bugün içindeki cesur ses her zamankinden daha net konuşuyor. Uzun süredir ertelediğin o küçük adımı atmak için gökyüzü sana göz kırpıyor; bir arkadaşının önerisi aklına yepyeni bir fikir düşürebilir. Akşamüstü kendine sakin bir yürüyüş hediye et ve günün yorgunluğunu şehrin ışıklarıyla birlikte geride bırak ✨';

export const LONGEST_BODY = `${cutGraphemes(
  `🌕 ${'Çağırılmayacaklarımızdanmışsınız gibi davranmak yerine içindeki güçlü sesi dinle ve cesaretini göster; '.repeat(6)}`,
  418,
).trimEnd()} ✨`;

export const SAMPLE_COVER: CoverSlideData = {
  type: 'cover',
  audience: 'kadin',
  dateLabel: '26 EYLÜL 2026 CUMARTESİ',
  hook: 'Koç dolunayı geldi, sen hazır mısın? 🌕',
};

export const SAMPLE_CTA: CtaSlideData = { type: 'cta', audience: 'kadin' };

export function sampleSign(slug: SignSlug = 'koc', audience: Audience = 'kadin'): SignSlideData {
  const sign = getSign(slug);
  const color = getLuckyColor('lila');
  return {
    type: 'sign',
    audience,
    dateLabel: '26 EYLÜL',
    sign: slug,
    signName: sign.name,
    dateRange: sign.dateRange,
    element: sign.element,
    headline: 'Işıltılı ve cesur bir gün',
    body: SAMPLE_BODY,
    scores: { love: 4, money: 3, health: 5 },
    luckyColor: { name: color.name, hex: color.hex },
    luckyNumber: 7,
  };
}

export function sampleProps(slide: SlideData, overrides: Partial<Omit<SlideProps, 'slide'>> = {}): SlideProps {
  return { slide, brand: SAMPLE_BRAND, format: '4x5', variant: 0, ...overrides };
}
