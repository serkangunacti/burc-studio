import { Badge } from '@/components/ui/badge';
import { MagicCard } from '@/components/ui/magic-card';
import { getLuckyColor } from '@/lib/content/lucky-colors';
import type { ReadingRow } from '@/lib/content/repository';
import type { Audience } from '@/lib/content/types';
import { getSign } from '@/lib/zodiac/signs';
import { RegenerateSignButton } from './regenerate-sign-button';

function Stars({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd aria-label={`${label} ${value}/5`} className="text-sm tracking-widest text-primary">
        {'★'.repeat(value)}
        <span className="text-muted">{'★'.repeat(5 - value)}</span>
      </dd>
    </div>
  );
}

export function SignCard({ reading, audience }: { reading: ReadingRow; audience: Audience }) {
  const sign = getSign(reading.sign);
  const color = getLuckyColor(reading.meta.luckyColor);
  return (
    <MagicCard className="rounded-2xl" gradientFrom="#c8b6e2" gradientTo="#f4c2c2">
      <article aria-labelledby={`burc-${sign.slug}`} className="flex h-full flex-col gap-3 p-5">
        <header className="flex items-baseline justify-between gap-2">
          <h2 id={`burc-${sign.slug}`} className="font-heading text-2xl">
            <span aria-hidden className="mr-2 text-primary">
              {sign.glyph}
            </span>
            {sign.name}
          </h2>
          <span className="text-xs text-muted-foreground">{sign.dateRange}</span>
        </header>
        <h3 className="font-semibold">{reading.headline}</h3>
        <p className="text-sm leading-relaxed">{reading.body}</p>
        <p className="text-sm text-muted-foreground italic">{reading.short}</p>
        <dl className="grid gap-1">
          <Stars label="Aşk" value={reading.meta.scores.love} />
          <Stars label="Para" value={reading.meta.scores.money} />
          <Stars label="Sağlık" value={reading.meta.scores.health} />
        </dl>
        <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
          <span className="flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-full border" style={{ backgroundColor: color.hex }} />
            {color.name} · Şanslı sayı {reading.meta.luckyNumber}
          </span>
          <Badge variant="outline">{reading.provider}</Badge>
          <RegenerateSignButton date={reading.date} audience={audience} sign={sign.slug} name={sign.name} />
        </footer>
      </article>
    </MagicCard>
  );
}
