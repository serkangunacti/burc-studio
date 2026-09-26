import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ReelsProps } from '@/remotion/slide-types';
import { HEADING_FONT } from '../pastel-v1/fonts';
import { AUDIENCE_INK, CARD_SHADOW, PALETTE } from '../pastel-v1/tokens';
import { enter } from './motion';
import { ReelsHandle } from './watermark';

const ACTIONS = [
  { emoji: '🔖', title: 'Kaydet', hint: 'Yarın yeniden bakmak için' },
  { emoji: '💌', title: 'Arkadaşını etiketle', hint: 'Burcunu bilen biri mutlaka vardır' },
  { emoji: '✨', title: 'Takip et', hint: 'Her sabah yeni yorumlar' },
] as const;

export function OutroScene({ reels }: { reels: ReelsProps }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ink = AUDIENCE_INK[reels.audience];
  return (
    <AbsoluteFill style={{ padding: '260px 80px 420px', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
      <div style={{ ...enter(frame, fps, 0), fontFamily: HEADING_FONT, fontSize: 100, fontWeight: 600 }}>Beğendin mi?</div>
      {ACTIONS.map((action, index) => (
        <div
          key={action.title}
          style={{
            ...enter(frame, fps, 8 + index * 6),
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            padding: '30px 40px',
            borderRadius: 40,
            border: `2px solid ${PALETTE.goldSoft}`,
            backgroundColor: PALETTE.card,
            boxShadow: CARD_SHADOW,
          }}
        >
          <span style={{ fontSize: 60 }}>{action.emoji}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: HEADING_FONT, fontSize: 50, fontWeight: 600, color: ink }}>{action.title}</span>
            <span style={{ fontSize: 30, color: PALETTE.plumSoft }}>{action.hint}</span>
          </div>
        </div>
      ))}
      <div style={{ ...enter(frame, fps, 30), marginTop: 20, fontSize: 44, fontWeight: 700 }}>
        <ReelsHandle brand={reels.brand} />
      </div>
    </AbsoluteFill>
  );
}
