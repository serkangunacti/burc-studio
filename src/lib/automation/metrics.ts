import type { PublicationRow } from './repository';

export type MetricsPublication = Pick<PublicationRow, 'id' | 'date' | 'kind' | 'audience' | 'format' | 'part' | 'scheduledAt' | 'publishedAt' | 'status' | 'permalink' | 'caption'>;

const metricNames = ['görüntülenme', 'ortalama izleme sn', 'tamamlanma %', 'kaydetme', 'paylaşma', 'yeni takipçi', 'not'];
const columns = ['yayın kimliği', 'içerik tarihi', 'platform', 'tür', 'hedef kitle', 'format', 'parça', 'durum', 'planlanan TSİ', 'yayınlanan TSİ', 'gönderi bağlantısı', 'açıklama', '24 saat kontrolü', ...metricNames.map(name => `24s ${name}`), '72 saat kontrolü', ...metricNames.map(name => `72s ${name}`)];

function localClock(value: Date | null): string {
  if (!value) return '';
  const shifted = new Date(value.getTime() + 3 * 60 * 60_000).toISOString();
  return `${shifted.slice(0, 10)} ${shifted.slice(11, 16)} TSİ`;
}

function cell(value: string | number): string {
  const text = String(value);
  // Spreadsheet applications must treat captions and URLs as text.
  const safe = /^[\s]*[=+@-]/u.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function metricsCsv(rows: readonly MetricsPublication[]): string {
  const emptyMetrics = metricNames.map(() => '');
  const lines = rows.map(row => {
    const checkAt = (hours: number) => localClock(row.publishedAt ? new Date(row.publishedAt.getTime() + hours * 60 * 60_000) : null);
    return [row.id, row.date, row.format === 'tiktok' ? 'TikTok' : 'Instagram', row.kind, row.audience, row.format, row.part, row.status,
      localClock(row.scheduledAt), localClock(row.publishedAt), row.permalink ?? '', row.caption,
      checkAt(24), ...emptyMetrics, checkAt(72), ...emptyMetrics];
  });
  return '\ufeff' + [columns, ...lines].map(line => line.map(cell).join(',')).join('\r\n') + '\r\n';
}
