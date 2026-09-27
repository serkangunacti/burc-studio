import { AbsoluteFill } from 'remotion';
import type { CoverSlideData } from '@/remotion/slide-types';
import { hookFontSize } from '../pastel-v1/cover-slide';
import { HEADING_FONT } from '../pastel-v1/fonts';
import { AUDIENCE_INK, AUDIENCE_TITLES, PALETTE, type Backdrop } from '../pastel-v1/tokens';
import { CardBack } from './card-back';

const FAN = [
  { angle: -14, x: -150, y: 26 },
  { angle: 0, x: 0, y: 0 },
  { angle: 14, x: 150, y: 26 },
];
const BACK_WIDTH = 190;

export function TarotCover({ slide, backdrop }: { slide: CoverSlideData; backdrop: Backdrop }) {
  const ink = AUDIENCE_INK[slide.audience];
  return (
    <AbsoluteFill style={{ padding: '96px 88px 110px', alignItems: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 6, color: PALETTE.plumSoft }}>{slide.dateLabel}</div>
      {slide.partLabel && <div style={{ marginTop: 12, fontSize: 24, fontWeight: 700, letterSpacing: 4, color: ink }}>{slide.partLabel}</div>}
      <div style={{ marginTop: 28, fontFamily: HEADING_FONT, fontSize: 64, fontWeight: 500, color: ink }}>Günlük</div>
      <div style={{ fontFamily: HEADING_FONT, fontSize: 104, fontWeight: 600, lineHeight: 1.02 }}>Tarot Yorumları</div>
      <div
        style={{
          marginTop: 28,
          padding: '12px 40px',
          borderRadius: 999,
          backgroundImage: `linear-gradient(90deg, ${backdrop.from}, ${backdrop.to})`,
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: 4,
        }}
      >
        {AUDIENCE_TITLES[slide.audience]}
      </div>
      <div style={{ position: 'relative', marginTop: 56, width: 560, height: 360 }}>
        {FAN.map((card) => (
          <div
            key={card.angle}
            style={{
              position: 'absolute',
              left: Math.round(280 - BACK_WIDTH / 2 + card.x),
              top: card.y,
              transform: `rotate(${card.angle}deg)`,
            }}
          >
            <CardBack width={BACK_WIDTH} />
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 'auto',
          marginBottom: 'auto',
          maxWidth: 820,
          textAlign: 'center',
          fontFamily: HEADING_FONT,
          fontSize: hookFontSize(slide.hook),
          fontWeight: 500,
          lineHeight: 1.2,
        }}
      >
        {slide.hook}
      </div>
      <div style={{ fontSize: 30, fontWeight: 600, color: PALETTE.plumSoft }}>Kartını görmek için kaydır →</div>
    </AbsoluteFill>
  );
}
