import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SIGN_SLUGS } from '@/lib/zodiac/signs';
import { LONGEST_BODY, SAMPLE_BRAND, SAMPLE_COVER, SAMPLE_CTA, sampleProps, sampleSign } from '@/remotion/fixtures';
import type { SlideProps } from '@/remotion/slide-types';
import { getTemplate } from '@/remotion/templates';
import { PastelSlide } from './slide';
import { ZODIAC_PATHS } from './zodiac';

const html = (props: SlideProps) => renderToStaticMarkup(createElement(PastelSlide, props));
const count = (text: string, needle: string) => text.split(needle).length - 1;

describe('pastel@1', () => {
  it('kapak tarih, kitle, kanca ve 12 burç sembolünü içerir', () => {
    const out = html(sampleProps(SAMPLE_COVER));
    expect(out).toContain('26 EYLÜL 2026 CUMARTESİ');
    expect(out).toContain('KADIN');
    expect(out).toContain(SAMPLE_COVER.hook);
    expect(count(out, 'data-sign=')).toBe(12);
  });

  it('burç slaytı adı, tarihleri, metinleri, puanları ve şansları gösterir', () => {
    const out = html(sampleProps(sampleSign('koc')));
    for (const text of ['26 EYLÜL', 'Koç', '21 Mart – 19 Nisan', 'Işıltılı ve cesur bir gün', 'Lila', 'Şanslı sayı']) {
      expect(out).toContain(text);
    }
    expect(count(out, 'data-sign=')).toBe(1);
    expect(count(out, 'data-star="full"')).toBe(12);
    expect(count(out, 'data-star="empty"')).toBe(3);
    for (const audience of ['kadin', 'erkek'] as const) {
      expect(html(sampleProps(sampleSign('oglak', audience)))).not.toContain('GÜNLÜK BURÇ');
    }
  });

  it('filigran yalnızca açık ve kullanıcı adı varken görünür; kapanışta kullanıcı adı bir kez yazılır', () => {
    expect(html(sampleProps(sampleSign()))).toContain('@burc.studio');
    expect(html(sampleProps(sampleSign(), { brand: { ...SAMPLE_BRAND, enabled: false } }))).not.toContain('@burc.studio');
    expect(html(sampleProps(sampleSign(), { brand: { ...SAMPLE_BRAND, handle: null } }))).not.toContain('data-slot="watermark"');
    expect(count(html(sampleProps(SAMPLE_CTA)), '@burc.studio')).toBe(1);
    expect(html(sampleProps(SAMPLE_CTA, { brand: { ...SAMPLE_BRAND, handle: null } }))).toContain('Yarın yeni yorumlarla buradayız');
  });

  it('yorum uzadıkça yazı küçülür; 3:4 formatta yükseklik 1440 olur', () => {
    expect(html(sampleProps(sampleSign()))).toContain('font-size:35px');
    expect(html(sampleProps({ ...sampleSign('yay'), body: LONGEST_BODY }))).toContain('font-size:32px');
    expect(html(sampleProps({ ...sampleSign(), body: 'Kısa ve net bir gün.' }))).toContain('font-size:38px');
    expect(html(sampleProps(sampleSign(), { format: '3x4' }))).toContain('height:1440px');
  });

  it('kapak cümlesi uzadıkça küçülür', () => {
    expect(html(sampleProps({ ...SAMPLE_COVER, hook: 'Bugün yıldızlar senden yana ✨' }))).toContain('font-size:52px');
    expect(html(sampleProps({ ...SAMPLE_COVER, hook: 'Koç dolunayı geldi, sen hazır mısın? 🌕' }))).toContain('font-size:46px');
    expect(html(sampleProps({ ...SAMPLE_COVER, hook: 'Koç Dolunayı Geldi! Hayatında Neler Değişiyor? 🌕' }))).toContain('font-size:40px');
  });

  it('çizim konumları tam piksel; kök stil sayfadan miras alınan yazı ayarlarını sabitler', () => {
    const cover = html(sampleProps(SAMPLE_COVER));
    expect(cover).not.toMatch(/(left|top):-?\d+\.\d+px/);
    for (const out of [cover, html(sampleProps(sampleSign()))]) {
      expect(out).toContain('text-align:left');
      expect(out).toContain('font-style:normal');
      expect(out).toContain('letter-spacing:normal');
    }
  });

  it('zemin gönderinin varyantına göre döner; yedi zemin sırayla tekrar eder', () => {
    expect(html(sampleProps(sampleSign(), { variant: 0 }))).toContain('#F4C2C2');
    expect(html(sampleProps(sampleSign(), { variant: 2 }))).toContain('#FFD1B3');
    expect(html(sampleProps(SAMPLE_COVER, { variant: 9 }))).toBe(html(sampleProps(SAMPLE_COVER, { variant: 2 })));
    expect(html(sampleProps(SAMPLE_COVER, { variant: 3 }))).not.toBe(html(sampleProps(SAMPLE_COVER, { variant: 4 })));
  });

  it('12 burcun çizimi var; şablon kaydı sürümle çözülür', () => {
    expect(Object.keys(ZODIAC_PATHS).sort()).toEqual([...SIGN_SLUGS].sort());
    expect(getTemplate('pastel@1').Slide).toBe(PastelSlide);
    expect(() => getTemplate('yok@9')).toThrow('Bilinmeyen şablon: yok@9');
  });
});
