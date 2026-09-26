import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { SignCard } from '@/components/signs/sign-card';
import { buttonVariants } from '@/components/ui/button';
import { getDb } from '@/db/client';
import { isAllowedGenerationDate } from '@/lib/content/dates';
import { getCurrentReadings } from '@/lib/content/repository';
import { AUDIENCE_LABELS, type Audience } from '@/lib/content/types';
import { addDays, formatDateLongTr, istanbulDateKey } from '@/lib/date/istanbul';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Burçlar' };

export default async function SignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const today = istanbulDateKey();
  const date = isAllowedGenerationDate(params.tarih, today) ? params.tarih : today;
  const audience: Audience = params.kitle === 'erkek' ? 'erkek' : 'kadin';
  const readings = await getCurrentReadings(getDb(), { date, kind: 'horoscope', audience });
  const href = (nextDate: string, nextAudience: Audience) => `/burclar?tarih=${nextDate}&kitle=${nextAudience}`;
  const previous = addDays(date, -1);
  const next = addDays(date, 1);

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">{formatDateLongTr(date)}</p>
        <h1 className="font-heading text-4xl">Günlük burç yorumları</h1>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Okur kitlesi" className="flex gap-2">
            {(['kadin', 'erkek'] as const).map((value) => (
              <Link
                key={value}
                href={href(date, value)}
                aria-current={audience === value ? 'page' : undefined}
                className={cn('rounded-full px-4 py-1.5 text-sm', audience === value ? 'bg-primary text-primary-foreground' : 'bg-secondary')}
              >
                {AUDIENCE_LABELS[value]}
              </Link>
            ))}
          </nav>
          <nav aria-label="Gün" className="ml-auto flex gap-2">
            {isAllowedGenerationDate(previous, today) && (
              <Link href={href(previous, audience)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                ← Önceki gün
              </Link>
            )}
            {isAllowedGenerationDate(next, today) && (
              <Link href={href(next, audience)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Sonraki gün →
              </Link>
            )}
          </nav>
        </div>
      </header>
      {readings.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
          Bu gün için {AUDIENCE_LABELS[audience].toLocaleLowerCase('tr-TR')} yorumları henüz üretilmedi. Bugün sayfasından paketi oluşturabilirsin.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {readings.map((reading) => (
            <SignCard key={reading.id} reading={reading} audience={audience} />
          ))}
        </div>
      )}
    </section>
  );
}
