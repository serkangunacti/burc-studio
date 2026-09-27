import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Badge } from '@/components/ui/badge';
import { getDb } from '@/db/client';
import type { PublicationStatus } from '@/db/schema';
import { groupLabel, groupPublications } from '@/lib/automation/day-message';
import { listPublications } from '@/lib/automation/repository';
import { addDays, formatDateLongTr, isDateKey, istanbulDateKey } from '@/lib/date/istanbul';
import { ResendButton } from './resend-button';

export const metadata: Metadata = { title: 'Paylaşımlar' };

const STATUS_TEXT: Record<PublicationStatus, string> = {
  ready: 'Onay bekliyor',
  approved: 'Onaylandı',
  publishing: 'Paylaşılıyor',
  published: 'Paylaşıldı',
  skipped: 'Paylaşılmayacak',
  expired: 'Süresi doldu',
  failed: 'Hata',
};

const clock = (date: Date) => date.toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });

export default async function PublicationsPage(props: PageProps<'/paylasimlar'>) {
  await connection();
  const params = await props.searchParams;
  const today = istanbulDateKey();
  const date = typeof params.tarih === 'string' && isDateKey(params.tarih) ? params.tarih : today;
  const groups = groupPublications(await listPublications(getDb(), date));
  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-4xl">Paylaşımlar</h1>
        <nav aria-label="Gün" className="flex items-center gap-4 text-sm">
          <Link href={`/paylasimlar?tarih=${addDays(date, -1)}`}>← Önceki gün</Link>
          <span className="font-medium">{formatDateLongTr(date)}</span>
          {date < today && <Link href={`/paylasimlar?tarih=${addDays(date, 1)}`}>Sonraki gün →</Link>}
        </nav>
      </div>
      {groups.length === 0 ? (
        <p className="text-muted-foreground">
          {"Bu gün için hazırlanmış paylaşım yok. Paylaşımlar her sabah ~06:10'da hazırlanır ve onay için Telegram'a gönderilir."}
        </p>
      ) : (
        <ul className="divide-y rounded-2xl border">
          {groups.map((group) => (
            <li key={`${group.postId}-${group.format}`} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {clock(group.rows[0].scheduledAt)} · {groupLabel(group)}
                </span>
                <Badge variant={group.status === 'failed' ? 'destructive' : group.status === 'published' ? 'default' : 'secondary'}>{STATUS_TEXT[group.status]}</Badge>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                {group.rows.map((row) => (
                  <span key={row.id} className="text-muted-foreground">
                    {row.format === 'carousel' ? `${row.part}/3 ${clock(row.scheduledAt)}` : clock(row.scheduledAt)}:{' '}
                    {row.permalink ? (
                      <a href={row.permalink} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                        Instagram
                      </a>
                    ) : row.media.videoUrl ? (
                      <a href={row.media.videoUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                        video
                      </a>
                    ) : row.media.imageIds?.[0] ? (
                      <a href={`/api/media/${row.media.imageIds[0]}`} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                        kapak
                      </a>
                    ) : (
                      STATUS_TEXT[row.status]
                    )}
                  </span>
                ))}
              </div>
              {group.rows.map((row) =>
                row.error ? (
                  <p key={`${row.id}-error`} className="text-sm text-destructive">
                    {row.error}
                  </p>
                ) : null,
              )}
            </li>
          ))}
        </ul>
      )}
      {date === today && <ResendButton date={date} />}
    </section>
  );
}
