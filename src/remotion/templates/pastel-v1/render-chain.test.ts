import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getPostDetail } from '@/lib/posts/repository';
import { brandFromSettings, buildSlideProps } from '@/lib/posts/slide-props';
import { DEFAULT_SETTINGS } from '@/lib/settings/schema';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { PastelSlide } from './slide';

// Arşivdeki gönderiler bu zincirden yeniden çizilir: gönderi → slayt verisi (renk tablosu, burç verisi, zemin
// varyantı, tarih biçimi) → şablon. Zincirin herhangi bir halkası değişirse eski gönderiler farklı görünür.
const GOLDEN: Record<string, string> = {
  'kadin-4x5': 'da90f61cbe77fbb848512f0f1276227ec35433a809c1a205d3ac42dfac860a6a',
  'kadin-3x4': '4dc7485479b33cead67869cbbb6fdb9ba1b40e351ac66d5937b4918db293a848',
  'erkek-4x5': 'c5d6fdc36ff1a35baaf3e092d9ded051ae2795e68a2ff51d234dbdea92ec9953',
  'erkek-3x4': '55e226b1b3b81adadc24a7c3bafc800b36228f50a42085d319532ccc13c76346',
};

describe('pastel@1 çizim zinciri', () => {
  it('örnek gönderiler aynı işaretlemeyle çizilir', async () => {
    const db = await createTestDb();
    const brand = brandFromSettings({ ...DEFAULT_SETTINGS, instagramHandle: 'kozmikarkan' });
    const actual: Record<string, string> = {};
    for (const audience of ['kadin', 'erkek'] as const) {
      const post = await seedPost(db, { date: '2026-09-26', kind: 'horoscope', audience });
      const slides = buildSlideProps((await getPostDetail(db, post.id))!, brand);
      for (const format of ['4x5', '3x4'] as const) {
        const markup = slides.map((props) => renderToStaticMarkup(createElement(PastelSlide, { ...props, format }))).join('\n');
        actual[`${audience}-${format}`] = createHash('sha256').update(markup).digest('hex');
      }
    }
    expect(actual).toEqual(GOLDEN);
  });
});
