import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { SIGN_SLUGS } from '@/lib/zodiac/signs';
import type { ReelsProps } from '@/remotion/slide-types';
import { hookFontSize } from '../pastel-v1/cover-slide';
import { HEADING_FONT } from '../pastel-v1/fonts';
import { AUDIENCE_INK, AUDIENCE_TITLES, PALETTE, type Backdrop } from '../pastel-v1/tokens';
import { ZODIAC_PATHS } from '../pastel-v1/zodiac';
import { enter } from './motion';
import { ReelsWatermark } from './watermark';

const RING_RADIUS = 300;
const GLYPH = 64;
const RING_BOX = RING_RADIUS * 2 + GLYPH * 2;

export function IntroScene({
  reels,
  backdrop,
  title = 'Günlük',
  heading = 'Burç Yorumları',
}: {
  reels: ReelsProps;
  backdrop: Backdrop;
  title?: string;
  heading?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ink = AUDIENCE_INK[reels.audience];
  const turn = Math.round(frame * 4) / 10;
  return (
    <AbsoluteFill style={{ padding: '260px 80px 500px', alignItems: 'center' }}>
      <div style={{ ...enter(frame, fps, 0), fontSize: 30, fontWeight: 700, letterSpacing: 6, color: PALETTE.plumSoft }}>{reels.dateLabel}</div>
      <div style={{ ...enter(frame, fps, 6), marginTop: 36, fontFamily: HEADING_FONT, fontSize: 76, fontWeight: 500, color: ink }}>{title}</div>
      <div style={{ ...enter(frame, fps, 10), fontFamily: HEADING_FONT, fontSize: 108, fontWeight: 600, lineHeight: 1.02, textAlign: 'center' }}>
        {heading}
      </div>
      <div
        style={{
          ...enter(frame, fps, 14),
          marginTop: 28,
          padding: '14px 44px',
          borderRadius: 999,
          backgroundImage: `linear-gradient(90deg, ${backdrop.from}, ${backdrop.to})`,
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: 4,
        }}
      >
        {AUDIENCE_TITLES[reels.audience]}
      </div>
      <div
        style={{
          position: 'relative',
          marginTop: 'auto',
          width: RING_BOX,
          height: RING_BOX,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Tarayıcı render'ı yalnızca bir CSS alt kümesini çizer; SVG'ler konumlu bir div içinde durur, dönüş div'e uygulanır. */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: RING_BOX, height: RING_BOX, transform: `rotate(${turn}deg)` }}>
          {SIGN_SLUGS.map((sign, index) => {
            const angle = (index / SIGN_SLUGS.length) * Math.PI * 2 - Math.PI / 2;
            return (
              <div
                key={sign}
                style={{
                  position: 'absolute',
                  left: Math.round(RING_BOX / 2 + Math.cos(angle) * RING_RADIUS - GLYPH / 2),
                  top: Math.round(RING_BOX / 2 + Math.sin(angle) * RING_RADIUS - GLYPH / 2),
                  width: GLYPH,
                  height: GLYPH,
                  transform: `rotate(${-turn}deg)`,
                }}
              >
                <svg width={GLYPH} height={GLYPH} viewBox="0 0 100 100" fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
                  <path d={ZODIAC_PATHS[sign]} />
                </svg>
              </div>
            );
          })}
        </div>
        <div
          style={{
            ...enter(frame, fps, 20),
            width: RING_RADIUS * 2 - 120,
            textAlign: 'center',
            fontFamily: HEADING_FONT,
            fontSize: hookFontSize(reels.hook),
            fontWeight: 500,
            lineHeight: 1.2,
          }}
        >
          {reels.hook}
        </div>
      </div>
      <ReelsWatermark brand={reels.brand} />
    </AbsoluteFill>
  );
}
