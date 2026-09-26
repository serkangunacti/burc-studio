import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { SlideThumbnail } from '@/components/post/slide-thumbnail';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { getDb } from '@/db/client';
import { AUDIENCE_LABELS, postTitle } from '@/lib/content/types';
import { formatDateLongTr, formatDateShortTr, isDateKey } from '@/lib/date/istanbul';
import { listArchivePage, type PostStatus } from '@/lib/posts/repository';
import { audienceOf, brandFromSettings, buildCoverProps } from '@/lib/posts/slide-props';
import { STATUS_LABELS } from '@/lib/posts/summary';
import { getSettings } from '@/lib/settings/repository';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Arşiv' };

const PAGE_SIZE = 30;
const STATUS_FILTERS: PostStatus[] = ['taslak', 'indirildi', 'paylasildi'];
const KIND_FILTERS = { gunluk: 'horoscope', haftalik: 'weekly' } as const;
type Filters = { tur?: string; kitle?: string; durum?: string; once?: string };

function archiveHref(filters: Filters): string {
  const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const text = query.toString();
  return text ? `/arsiv?${text}` : '/arsiv';
}

function FilterNav({ label, options, active, href }: { label: string; options: [string | undefined, string][]; active: string | undefined; href: (value: string | undefined) => string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      {options.map(([value, text]) => (
        <Link
          key={text}
          href={href(value)}
          aria-current={active === value ? 'page' : undefined}
          className={cn('rounded-full px-3 py-1', active === value ? 'bg-primary text-primary-foreground' : 'bg-secondary')}
        >
          {text}
        </Link>
      ))}
    </nav>
  );
}

export default async function ArchivePage(props: PageProps<'/arsiv'>) {
  await connection();
  const params = await props.searchParams;
  const tur = params.tur === 'gunluk' || params.tur === 'haftalik' ? params.tur : undefined;
  const kitle = params.kitle === 'kadin' || params.kitle === 'erkek' ? params.kitle : undefined;
  const durum = STATUS_FILTERS.find((value) => value === params.durum);
  const once = isDateKey(params.once) ? params.once : undefined;
  const db = getDb();
  const [settings, page] = await Promise.all([
    getSettings(db),
    listArchivePage(db, { kind: tur ? KIND_FILTERS[tur] : undefined, audience: kitle, status: durum, before: once }, PAGE_SIZE),
  ]);
  const items = page.posts;
  const brand = brandFromSettings(settings);
  const dates = [...new Set(items.map((post) => post.date))];

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-3">
        <h1 className="font-heading text-4xl">Arşiv</h1>
        <FilterNav
          label="Tür"
          options={[[undefined, 'Tümü'], ['gunluk', 'Günlük'], ['haftalik', 'Haftalık']]}
          active={tur}
          href={(value) => archiveHref({ tur: value, kitle, durum })}
        />
        <FilterNav
          label="Kitle"
          options={[[undefined, 'Tümü'], ['kadin', 'Kadın'], ['erkek', 'Erkek']]}
          active={kitle}
          href={(value) => archiveHref({ tur, kitle: value, durum })}
        />
        <FilterNav
          label="Durum"
          options={[[undefined, 'Tümü'], ...STATUS_FILTERS.map((value): [string, string] => [value, STATUS_LABELS[value]])]}
          active={durum}
          href={(value) => archiveHref({ tur, kitle, durum: value })}
        />
      </header>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">Bu süzgeçle eşleşen gönderi yok.</p>
      ) : (
        dates.map((date) => (
          <div key={date} className="space-y-3">
            <h2 className="font-heading text-2xl">{formatDateLongTr(date)}</h2>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items
                .filter((post) => post.date === date)
                .map((post) => {
                  const audience = audienceOf(post);
                  return (
                    <li key={post.id}>
                      <Link
                        href={`/gonderi/${post.id}`}
                        aria-label={`${formatDateShortTr(post.date)} · ${postTitle(post.kind, audience)}`}
                        className="block space-y-2 rounded-2xl border bg-card p-2 transition-colors hover:border-primary"
                      >
                        <SlideThumbnail templateVersion={post.templateVersion} props={buildCoverProps(post, brand)} />
                        <span className="flex items-center justify-between gap-2 px-1 text-sm">
                          <span className="font-medium">
                            {AUDIENCE_LABELS[audience]}
                            {post.kind === 'weekly' && ' · Haftalık'} · Sürüm {post.version}
                          </span>
                          <Badge variant="outline">{STATUS_LABELS[post.status]}</Badge>
                        </span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))
      )}
      {page.nextBefore && (
        <Link href={archiveHref({ tur, kitle, durum, once: page.nextBefore })} className={buttonVariants({ variant: 'outline' })}>
          Daha eski
        </Link>
      )}
    </section>
  );
}
