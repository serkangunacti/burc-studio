import { Card, CardContent } from '@/components/ui/card';
import { OrbitingCircles } from '@/components/ui/orbiting-circles';
import { skyHeadlineTr, type SkySnapshot } from '@/lib/astro/sky';
import { SIGNS, getSign } from '@/lib/zodiac/signs';

export function SkySummary({ sky }: { sky: SkySnapshot }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 sm:flex-row">
        <div aria-hidden className="relative flex size-40 shrink-0 items-center justify-center">
          <OrbitingCircles radius={64} iconSize={22} duration={60}>
            {SIGNS.map((sign) => (
              <span key={sign.slug} className="text-sm text-primary">
                {sign.glyph}
              </span>
            ))}
          </OrbitingCircles>
          <span className="font-heading text-3xl text-primary">{getSign(sky.sunSign).glyph}</span>
        </div>
        <div className="space-y-1 text-center sm:text-left">
          <h2 className="font-heading text-2xl">Günün gökyüzü</h2>
          <p className="text-sm text-muted-foreground">{skyHeadlineTr(sky)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
