import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Audience } from '@/lib/content/types';
import type { ReelsSign } from '@/remotion/slide-types';
import { HEADING_FONT } from '../pastel-v1/fonts';
import { StarIcon } from '../pastel-v1/ornaments';
import { AUDIENCE_INK, CARD_SHADOW, PALETTE, type Backdrop } from '../pastel-v1/tokens';
import { ZODIAC_PATHS } from '../pastel-v1/zodiac';
import { drawProgress, enter } from './motion';

const SCORE_LABELS = [
  ['love', 'Aşk'],
  ['money', 'Para'],
  ['health', 'Sağlık'],
] as const;

export function SignScene({
  sign,
  index,
  total,
  audience,
  backdrop,
}: {
  sign: ReelsSign;
  index: number;
  total: number;
  audience: Audience;
  backdrop: Backdrop;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ink = AUDIENCE_INK[audience];
  const medallion = spring({ frame, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ padding: '260px 80px 420px', alignItems: 'center', gap: 28 }}>
      <div style={{ alignSelf: 'flex-end', fontSize: 26, fontWeight: 700, letterSpacing: 4, color: PALETTE.plumSoft }}>
        {index + 1} / {total}
      </div>
      <div
        style={{
          width: 220,
          height: 220,
          borderRadius: 110,
          border: `4px solid ${PALETTE.white}`,
          backgroundImage: `linear-gradient(135deg, ${backdrop.from}, ${backdrop.to})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${Math.round(medallion * 1000) / 1000})`,
        }}
      >
        <svg width={136} height={136} viewBox="0 0 100 100" fill="none" stroke={PALETTE.plum} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round">
          <path d={ZODIAC_PATHS[sign.sign]} pathLength={1} strokeDasharray={1} strokeDashoffset={drawProgress(frame, 4, 34)} />
        </svg>
      </div>
      <div style={{ ...enter(frame, fps, 6), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ fontFamily: HEADING_FONT, fontSize: 120, fontWeight: 600, lineHeight: 1 }}>{sign.signName}</div>
        <div style={{ fontSize: 36, color: PALETTE.plumSoft }}>{sign.dateRange}</div>
      </div>
      <div style={{ ...enter(frame, fps, 16), fontFamily: HEADING_FONT, fontSize: 56, fontWeight: 500, lineHeight: 1.15, color: ink, textAlign: 'center' }}>
        {sign.headline}
      </div>
      <div
        style={{
          ...enter(frame, fps, 26),
          width: '100%',
          padding: '40px 48px',
          borderRadius: 48,
          border: `2px solid ${PALETTE.goldSoft}`,
          backgroundColor: PALETTE.card,
          boxShadow: CARD_SHADOW,
          fontSize: 44,
          lineHeight: 1.35,
          textAlign: 'center',
        }}
      >
        {sign.short}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 44 }}>
        {SCORE_LABELS.map(([key, label], row) => (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <span style={{ ...enter(frame, fps, 44 + row * 4, 20), fontSize: 28, fontWeight: 700, color: PALETTE.plumSoft }}>{label}</span>
            <span style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3, 4, 5].map((step) => {
                const pop = spring({ frame: frame - (48 + row * 6 + step * 3), fps, config: { damping: 12 } });
                return (
                  <span key={step} style={{ display: 'flex', transform: `scale(${Math.round(Math.max(0, pop) * 1000) / 1000})` }}>
                    <StarIcon filled={step <= sign.scores[key]} size={34} color={ink} />
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </div>
      <div style={{ ...enter(frame, fps, 84, 20), display: 'flex', alignItems: 'center', gap: 16, fontSize: 32 }}>
        <span
          style={{ width: 38, height: 38, borderRadius: 19, border: `2px solid ${PALETTE.white}`, backgroundColor: sign.luckyColor.hex }}
        />
        <span>{sign.luckyColor.name}</span>
        <span style={{ color: PALETTE.plumSoft }}>· Şanslı sayı</span>
        <span style={{ fontFamily: HEADING_FONT, fontSize: 44, fontWeight: 600 }}>{sign.luckyNumber}</span>
      </div>
    </AbsoluteFill>
  );
}
