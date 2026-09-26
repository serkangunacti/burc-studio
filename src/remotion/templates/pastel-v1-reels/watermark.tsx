import { SaturnMark } from '@/lib/brand/saturn-mark';
import type { BrandProps } from '@/remotion/slide-types';
import { PALETTE } from '../pastel-v1/tokens';

// Instagram arayüzü altta ~420 px'i kapatır; filigran bu alanın hemen üstünde durur.
export function ReelsWatermark({ brand }: { brand: BrandProps }) {
  if (!brand.enabled || !brand.handle) return null;
  return (
    <div style={{ position: 'absolute', left: 80, right: 80, bottom: 420, display: 'flex', justifyContent: 'center' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 26, fontWeight: 600, letterSpacing: 1, opacity: brand.opacity }}>
        <SaturnMark size={34} color={PALETTE.plum} strokeWidth={7} />
        <span>@{brand.handle}</span>
      </span>
    </div>
  );
}
