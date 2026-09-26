import Link from 'next/link';
import { connection } from 'next/server';
import { DailyPackagePanel } from '@/components/today/daily-package-panel';
import { SkySummary } from '@/components/today/sky-summary';
import { BlurFade } from '@/components/ui/blur-fade';
import { getDb } from '@/db/client';
import { getSkySnapshot } from '@/lib/astro/sky';
import { packageItemsFor } from '@/lib/content/daily-package';
import { getCurrentPostsForDate } from '@/lib/content/repository';
import { addDays, formatDateLongTr, istanbulDateKey } from '@/lib/date/istanbul';
import { getSettings } from '@/lib/settings/repository';
import { cn } from '@/lib/utils';

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { gun } = await searchParams;
  const today = istanbulDateKey();
  const tomorrow = gun === 'yarin';
  const date = tomorrow ? addDays(today, 1) : today;
  const db = getDb();
  const [settings, posts] = await Promise.all([getSettings(db), getCurrentPostsForDate(db, date)]);
  const items = packageItemsFor(date, settings.dailyPlan).map((item) => {
    const post = posts.find((candidate) => candidate.kind === item.kind && candidate.audience === item.audience);
    return { ...item, ready: Boolean(post), postId: post?.id ?? null };
  });

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <BlurFade>
        <p className="text-sm text-muted-foreground">{formatDateLongTr(date)}</p>
        <h1 className="font-heading text-4xl">{tomorrow ? 'Yarın' : 'Bugün'}</h1>
        <nav aria-label="Gün seçimi" className="mt-3 flex gap-2 text-sm">
          <Link href="/" className={cn('rounded-full px-3 py-1', !tomorrow && 'bg-secondary font-semibold')}>
            Bugün
          </Link>
          <Link href="/?gun=yarin" className={cn('rounded-full px-3 py-1', tomorrow && 'bg-secondary font-semibold')}>
            Yarın
          </Link>
        </nav>
      </BlurFade>
      <BlurFade delay={0.1}>
        <SkySummary sky={getSkySnapshot(date)} />
      </BlurFade>
      <BlurFade delay={0.2}>
        <DailyPackagePanel date={date} items={items} />
      </BlurFade>
    </section>
  );
}
