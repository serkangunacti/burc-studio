import { PALETTE } from '../pastel-v1/tokens';

const STAR = 'M50 18 C53 40 60 47 82 50 C60 53 53 60 50 82 C47 60 40 53 18 50 C40 47 47 40 50 18 Z';

// Kapaktaki kart sırtı: lavanta zemin, altın çerçeve ve ortada yıldız.
export function CardBack({ width }: { width: number }) {
  const height = Math.round(width * 1.6);
  const inset = Math.round(width * 0.06);
  const star = Math.round(width * 0.5);
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: Math.round(width * 0.07),
        border: `2px solid ${PALETTE.gold}`,
        backgroundImage: 'linear-gradient(160deg, #CDB8EC, #F2C9D6)',
        boxShadow: '0 14px 36px rgba(61, 44, 62, 0.16)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: inset,
          top: inset,
          width: width - inset * 2 - 4,
          height: height - inset * 2 - 4,
          borderRadius: Math.round(width * 0.045),
          border: `1.5px solid ${PALETTE.goldSoft}`,
        }}
      />
      <div style={{ position: 'absolute', left: Math.round((width - star) / 2), top: Math.round((height - star) / 2), width: star, height: star }}>
        <svg width={star} height={star} viewBox="0 0 100 100">
          <path d={STAR} fill={PALETTE.goldSoft} stroke={PALETTE.gold} strokeWidth={2} />
        </svg>
      </div>
    </div>
  );
}
