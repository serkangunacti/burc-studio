import { describe, expect, it } from 'vitest';
import { metricsCsv, type MetricsPublication } from './metrics';

const sample: MetricsPublication = {
  id: 'publication-1', date: '2026-10-05', kind: 'tarot', audience: 'erkek', format: 'tiktok', part: 0,
  scheduledAt: new Date('2026-10-05T19:00:00Z'), publishedAt: new Date('2026-10-05T19:17:00Z'),
  status: 'published', permalink: 'https://www.tiktok.com/@kozmikarkan/video/1', caption: 'Günün kartı, "Yıldız"',
};

describe('ücretsiz yayın ölçüm çizelgesi', () => {
  it('24 ve 72 saat kontrolünü gerçek yayın saatinden hesaplar; bilinmeyen metrikler boş kalır', () => {
    const csv = metricsCsv([sample]);
    expect(csv).toContain('"TikTok"');
    expect(csv).toContain('"2026-10-06 22:17 TSİ"');
    expect(csv).toContain('"2026-10-08 22:17 TSİ"');
    expect(csv).toContain('"Günün kartı, ""Yıldız"""');
    expect(csv.split('\r\n')[1]).toMatch(/,"","","","","","","",/);
  });

  it('yayınlanmamış içerik için takip tarihini uydurmaz; hücrede formül çalışmasını önler', () => {
    const csv = metricsCsv([{...sample, publishedAt: null, status: 'failed', permalink: null, caption: '=HYPERLINK("https://x")'}]);
    expect(csv).not.toContain('2026-10-06');
    expect(csv).toContain('"\'=HYPERLINK(""https://x"")"');
  });
});
