import { AbsoluteFill } from 'remotion';
import { graphemeLength } from '@/lib/text/turkish';
import type { SignSlideData } from '@/remotion/slide-types';
import { HEADING_FONT } from '../pastel-v1/fonts';
import { AUDIENCE_INK, CARD_SHADOW, PALETTE, type Backdrop } from '../pastel-v1/tokens';
import { ZodiacGlyph } from '../pastel-v1/zodiac';

// Kalite kapısı haftalık yorumu 850 grafemle sınırlar; en uzun metin 28px'te kartın gövdesine sığar,
// kısa metinler kartı doldursun diye büyür.
export function weeklyBodyFontSize(body: string): number {
  const length = graphemeLength(body);
  if (length <= 620) return 34;
  if (length <= 700) return 32;
  if (length <= 780) return 30;
  return 28;
}

export function WeeklySign({ slide, backdrop }: { slide: SignSlideData; backdrop: Backdrop }) {
  const ink = AUDIENCE_INK[slide.audience];
  return (
    <AbsoluteFill style={{ padding: '64px 72px 100px', gap: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 24, fontWeight: 700, letterSpacing: 5, color: PALETTE.plumSoft }}>
        <span>{slide.dateLabel}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <div
          style={{
            width: 136,
            height: 136,
            borderRadius: 68,
            border: `3px solid ${PALETTE.white}`,
            backgroundImage: `linear-gradient(135deg, ${backdrop.from}, ${backdrop.to})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ZodiacGlyph sign={slide.sign} size={84} color={PALETTE.plum} strokeWidth={5.5} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div data-slot="sign-name" style={{ fontFamily: HEADING_FONT, fontSize: 84, fontWeight: 600, lineHeight: 1.25 }}>
            {slide.signName}
          </div>
          <div style={{ fontSize: 28, color: PALETTE.plumSoft }}>{slide.dateRange}</div>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          padding: '40px 44px',
          borderRadius: 48,
          border: `2px solid ${PALETTE.goldSoft}`,
          backgroundColor: PALETTE.card,
          boxShadow: CARD_SHADOW,
        }}
      >
        <div data-slot="text" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22 }}>
          <div data-slot="headline" style={{ fontFamily: HEADING_FONT, fontSize: 46, fontWeight: 500, lineHeight: 1.15, color: ink }}>
            {slide.headline}
          </div>
          <div data-slot="body" style={{ fontSize: weeklyBodyFontSize(slide.body), lineHeight: 1.42 }}>
            {slide.body}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, fontSize: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                border: `2px solid ${PALETTE.white}`,
                backgroundColor: slide.luckyColor.hex,
                boxShadow: '0 2px 6px rgba(61, 44, 62, 0.15)',
              }}
            />
            <span>{slide.luckyColor.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ color: PALETTE.plumSoft }}>Şanslı sayı</span>
            <span style={{ fontFamily: HEADING_FONT, fontSize: 40, fontWeight: 600 }}>{slide.luckyNumber}</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
