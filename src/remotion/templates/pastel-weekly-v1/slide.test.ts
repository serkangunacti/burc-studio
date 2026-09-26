import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LONGEST_WEEKLY_BODY, SAMPLE_COVER, SAMPLE_CTA, sampleProps, sampleSign } from '@/remotion/fixtures';
import type { SlideProps } from '@/remotion/slide-types';
import { getTemplate } from '@/remotion/templates';
import { PastelWeeklySlide } from './slide';

const WEEK = '28 EYLÜL – 4 EKİM';
const html = (props: SlideProps) => renderToStaticMarkup(createElement(PastelWeeklySlide, props));
const count = (text: string, needle: string) => text.split(needle).length - 1;

describe('pastel-weekly@1', () => {
  it('şablon kaydında haftalık slaytı verir', () => {
    expect(getTemplate('pastel-weekly@1').Slide).toBe(PastelWeeklySlide);
  });

  it('kapak "Haftalık" başlığı, hafta aralığı, kitle, kanca ve 12 burç sembolünü içerir', () => {
    const out = html(sampleProps({ ...SAMPLE_COVER, dateLabel: WEEK }));
    expect(out).toContain('Haftalık');
    expect(out).not.toContain('Günlük');
    expect(out).toContain(WEEK);
    expect(out).toContain('KADIN');
    expect(out).toContain(SAMPLE_COVER.hook);
    expect(count(out, 'data-sign=')).toBe(12);
  });

  it('burç kartı hafta aralığını, uzun yorumu ve şansları gösterir; puan yıldızı yoktur', () => {
    const out = html(sampleProps({ ...sampleSign('koc'), dateLabel: WEEK, body: LONGEST_WEEKLY_BODY }));
    for (const text of [WEEK, 'Koç', '21 Mart – 19 Nisan', 'Işıltılı ve cesur bir gün', 'Lila', 'Şanslı sayı']) expect(out).toContain(text);
    expect(out).toContain('font-size:28px');
    expect(out).not.toContain('data-star=');
    expect(html(sampleProps({ ...sampleSign('koc'), dateLabel: WEEK, body: LONGEST_WEEKLY_BODY.slice(0, 650) }))).toContain('font-size:30px');
  });

  it('filigran ve kapanış günlük şablonla aynı marka öğelerini kullanır', () => {
    expect(count(html(sampleProps({ ...sampleSign(), dateLabel: WEEK })), 'data-mark="saturn"')).toBe(1);
    expect(count(html(sampleProps(SAMPLE_CTA)), 'data-mark="saturn"')).toBe(1);
  });
});
