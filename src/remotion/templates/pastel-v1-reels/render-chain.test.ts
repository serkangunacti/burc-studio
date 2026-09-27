import { createHash } from 'node:crypto';
import { Thumbnail } from '@remotion/player';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnyZodObject } from 'remotion';
import { describe, expect, it } from 'vitest';
import { buildReelsProps } from '@/lib/posts/reels-props';
import { getPostDetail } from '@/lib/posts/repository';
import { brandFromSettings } from '@/lib/posts/slide-props';
import { DEFAULT_SETTINGS } from '@/lib/settings/schema';
import { REELS_FPS, REELS_SIZE, reelsDurationInFrames } from '@/remotion/reels';
import type { ReelsProps } from '@/remotion/slide-types';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { PastelReels } from './reels';

// Dondurma manifesti yalnız bu klasörü korur; zamanlama sabitleri, Satürn işareti ve burç verisi klasör dışında.
// Seçilen karelerin işaretlemesi, eski gönderilerin Reels'inin aynı çizildiğini bu halkalarla birlikte kanıtlar.
const FRAMES = [0, 40, 100, 190, 1000, 1700, 1769];
const GOLDEN: Record<string, string> = {
  kadin: '3e2b3b13a957f97d744a91ba01d35a1c8124d1c07aecc3e34feafd4839da9f24',
  erkek: '8f0df30de1ce7c9632c3e6756f2ff0a968134222c4cad715e0d7358ace213867',
};

describe('pastel@1 Reels çizim zinciri', () => {
  it('örnek gönderilerin seçilen kareleri aynı işaretlemeyle çizilir', async () => {
    const db = await createTestDb();
    const brand = brandFromSettings({ ...DEFAULT_SETTINGS, instagramHandle: 'kozmikarkan' });
    const actual: Record<string, string> = {};
    for (const audience of ['kadin', 'erkek'] as const) {
      const post = await seedPost(db, { date: '2026-09-26', kind: 'horoscope', audience });
      const reels = buildReelsProps((await getPostDetail(db, post.id))!, brand);
      const markup = FRAMES.map((frame) =>
        renderToStaticMarkup(
          createElement(Thumbnail<AnyZodObject, ReelsProps>, {
            component: PastelReels,
            inputProps: reels,
            frameToDisplay: frame,
            durationInFrames: reelsDurationInFrames(reels.signs.length),
            fps: REELS_FPS,
            compositionWidth: REELS_SIZE.width,
            compositionHeight: REELS_SIZE.height,
          }),
        ),
      ).join('\n');
      expect(markup).toContain('data-mark="saturn"');
      expect(markup).toContain('Koç');
      // Kuyruklu harfler (ç, ğ, ş, g, y) tarih satırına binmesin.
      expect(markup).toMatch(/data-slot="sign-name" style="[^"]*line-height:1.25/);
      actual[audience] = createHash('sha256').update(markup).digest('hex');
    }
    expect(actual).toEqual(GOLDEN);
  });
});
