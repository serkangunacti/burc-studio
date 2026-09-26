import { describe, expect, it } from 'vitest';
import { SAMPLE_COVER, SAMPLE_CTA, sampleSign } from '@/remotion/fixtures';
import { CAPTION_FILE_NAME, postBaseName, reelsFileName, slideFileName, zipFileName } from './file-names';

describe('dosya adları', () => {
  const base = postBaseName({ date: '2026-09-26', kind: 'horoscope', audience: 'kadin' });

  it('gönderi, slayt ve ZIP adlarını tarih, kitle ve sıra numarasıyla üretir', () => {
    expect(base).toBe('2026-09-26_kadin-burc');
    expect(slideFileName(base, 0, SAMPLE_COVER)).toBe('2026-09-26_kadin-burc_01-kapak.jpg');
    expect(slideFileName(base, 5, sampleSign('aslan'))).toBe('2026-09-26_kadin-burc_06-aslan.jpg');
    expect(slideFileName(base, 13, SAMPLE_CTA)).toBe('2026-09-26_kadin-burc_14-kapanis.jpg');
    expect(zipFileName(base)).toBe('2026-09-26_kadin-burc.zip');
    expect(CAPTION_FILE_NAME).toBe('caption.txt');
    expect(reelsFileName(base)).toBe('2026-09-26_kadin-burc_reels.mp4');
  });

  it('özel ve tarot türleri kendi ekini alır', () => {
    expect(postBaseName({ date: '2026-10-01', kind: 'tarot', audience: 'erkek' })).toBe('2026-10-01_erkek-tarot');
    expect(postBaseName({ date: '2026-10-01', kind: 'special', audience: 'genel' })).toBe('2026-10-01_genel-ozel');
    expect(postBaseName({ date: '2026-09-28', kind: 'weekly', audience: 'kadin' })).toBe('2026-09-28_kadin-haftalik');
  });
});
