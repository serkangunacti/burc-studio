import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SAMPLE_BRAND } from '@/remotion/fixtures';
import { ReelsWatermark } from './watermark';

describe('ReelsWatermark', () => {
  it('kullanıcı adını Satürn işaretiyle yazar; kapalıysa hiçbir şey çizmez', () => {
    const out = renderToStaticMarkup(createElement(ReelsWatermark, { brand: SAMPLE_BRAND }));
    expect(out).toContain('@burc.studio');
    expect(out).toContain('data-mark="saturn"');
    expect(renderToStaticMarkup(createElement(ReelsWatermark, { brand: { ...SAMPLE_BRAND, enabled: false } }))).toBe('');
  });
});
