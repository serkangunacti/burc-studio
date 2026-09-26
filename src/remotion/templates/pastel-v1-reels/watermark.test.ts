import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SAMPLE_BRAND } from '@/remotion/fixtures';
import { ReelsHandle, ReelsWatermark } from './watermark';

describe('ReelsWatermark', () => {
  it('kullanıcı adını Satürn işaretiyle yazar; kapalıysa hiçbir şey çizmez', () => {
    const out = renderToStaticMarkup(createElement(ReelsWatermark, { brand: SAMPLE_BRAND }));
    expect(out).toContain('@burc.studio');
    expect(out).toContain('data-mark="saturn"');
    expect(renderToStaticMarkup(createElement(ReelsWatermark, { brand: { ...SAMPLE_BRAND, enabled: false } }))).toBe('');
  });
});

describe('ReelsHandle', () => {
  it('kapanıştaki kullanıcı adını yıldızlı Satürn işaretiyle yazar; ad yoksa kapanış cümlesini yazar', () => {
    const out = renderToStaticMarkup(createElement(ReelsHandle, { brand: SAMPLE_BRAND }));
    expect(out).toContain('@burc.studio');
    expect(out).toContain('data-mark="saturn"');
    expect(renderToStaticMarkup(createElement(ReelsHandle, { brand: { ...SAMPLE_BRAND, handle: null } }))).toBe('Yarın yeni yorumlarla buradayız');
  });
});
