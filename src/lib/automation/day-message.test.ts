import { describe, expect, it } from 'vitest';
import type { PublicationRow } from './repository';
import { buildDayMessage, groupPublications, parseDayAction } from './day-message';

const POST = '11111111-2222-3333-4444-555555555555';
const OTHER = '66666666-7777-8888-9999-000000000000';

function row(overrides: Partial<PublicationRow>): PublicationRow {
  return {
    id: crypto.randomUUID(),
    date: '2026-09-29',
    postId: POST,
    kind: 'horoscope',
    audience: 'kadin',
    format: 'carousel',
    part: 1,
    scheduledAt: new Date('2026-09-29T05:30:00Z'),
    status: 'ready',
    caption: 'cap',
    media: { imageIds: ['img-1'] },
    igContainerId: null,
    igMediaId: null,
    permalink: null,
    error: null,
    attempts: 0,
    telegramMessageId: null,
    approvedAt: null,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const ROWS = [
  row({ part: 3, scheduledAt: new Date('2026-09-29T05:30:00Z') }),
  row({ part: 2, scheduledAt: new Date('2026-09-29T05:33:00Z') }),
  row({ part: 1, scheduledAt: new Date('2026-09-29T05:36:00Z'), media: { imageIds: ['cover-1'] } }),
  row({ postId: OTHER, audience: 'erkek', kind: 'tarot', format: 'reels', part: 0, scheduledAt: new Date('2026-09-29T19:00:00Z'), media: { videoUrl: 'https://blob/v.mp4' } }),
];
const mediaUrl = (id: string) => `https://app/api/media/${id}`;

describe('günlük onay mesajı', () => {
  it('carousel parçalarını tek grupta, saat sırasıyla toplar', () => {
    const groups = groupPublications(ROWS);
    expect(groups.map((group) => [group.format, group.rows.length, group.status])).toEqual([
      ['carousel', 3, 'ready'],
      ['reels', 1, 'ready'],
    ]);
  });

  it('bekleyen gün için satırları, önizleme bağlantılarını ve onay düğmelerini gösterir', () => {
    const { html, keyboard } = buildDayMessage('2026-09-29', ROWS, { mediaUrl, failures: ['tarot-kadin: <zaman aşımı>'] });
    expect(html).toContain('29 Eylül 2026 Salı');
    expect(html).toContain('08:30 🕒 Kadın günlük burç · carousel (3 parça) · <a href="https://app/api/media/cover-1">kapak</a>');
    expect(html).toContain('22:00 🕒 Erkek tarot · Reels · <a href="https://blob/v.mp4">izle</a>');
    expect(html).toContain('• tarot-kadin: &lt;zaman aşımı&gt;');
    expect(keyboard).toEqual([
      [{ text: '✅ Hepsini onayla', callback_data: 'a:2026-09-29' }],
      [{ text: '🚫 08:30 Kadın burç carousel', callback_data: `s:${POST}:c` }],
      [{ text: '🚫 22:00 Erkek tarot Reels', callback_data: `s:${OTHER}:r` }],
    ]);
    expect(keyboard.flat().every((button) => 'callback_data' in button && Buffer.byteLength(button.callback_data) <= 64)).toBe(true);
  });

  it('onaydan sonra onay düğmesini kaldırır; atlananlar için geri alma, paylaşılanlar için bağlantı gösterir', () => {
    const rows = [
      ...ROWS.slice(0, 3).map((item, index) => ({ ...item, status: 'published' as const, permalink: `https://instagram.com/p/${index}` })),
      { ...ROWS[3], status: 'skipped' as const },
    ];
    const { html, keyboard } = buildDayMessage('2026-09-29', rows, { mediaUrl });
    expect(html).toContain('📤 Kadın günlük burç · carousel (3 parça) · <a href="https://instagram.com/p/0">1</a>');
    expect(keyboard).toEqual([[{ text: '↩️ 22:00 Erkek tarot Reels geri al', callback_data: `u:${OTHER}:r` }]]);
  });

  it('düğme verisini çözer, bozuk veriyi reddeder', () => {
    expect(parseDayAction('a:2026-09-29')).toEqual({ action: 'approve', date: '2026-09-29' });
    expect(parseDayAction(`s:${POST}:r`)).toEqual({ action: 'skip', postId: POST, format: 'reels' });
    expect(parseDayAction(`u:${POST}:c`)).toEqual({ action: 'undo', postId: POST, format: 'carousel' });
    for (const bad of ['a:2026-13-40', `s:${POST}:x`, 's:abc:c', '', undefined]) expect(parseDayAction(bad)).toBeNull();
  });
});
