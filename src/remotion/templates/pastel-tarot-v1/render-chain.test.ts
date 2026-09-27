import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getPostDetail } from '@/lib/posts/repository';
import { brandFromSettings, buildSlideProps } from '@/lib/posts/slide-props';
import { DEFAULT_SETTINGS } from '@/lib/settings/schema';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { PastelTarotSlide } from './slide';

// Arşivdeki tarot gönderileri bu zincirden yeniden çizilir: gönderi → kartlı slayt verisi → tarot tasarım sistemi → şablon.
const GOLDEN: Record<string, string> = {
  'kadin-4x5': '0daa75d24cd20e9169b311697f67835253ed97ffbd3ae45eea9d29b30dd01600',
  'kadin-3x4': '597e50981c6263d98a10f3667fd1ff9cbbe1191dcdc0d519826fc9b86986f6bb',
  'erkek-4x5': '290f8f6eb8a352ce1e06125d324a8050cb26b13ba451d179311a766cbef88a32',
  'erkek-3x4': '5fc9c7146f877511da0ec645c014ee4f02360eec0d26660a0fece5ef5f4054bb',
};

describe('pastel-tarot@1 çizim zinciri', () => {
  it('örnek tarot gönderileri aynı işaretlemeyle çizilir', async () => {
    const db = await createTestDb();
    const brand = brandFromSettings({ ...DEFAULT_SETTINGS, instagramHandle: 'kozmikarkan' });
    const actual: Record<string, string> = {};
    for (const audience of ['kadin', 'erkek'] as const) {
      const post = await seedPost(db, { date: '2026-09-27', kind: 'tarot', audience });
      const slides = buildSlideProps((await getPostDetail(db, post.id))!, brand);
      for (const format of ['4x5', '3x4'] as const) {
        const markup = slides.map((props) => renderToStaticMarkup(createElement(PastelTarotSlide, { ...props, format }))).join('\n');
        expect(markup.split('data-card=').length - 1).toBe(12);
        actual[`${audience}-${format}`] = createHash('sha256').update(markup).digest('hex');
      }
    }
    expect(actual).toEqual(GOLDEN);
  });
});
