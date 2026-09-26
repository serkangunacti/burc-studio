import type { BrandProps } from '@/remotion/slide-types';
import { BODY_FONT } from './fonts';
import { PALETTE } from './tokens';

export function Watermark({ brand }: { brand: BrandProps }) {
  if (!brand.enabled || !brand.handle) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 56,
        right: 56,
        bottom: 34,
        display: 'flex',
        justifyContent: brand.position === 'bottom-center' ? 'center' : 'flex-end',
      }}
    >
      <span
        data-slot="watermark"
        style={{ fontFamily: BODY_FONT, fontSize: 22, fontWeight: 600, letterSpacing: 1, color: PALETTE.plum, opacity: brand.opacity }}
      >
        @{brand.handle}
      </span>
    </div>
  );
}
