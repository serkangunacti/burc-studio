import { SIGN_SLUGS } from '@/lib/zodiac/signs';
import type { SlideProps } from '@/remotion/slide-types';
import { CAROUSEL_PARTS, partLabel, partSigns, type CarouselPart } from './plan';

export type CarouselPartSlides = { part: CarouselPart; slides: SlideProps[] };

// Gönderinin 14 slaytı (kapak, 12 burç, kapanış) her parçada kapak + 4 burç + kapanış olacak şekilde bölünür.
export function splitCarousel(slides: readonly SlideProps[]): CarouselPartSlides[] {
  const cover = slides[0];
  const cta = slides[slides.length - 1];
  const signs = slides.slice(1, -1);
  if (cover?.slide.type !== 'cover' || cta?.slide.type !== 'cta') throw new Error('Carousel kapakla başlayıp kapanışla bitmeli');
  const order = signs.map((props) => (props.slide.type === 'sign' ? props.slide.sign : null));
  if (order.join() !== SIGN_SLUGS.join()) throw new Error('Carousel 12 burcu sırasıyla içermeli');
  return CAROUSEL_PARTS.map((part) => {
    const wanted = new Set(partSigns(part));
    return {
      part,
      slides: [
        { ...cover, slide: { ...cover.slide, partLabel: partLabel(part) } },
        ...signs.filter((props) => props.slide.type === 'sign' && wanted.has(props.slide.sign)),
        cta,
      ],
    };
  });
}
