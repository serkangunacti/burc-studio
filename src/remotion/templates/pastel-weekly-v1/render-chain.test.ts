import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getPostDetail } from '@/lib/posts/repository';
import { brandFromSettings, buildSlideProps } from '@/lib/posts/slide-props';
import { DEFAULT_SETTINGS } from '@/lib/settings/schema';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { PastelWeeklySlide } from './slide';

// Arşivdeki haftalık gönderiler bu zincirden yeniden çizilir: gönderi → hafta etiketli slayt verisi → şablon.
const GOLDEN: Record<string, string> = {
  'kadin-4x5': '42b2c2f9839278d631f1208b6fc507f5845cff76add73b3015be3de4790e32f0',
  'kadin-3x4': '0fe6f8eabe88198244ad22b206e1eb059365b1f07eff8b0230468e05f6cafc47',
  'erkek-4x5': 'c646d9ad2da31e336e1eae3af7f57502c1a6f4691ef35e9a307a13d3e0991fa8',
  'erkek-3x4': 'c711c850d17791cbfd893068e2bb8933c2ca90c6ca654556297180c7c0d2e210',
};

describe('pastel-weekly@1 çizim zinciri', () => {
  it('örnek haftalık gönderiler aynı işaretlemeyle çizilir', async () => {
    const db = await createTestDb();
    const brand = brandFromSettings({ ...DEFAULT_SETTINGS, instagramHandle: 'kozmikarkan' });
    const actual: Record<string, string> = {};
    for (const audience of ['kadin', 'erkek'] as const) {
      const post = await seedPost(db, { date: '2026-09-28', kind: 'weekly', audience });
      const slides = buildSlideProps((await getPostDetail(db, post.id))!, brand);
      for (const format of ['4x5', '3x4'] as const) {
        const markup = slides.map((props) => renderToStaticMarkup(createElement(PastelWeeklySlide, { ...props, format }))).join('\n');
        actual[`${audience}-${format}`] = createHash('sha256').update(markup).digest('hex');
      }
    }
    expect(actual).toEqual(GOLDEN);
  });
});
