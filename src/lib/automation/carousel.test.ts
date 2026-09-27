import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SIGN_SLUGS } from '@/lib/zodiac/signs';
import { SAMPLE_COVER, SAMPLE_CTA, sampleProps, sampleSign } from '@/remotion/fixtures';
import { getTemplate } from '@/remotion/templates';
import { splitCarousel } from './carousel';

const SLIDES = [sampleProps(SAMPLE_COVER), ...SIGN_SLUGS.map((sign) => sampleProps(sampleSign(sign))), sampleProps(SAMPLE_CTA)];

describe('carousel bölme', () => {
  it('her parça kapak, sıradaki 4 burç ve kapanıştan oluşur', () => {
    const parts = splitCarousel(SLIDES);
    expect(parts.map((entry) => entry.part)).toEqual([1, 2, 3]);
    for (const { slides } of parts) {
      expect(slides).toHaveLength(6);
      expect(slides[0].slide.type).toBe('cover');
      expect(slides[5]).toBe(SLIDES[13]);
    }
    expect(parts[2].slides.slice(1, 5).map((props) => (props.slide.type === 'sign' ? props.slide.sign : null))).toEqual(['yay', 'oglak', 'kova', 'balik']);
    expect(parts[1].slides[0].slide).toMatchObject({ type: 'cover', partLabel: '2/3 · ASLAN · BAŞAK · TERAZİ · AKREP' });
  });

  it('beklenmeyen slayt dizisini reddeder', () => {
    expect(() => splitCarousel(SLIDES.slice(0, 10))).toThrow();
    expect(() => splitCarousel([SLIDES[0], ...SLIDES.slice(2), SLIDES[1]])).toThrow();
  });

  it('parça etiketi üç şablonun kapağında görünür, etiketsiz kapak değişmez', () => {
    const [first] = splitCarousel(SLIDES);
    for (const version of ['pastel@1', 'pastel-tarot@1', 'pastel-weekly@1']) {
      const { Slide } = getTemplate(version);
      expect(renderToStaticMarkup(createElement(Slide, first.slides[0]))).toContain('1/3 · KOÇ · BOĞA · İKİZLER · YENGEÇ');
      expect(renderToStaticMarkup(createElement(Slide, SLIDES[0]))).not.toContain('1/3');
    }
  });
});
