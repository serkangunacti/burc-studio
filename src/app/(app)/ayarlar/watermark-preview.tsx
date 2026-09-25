import { cn } from '@/lib/utils';
import type { WatermarkPosition } from '@/lib/settings/schema';

export function WatermarkPreview({
  handle,
  enabled,
  position,
  opacity,
}: {
  handle: string | null;
  enabled: boolean;
  position: WatermarkPosition;
  opacity: number;
}) {
  return (
    <figure
      aria-label="Filigran önizlemesi"
      className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-secondary to-accent shadow-sm"
    >
      <div className="absolute inset-x-6 top-8 space-y-3">
        <p className="font-heading text-3xl">Koç</p>
        <div className="h-2 w-3/4 rounded-full bg-white/70" />
        <div className="h-2 w-2/3 rounded-full bg-white/70" />
        <div className="h-2 w-1/2 rounded-full bg-white/70" />
      </div>
      {enabled && handle && (
        <span
          data-testid="watermark"
          className={cn(
            'absolute bottom-3 text-[11px] tracking-wide text-erik',
            position === 'bottom-center' ? 'left-1/2 -translate-x-1/2' : 'right-4',
          )}
          style={{ opacity }}
        >
          @{handle}
        </span>
      )}
    </figure>
  );
}
