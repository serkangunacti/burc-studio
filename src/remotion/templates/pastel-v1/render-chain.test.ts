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
  'kadin-4x5': '40148cd8571807812911bbf0a43f5dc5eb8cefffe0ca543c44ea21d0c52fd336',
  'kadin-3x4': 'd13d1489da4b325510bc35f99ce694ff49018e4e36d3b9895787b6dbdab2f240',
  'erkek-4x5': '7756582ce16e43367bf6c1d7abbb6a2967d1bbbe2d41b727ced16e67cf7c06be',
  'erkek-3x4': '232c5810cd2793c2647a6c1e0f176f5d2853e4a9d4924e38ef37d9206b53ab02',
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
