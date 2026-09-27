import { AbsoluteFill } from 'remotion';
import { getTarotCard } from '@/lib/tarot/deck';
import { graphemeLength } from '@/lib/text/turkish';
import type { SignSlideData } from '@/remotion/slide-types';
import { TarotCardArt } from '@/remotion/tarot/tarot-card';
import { HEADING_FONT } from '../pastel-v1/fonts';
import { AUDIENCE_INK, CARD_SHADOW, PALETTE, type Backdrop } from '../pastel-v1/tokens';
import { ZodiacGlyph } from '../pastel-v1/zodiac';

// Kalite kapısı yorumu 420 grafemle sınırlar; en uzun metin 30px'te kartın gövdesine sığar.
export function tarotBodyFontSize(body: string): number {
  const length = graphemeLength(body);
  if (length <= 300) return 34;
  if (length <= 360) return 32;
  return 30;
}

export function TarotSlide({ slide, backdrop }: { slide: SignSlideData; backdrop: Backdrop }) {
  const ink = AUDIENCE_INK[slide.audience];
  const card = slide.tarotCard ? getTarotCard(slide.tarotCard.id) : null;
  return (
    <AbsoluteFill style={{ padding: '64px 72px 100px', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 24, fontWeight: 700, letterSpacing: 5, color: PALETTE.plumSoft }}>
        <span>{slide.dateLabel}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <div
          style={{
            width: 112,
            height: 112,
            borderRadius: 56,
            border: `3px solid ${PALETTE.white}`,
            backgroundImage: `linear-gradient(135deg, ${backdrop.from}, ${backdrop.to})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ZodiacGlyph sign={slide.sign} size={68} color={PALETTE.plum} strokeWidth={5.5} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div data-slot="sign-name" style={{ fontFamily: HEADING_FONT, fontSize: 72, fontWeight: 600, lineHeight: 1.25 }}>
            {slide.signName}
          </div>
          <div style={{ fontSize: 26, color: PALETTE.plumSoft }}>{slide.dateRange}</div>
        </div>
      </div>
      {card && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <TarotCardArt cardId={card.id} width={250} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 5, color: PALETTE.plumSoft }}>GÜNÜN KARTI</div>
            <div style={{ fontFamily: HEADING_FONT, fontSize: 56, fontWeight: 600, lineHeight: 1.1, color: ink }}>{card.name}</div>
            <div style={{ fontSize: 26, lineHeight: 1.4, color: PALETTE.plumSoft }}>{card.keywords}</div>
          </div>
        </div>
      )}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 18,
          padding: '36px 44px',
          borderRadius: 44,
          border: `2px solid ${PALETTE.goldSoft}`,
          backgroundColor: PALETTE.card,
          boxShadow: CARD_SHADOW,
        }}
      >
        <div data-slot="headline" style={{ fontFamily: HEADING_FONT, fontSize: 44, fontWeight: 500, lineHeight: 1.15, color: ink }}>
          {slide.headline}
        </div>
        <div data-slot="body" style={{ minHeight: 0, overflow: 'hidden', fontSize: tarotBodyFontSize(slide.body), lineHeight: 1.42 }}>
          {slide.body}
        </div>
      </div>
    </AbsoluteFill>
  );
}
