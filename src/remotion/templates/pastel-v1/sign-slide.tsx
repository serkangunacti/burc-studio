import { AbsoluteFill } from 'remotion';
import { graphemeLength } from '@/lib/text/turkish';
import type { SignSlideData } from '@/remotion/slide-types';
import { HEADING_FONT } from './fonts';
import { StarIcon } from './ornaments';
import { AUDIENCE_ACCENTS, AUDIENCE_TITLES, CARD_SHADOW, PALETTE } from './tokens';
import { ZodiacGlyph } from './zodiac';

// Kalite kapısı yorumu 420 grafemle sınırlar; en uzun metin 32px'te kartın gövdesine sığar.
export function bodyFontSize(body: string): number {
  const length = graphemeLength(body);
  if (length <= 300) return 38;
  if (length <= 360) return 35;
  return 32;
}

function ScoreRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{ width: 100, fontSize: 26, fontWeight: 700, color: PALETTE.plumSoft }}>{label}</span>
      <span style={{ display: 'flex', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((step) => (
          <StarIcon key={step} filled={step <= value} size={30} color={color} />
        ))}
      </span>
    </div>
  );
}

export function SignSlide({ slide }: { slide: SignSlideData }) {
  const accent = AUDIENCE_ACCENTS[slide.audience];
  return (
    <AbsoluteFill style={{ padding: '72px 72px 100px', gap: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, fontWeight: 700, letterSpacing: 5, color: PALETTE.plumSoft }}>
        <span>{`GÜNLÜK BURÇ · ${AUDIENCE_TITLES[slide.audience]}`}</span>
        <span>{slide.dateLabel}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
        <div
          style={{
            width: 168,
            height: 168,
            borderRadius: 84,
            border: `3px solid ${PALETTE.white}`,
            backgroundImage: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ZodiacGlyph sign={slide.sign} size={104} color={PALETTE.plum} strokeWidth={5.5} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontFamily: HEADING_FONT, fontSize: 96, fontWeight: 600, lineHeight: 1 }}>{slide.signName}</div>
          <div style={{ fontSize: 30, color: PALETTE.plumSoft }}>{slide.dateRange}</div>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 26,
          padding: '44px 48px',
          borderRadius: 48,
          border: `2px solid ${PALETTE.goldSoft}`,
          backgroundColor: PALETTE.card,
          boxShadow: CARD_SHADOW,
        }}
      >
        <div data-slot="headline" style={{ fontFamily: HEADING_FONT, fontSize: 50, fontWeight: 500, lineHeight: 1.15, color: accent.ink }}>
          {slide.headline}
        </div>
        <div data-slot="body" style={{ flex: 1, minHeight: 0, overflow: 'hidden', fontSize: bodyFontSize(slide.body), lineHeight: 1.45 }}>
          {slide.body}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ScoreRow label="Aşk" value={slide.scores.love} color={accent.ink} />
            <ScoreRow label="Para" value={slide.scores.money} color={accent.ink} />
            <ScoreRow label="Sağlık" value={slide.scores.health} color={accent.ink} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, fontSize: 26 }}>
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
      </div>
    </AbsoluteFill>
  );
}
