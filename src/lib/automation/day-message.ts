import type { PublicationFormat, PublicationStatus } from '@/db/schema';
import { formatDateLongTr, isDateKey, type DateKey } from '@/lib/date/istanbul';
import { escapeHtml, type InlineKeyboard } from '@/lib/telegram/client';
import type { PublicationRow } from './repository';

const KIND_LABELS: Record<string, string> = { horoscope: 'günlük burç', tarot: 'tarot', weekly: 'haftalık burç' };
const KIND_SHORT: Record<string, string> = { horoscope: 'burç', tarot: 'tarot', weekly: 'haftalık' };
const AUDIENCE_LABELS: Record<string, string> = { kadin: 'Kadın', erkek: 'Erkek' };
const STATUS_ICONS: Record<PublicationStatus, string> = {
  ready: '🕒',
  approved: '✅',
  publishing: '⏳',
  published: '📤',
  skipped: '🚫',
  expired: '⌛',
  failed: '❌',
};
const FORMAT_CODES: Record<PublicationFormat, string> = { carousel: 'c', reels: 'r', tiktok: 't' };
const FORMAT_NAMES: Record<PublicationFormat, string> = { carousel: 'carousel', reels: 'Reels & Shorts', tiktok: 'TikTok' };

export type PublicationGroup = { postId: string; kind: string; audience: string; format: PublicationFormat; rows: PublicationRow[]; status: PublicationStatus };

const clock = (date: Date) => date.toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });

function groupStatus(rows: readonly PublicationRow[]): PublicationStatus {
  const statuses = new Set(rows.map((row) => row.status));
  for (const status of ['failed', 'publishing', 'approved', 'ready'] as const) if (statuses.has(status)) return status;
  if (statuses.has('published')) return 'published';
  return statuses.has('skipped') ? 'skipped' : 'expired';
}

// Kullanıcı carousel'in üç parçasını tek karar olarak görür: bir gönderi × biçim bir gruptur.
export function groupPublications(rows: readonly PublicationRow[]): PublicationGroup[] {
  const groups = new Map<string, PublicationRow[]>();
  for (const row of [...rows].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())) {
    const key = `${row.postId}:${row.format}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].map((group) => ({
    postId: group[0].postId,
    kind: group[0].kind,
    audience: group[0].audience,
    format: group[0].format,
    rows: group,
    status: groupStatus(group),
  }));
}

function groupTitle(group: PublicationGroup): string {
  const format = group.format === 'carousel' ? `carousel (${group.rows.length} parça)` : FORMAT_NAMES[group.format];
  return `${AUDIENCE_LABELS[group.audience]} ${KIND_LABELS[group.kind]} · ${format}`;
}

export function groupLabel(group: Pick<PublicationGroup, 'audience' | 'kind' | 'format'>): string {
  return `${AUDIENCE_LABELS[group.audience]} ${KIND_SHORT[group.kind]} ${FORMAT_NAMES[group.format]}`;
}

function groupLinks(group: PublicationGroup, mediaUrl: (id: string) => string): string {
  const published = group.rows.filter((row) => row.permalink);
  if (published.length > 0) return published.map((row, index) => `<a href="${escapeHtml(row.permalink!)}">${published.length > 1 ? index + 1 : 'gönderi'}</a>`).join(' ');
  const first = group.rows.find((row) => row.part <= 1) ?? group.rows[0];
  if (first.media.videoUrl) return `<a href="${escapeHtml(first.media.videoUrl)}">izle</a>`;
  const cover = first.media.imageIds?.[0];
  return cover ? `<a href="${escapeHtml(mediaUrl(cover))}">kapak</a>` : '';
}

export function buildDayMessage(
  date: DateKey,
  rows: readonly PublicationRow[],
  options: { mediaUrl: (id: string) => string; failures?: readonly string[] },
): { html: string; keyboard: InlineKeyboard } {
  const groups = groupPublications(rows);
  const lines = groups.map((group) => {
    const links = groupLinks(group, options.mediaUrl);
    const failed = group.rows.find((row) => row.status === 'failed')?.error;
    return [
      `${clock(group.rows[0].scheduledAt)} ${STATUS_ICONS[group.status]} ${groupTitle(group)}${links ? ` · ${links}` : ''}`,
      ...(failed ? [`    <i>${escapeHtml(failed.slice(0, 200))}</i>`] : []),
    ].join('\n');
  });
  const pending = groups.some((group) => group.status === 'ready');
  const footer = pending
    ? "Onaylarsan her paylaşım saatinde Instagram'a gider. İstemediğini 🚫 ile çıkarabilirsin."
    : groups.some((group) => group.status === 'approved')
      ? '✅ Onaylandı; paylaşımlar saatinde gidecek.'
      : '';
  const failures = options.failures?.length ? [`⚠️ Hazırlanamadı:\n${options.failures.map((failure) => `• ${escapeHtml(failure)}`).join('\n')}`] : [];
  const html = [`<b>🔮 ${formatDateLongTr(date)} · paylaşım planı</b>`, lines.join('\n') || 'Bugün için hazır paylaşım yok.', ...failures, footer]
    .filter(Boolean)
    .join('\n\n');

  const keyboard: InlineKeyboard = pending ? [[{ text: '✅ Hepsini onayla', callback_data: `a:${date}` }]] : [];
  for (const group of groups) {
    const time = clock(group.rows[0].scheduledAt);
    const code = FORMAT_CODES[group.format];
    if (group.status === 'ready' || group.status === 'approved') {
      keyboard.push([{ text: `🚫 ${time} ${groupLabel(group)}`, callback_data: `s:${group.postId}:${code}` }]);
    } else if (group.status === 'failed') {
      keyboard.push([{ text: `🔁 ${time} ${groupLabel(group)} yeniden dene`, callback_data: `y:${group.postId}:${code}` }]);
    } else if (group.status === 'skipped') {
      keyboard.push([{ text: `↩️ ${time} ${groupLabel(group)} geri al`, callback_data: `u:${group.postId}:${code}` }]);
    }
  }
  return { html, keyboard };
}

export type DayAction = { action: 'approve'; date: DateKey } | { action: 'skip' | 'undo' | 'retry'; postId: string; format: PublicationFormat };
const GROUP_ACTIONS = { s: 'skip', u: 'undo', y: 'retry' } as const;

export function parseDayAction(data: string | undefined): DayAction | null {
  const [action, target, code] = (data ?? '').split(':');
  if (action === 'a' && isDateKey(target)) return { action: 'approve', date: target };
  const format = (Object.keys(FORMAT_CODES) as PublicationFormat[]).find((candidate) => FORMAT_CODES[candidate] === code) ?? null;
  const groupAction = GROUP_ACTIONS[action as keyof typeof GROUP_ACTIONS];
  if (groupAction && format && /^[0-9a-f-]{36}$/.test(target ?? '')) return { action: groupAction, postId: target, format };
  return null;
}
