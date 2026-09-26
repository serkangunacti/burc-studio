import type { BrandProps } from '@/remotion/slide-types';

// Instagram arayüzü altta ~420 px'i kapatır; filigran bu alanın hemen üstünde durur.
export function ReelsWatermark({ brand }: { brand: BrandProps }) {
  if (!brand.enabled || !brand.handle) return null;
  return (
    <div style={{ position: 'absolute', left: 80, right: 80, bottom: 420, display: 'flex', justifyContent: 'center' }}>
      <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: 1, opacity: brand.opacity }}>@{brand.handle}</span>
    </div>
  );
}
