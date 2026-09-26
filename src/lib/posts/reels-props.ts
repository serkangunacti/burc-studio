import { toReelsSign } from '@/remotion/reels';
import type { BrandProps, ReelsProps } from '@/remotion/slide-types';
import type { PostDetail } from './repository';
import { buildSlideProps } from './slide-props';

export function buildReelsProps(detail: PostDetail, brand: BrandProps): ReelsProps {
  const slides = buildSlideProps(detail, brand);
  const [cover] = slides;
  if (cover?.slide.type !== 'cover') throw new Error('Gönderinin ilk slaytı kapak olmalı');
  const shortBySign = new Map(detail.slides.flatMap((slide) => (slide.reading ? [[slide.reading.sign, slide.reading.short] as const] : [])));
  return {
    audience: cover.slide.audience,
    dateLabel: cover.slide.dateLabel,
    hook: cover.slide.hook,
    brand,
    variant: cover.variant,
    signs: slides.flatMap((props) => (props.slide.type === 'sign' ? [toReelsSign(props.slide, shortBySign.get(props.slide.sign) ?? '')] : [])),
  };
}
