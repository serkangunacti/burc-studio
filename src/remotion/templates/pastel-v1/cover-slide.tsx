import { AbsoluteFill } from 'remotion';
import { SIGN_SLUGS } from '@/lib/zodiac/signs';
import type { CoverSlideData } from '@/remotion/slide-types';
import { HEADING_FONT } from './fonts';
import { AUDIENCE_ACCENTS, AUDIENCE_TITLES, PALETTE } from './tokens';
import { ZodiacGlyph } from './zodiac';

const RING_RADIUS = 270;
const GLYPH_SIZE = 60;
const RING_BOX = RING_RADIUS * 2 + GLYPH_SIZE * 2;

export function CoverSlide({ slide }: { slide: CoverSlideData }) {
  const accent = AUDIENCE_ACCENTS[slide.audience];
  return (
    <AbsoluteFill style={{ padding: '96px 88px 110px', alignItems: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 6, color: PALETTE.plumSoft }}>{slide.dateLabel}</div>
      <div style={{ marginTop: 28, fontFamily: HEADING_FONT, fontSize: 64, fontWeight: 500, color: accent.ink }}>Günlük</div>
      <div style={{ fontFamily: HEADING_FONT, fontSize: 104, fontWeight: 600, lineHeight: 1.02 }}>Burç Yorumları</div>
      <div
        style={{
          marginTop: 28,
          padding: '12px 40px',
          borderRadius: 999,
          backgroundImage: `linear-gradient(90deg, ${accent.from}, ${accent.to})`,
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: 4,
        }}
      >
        {AUDIENCE_TITLES[slide.audience]}
      </div>
      <div
        style={{
          position: 'relative',
          marginTop: 'auto',
          marginBottom: 'auto',
          width: RING_BOX,
          height: RING_BOX,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {SIGN_SLUGS.map((sign, index) => {
          const angle = (index / SIGN_SLUGS.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <div
              key={sign}
              style={{
                position: 'absolute',
                // Tam piksele yuvarlanır: kayan nokta farkları sunucu/istemci ve cihazlar arasında çıktıyı değiştirmesin.
                left: Math.round(RING_BOX / 2 + Math.cos(angle) * RING_RADIUS - GLYPH_SIZE / 2),
                top: Math.round(RING_BOX / 2 + Math.sin(angle) * RING_RADIUS - GLYPH_SIZE / 2),
                width: GLYPH_SIZE,
                height: GLYPH_SIZE,
              }}
            >
              <ZodiacGlyph sign={sign} size={GLYPH_SIZE} color={accent.ink} strokeWidth={5} />
            </div>
          );
        })}
        <div style={{ width: RING_RADIUS * 2 - 150, textAlign: 'center', fontFamily: HEADING_FONT, fontSize: 52, fontWeight: 500, lineHeight: 1.2 }}>
          {slide.hook}
        </div>
      </div>
      <div style={{ fontSize: 30, fontWeight: 600, color: PALETTE.plumSoft }}>Burcunu bulmak için kaydır →</div>
    </AbsoluteFill>
  );
}
