import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Audience } from '@/lib/content/types';
import type { BrandProps, ReelsSign } from '@/remotion/slide-types';
import { TarotCardArt } from '@/remotion/tarot/tarot-card';
import { HEADING_FONT } from '../pastel-v1/fonts';
import { AUDIENCE_INK, CARD_SHADOW, PALETTE, type Backdrop } from '../pastel-v1/tokens';
import { enter } from '../pastel-v1-reels/motion';
import { ReelsWatermark } from '../pastel-v1-reels/watermark';

// Tarot Reels'inde burç sahnesi: burç, günün kartı (belirerek büyür), kart adı, başlık ve kısa yorum.
export function TarotScene({
  sign,
  index,
  total,
  audience,
  brand,
}: {
  sign: ReelsSign;
  index: number;
  total: number;
  audience: Audience;
  backdrop: Backdrop;
  brand: BrandProps;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ink = AUDIENCE_INK[audience];
  const reveal = spring({ frame: frame - 4, fps, config: { damping: 16 } });
  return (
    <AbsoluteFill style={{ padding: '260px 80px 420px', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
      <div style={{ position: 'absolute', top: 260, right: 80, fontSize: 26, fontWeight: 700, letterSpacing: 4, color: PALETTE.plumSoft }}>
        {index + 1} / {total}
      </div>
      <div style={{ ...enter(frame, fps, 0), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div data-slot="sign-name" style={{ fontFamily: HEADING_FONT, fontSize: 96, fontWeight: 600, lineHeight: 1.25 }}>
          {sign.signName}
        </div>
        <div style={{ fontSize: 32, color: PALETTE.plumSoft }}>{sign.dateRange}</div>
      </div>
      {sign.tarotCard && (
        <div style={{ opacity: Math.min(1, Math.max(0, reveal)), transform: `scale(${Math.round((0.85 + 0.15 * Math.max(0, reveal)) * 1000) / 1000})` }}>
          <TarotCardArt cardId={sign.tarotCard.id} width={300} />
        </div>
      )}
      <div style={{ ...enter(frame, fps, 14), fontFamily: HEADING_FONT, fontSize: 48, fontWeight: 500, lineHeight: 1.15, color: ink, textAlign: 'center' }}>
        {sign.headline}
      </div>
      <div
        style={{
          ...enter(frame, fps, 24),
          width: '100%',
          padding: '32px 44px',
          borderRadius: 44,
          border: `2px solid ${PALETTE.goldSoft}`,
          backgroundColor: PALETTE.card,
          boxShadow: CARD_SHADOW,
          fontSize: 40,
          lineHeight: 1.35,
          textAlign: 'center',
        }}
      >
        {sign.short}
      </div>
      <ReelsWatermark brand={brand} />
    </AbsoluteFill>
  );
}
