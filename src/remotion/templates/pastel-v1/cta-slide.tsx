import { AbsoluteFill } from 'remotion';
import type { BrandProps, CtaSlideData } from '@/remotion/slide-types';
import { HEADING_FONT } from './fonts';
import { AUDIENCE_ACCENTS, CARD_SHADOW, PALETTE } from './tokens';

const ACTIONS = [
  { emoji: '🔖', title: 'Kaydet', hint: 'Yarın yeniden bakmak için' },
  { emoji: '💌', title: 'Arkadaşını etiketle', hint: 'Burcunu bilen biri mutlaka vardır' },
  { emoji: '✨', title: 'Takip et', hint: 'Her sabah yeni yorumlar' },
] as const;

export function CtaSlide({ slide, brand }: { slide: CtaSlideData; brand: BrandProps }) {
  const accent = AUDIENCE_ACCENTS[slide.audience];
  return (
    <AbsoluteFill style={{ padding: '120px 88px', alignItems: 'center', justifyContent: 'center', gap: 36 }}>
      <div style={{ fontFamily: HEADING_FONT, fontSize: 92, fontWeight: 600 }}>Beğendin mi?</div>
      {ACTIONS.map((action) => (
        <div
          key={action.title}
          style={{
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
          <span style={{ fontSize: 56 }}>{action.emoji}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: HEADING_FONT, fontSize: 46, fontWeight: 600, color: accent.ink }}>{action.title}</span>
            <span style={{ fontSize: 28, color: PALETTE.plumSoft }}>{action.hint}</span>
          </div>
        </div>
      ))}
      <div data-slot="handle" style={{ marginTop: 24, fontSize: 40, fontWeight: 700 }}>
        {brand.handle ? `@${brand.handle}` : 'Yarın yeni yorumlarla buradayız'}
      </div>
    </AbsoluteFill>
  );
}
