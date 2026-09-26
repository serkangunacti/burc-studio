const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';
const SPARKLE_PATH = 'M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z';

export function StarIcon({ filled, size, color }: { filled: boolean; size: number; color: string }) {
  return (
    <svg data-star={filled ? 'full' : 'empty'} width={size} height={size} viewBox="0 0 24 24">
      <path
        d={STAR_PATH}
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        opacity={filled ? 1 : 0.4}
      />
    </svg>
  );
}

export function Sparkle({ x, y, size, color, opacity }: { x: number; y: number; size: number; color: string; opacity: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`, opacity }}>
      <path d={SPARKLE_PATH} fill={color} />
    </svg>
  );
}
