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
  'kadin-4x5': '4f9c819853a4c2f5818a882dc40982adc27974f49523479c6da6dc2b247a87db',
  'kadin-3x4': '3603c5819a1610cf5c4e9dc47fe2cf15bd8328ef1f6e56d3dfaa791e974ff609',
  'erkek-4x5': '140d1d55c59f7a877dc3a4327b97e7de1774271a0810ff658e69c5c8b25436a5',
  'erkek-3x4': 'e4e65ed86514194527aa2d1e7f5df356beb748eb5b84e7270b5959c7e15fb52f',
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
