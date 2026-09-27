import { Thumbnail } from '@remotion/player';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnyZodObject } from 'remotion';
import { describe, expect, it } from 'vitest';
import { LONGEST_BODY, SAMPLE_COVER, SAMPLE_CTA, sampleProps, sampleReels, sampleSign } from '@/remotion/fixtures';
import { REELS_FPS, REELS_SIZE, reelsDurationInFrames } from '@/remotion/reels';
import type { ReelsProps, SlideProps } from '@/remotion/slide-types';
import { getTemplate } from '@/remotion/templates';
import { PastelTarotSlide } from './slide';

const html = (props: SlideProps) => renderToStaticMarkup(createElement(PastelTarotSlide, props));
const tarotSign = (overrides = {}) => ({ ...sampleSign('oglak'), tarotCard: { id: 'tilsim-kralice', name: 'Tılsım Kraliçesi' }, ...overrides });
const reelsFrame = (frame: number) => {
  const reels: ReelsProps = { ...sampleReels('kadin'), signs: sampleReels('kadin').signs.map((sign) => ({ ...sign, tarotCard: { id: 'yildiz', name: 'Yıldız' } })) };
  return renderToStaticMarkup(
    createElement(Thumbnail<AnyZodObject, ReelsProps>, {
      component: getTemplate('pastel-tarot@1').Reels,
      inputProps: reels,
      frameToDisplay: frame,
      durationInFrames: reelsDurationInFrames(reels.signs.length),
      fps: REELS_FPS,
      compositionWidth: REELS_SIZE.width,
      compositionHeight: REELS_SIZE.height,
    }),
  );
};

describe('pastel-tarot@1', () => {
  it('şablon kaydında tarot slaytını verir', () => {
    expect(getTemplate('pastel-tarot@1').Slide).toBe(PastelTarotSlide);
  });

  it('kapak "Tarot Yorumları" başlığını, tarihi, kitleyi ve kancayı içerir', () => {
    const out = html(sampleProps(SAMPLE_COVER));
    for (const text of ['Tarot Yorumları', '26 EYLÜL 2026 CUMARTESİ', 'KADIN', SAMPLE_COVER.hook]) expect(out).toContain(text);
  });

  it('tarot slaytı burcu, günün kartını, kart adını ve yorumu gösterir; puan yıldızı yoktur', () => {
    const out = html(sampleProps(tarotSign({ body: LONGEST_BODY })));
    for (const text of ['Oğlak', 'data-card="tilsim-kralice"', 'GÜNÜN KARTI', 'Tılsım Kraliçesi', 'Işıltılı ve cesur bir gün']) expect(out).toContain(text);
    expect(out).not.toContain('data-star=');
    expect(out).toMatch(/data-slot="sign-name" style="[^"]*line-height:1.25/);
    expect(count(html(sampleProps(SAMPLE_CTA)), 'data-mark="saturn"')).toBe(1);
  });

  it('tarot Reels girişi "Tarot Yorumları" der; burç sahnesinde günün kartı çizilir', () => {
    expect(reelsFrame(40)).toContain('Tarot Yorumları');
    expect(reelsFrame(190)).toContain('data-card="yildiz"');
  });
});

function count(text: string, needle: string) {
  return text.split(needle).length - 1;
}
