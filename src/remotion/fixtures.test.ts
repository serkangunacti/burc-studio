import { describe, expect, it } from 'vitest';
import { countEmoji, graphemeLength } from '@/lib/text/turkish';
import { LONGEST_BODY, SAMPLE_BODY, SAMPLE_COVER, sampleProps, sampleSign } from './fixtures';

describe('örnek slayt verileri', () => {
  it('metin uzunlukları tasarımın sınır durumlarını kapsar', () => {
    expect(graphemeLength(SAMPLE_BODY)).toBe(310);
    expect(graphemeLength(LONGEST_BODY)).toBe(420);
    expect(countEmoji(LONGEST_BODY)).toBe(2);
    expect(graphemeLength(SAMPLE_COVER.hook)).toBeLessThanOrEqual(60);
  });

  it('burç örneği burç verisinden, varsayılan props 4:5 formattan gelir', () => {
    expect(sampleSign('oglak', 'erkek')).toMatchObject({ signName: 'Oğlak', dateRange: '22 Aralık – 19 Ocak', element: 'toprak', audience: 'erkek' });
    expect(sampleProps(SAMPLE_COVER)).toMatchObject({ format: '4x5', brand: { handle: 'burc.studio', enabled: true } });
    expect(sampleProps(SAMPLE_COVER, { format: '3x4' }).format).toBe('3x4');
  });
});
