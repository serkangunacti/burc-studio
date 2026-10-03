import { getCurrentPostsForDate } from '@/lib/content/repository';
import { packageItemsFor } from '@/lib/content/daily-package';
import type { DateKey } from '@/lib/date/istanbul';
import { musicSeed } from '@/lib/music/compose';
import { buildReelsProps } from '@/lib/posts/reels-props';
import { getPostDetail } from '@/lib/posts/repository';
import { brandFromSettings, buildSlideProps } from '@/lib/posts/slide-props';
import { getSettings } from '@/lib/settings/repository';
import type { Db } from '@/db/types';
import type { ReelsProps, SlideProps } from '@/remotion/slide-types';
import { splitCarousel } from './carousel';
import { planPublications, type PlannedPublication } from './plan';
import { listPublications, savePublication } from './repository';
import { automationStartReason } from './start';

export type Renderers = {
  renderStills: (templateVersion: string, slides: SlideProps[]) => Promise<Uint8Array[]>;
  // Videoyu üretip herkese açık adresini döndürür.
  renderReels: (input: { templateVersion: string; reels: ReelsProps; musicSeed: number; name: string }) => Promise<string | { videoUrl: string; isAiGenerated?: boolean }>;
};

export type RenderDayResult = { rendered: string[]; kept: string[]; failures: string[] };

const slotKey = (item: { kind: string; audience: string; format: string; part: number }) => `${item.kind}-${item.audience}-${item.format}-${item.part}`;

// Cron'un üretmesi beklenen ama henüz gönderisi olmayan kalemler.
export async function missingPosts(db: Db, date: DateKey): Promise<string[]> {
  const settings = await getSettings(db);
  const posts = await getCurrentPostsForDate(db, date);
  return packageItemsFor(date, settings.dailyPlan)
    .filter((item) => !posts.some((post) => post.kind === item.kind && post.audience === item.audience))
    .map((item) => `${item.kind}-${item.audience}`);
}

export async function renderDay(db: Db, date: DateKey, renderers: Renderers, options: { force?: boolean } = {}): Promise<RenderDayResult> {
  const settings = await getSettings(db);
  if (!settings.automation.enabled || automationStartReason(settings.automation.startDate, date)) return { rendered: [], kept: [], failures: [] };
  const brand = brandFromSettings(settings);
  const posts = await getCurrentPostsForDate(db, date);
  const plan = planPublications(date, posts, settings.automation);
  const existing = new Map((await listPublications(db, date)).map((row) => [slotKey(row), row]));
  // Yalnız hiç çizilmemiş paylaşımlar çizilir; zorlanırsa onaylanmamış hazırlar da yenilenir. Paylaşımda başarısız olanlar
  // yeniden çizilmez (Telegram'daki "yeniden dene" ile gönderilir): geç gelen bir tetikleme onları onaysız duruma çekmesin.
  const needsRender = (item: PlannedPublication) => {
    const status = existing.get(slotKey(item))?.status;
    return status === undefined || (options.force === true && status === 'ready');
  };
  const result: RenderDayResult = { rendered: [], kept: [], failures: [] };

  for (const post of posts) {
    const items = plan.filter((item) => item.postId === post.id);
    if (items.length === 0) continue;
    const pending = items.filter(needsRender);
    result.kept.push(...items.filter((item) => !needsRender(item)).map(slotKey));
    if (pending.length === 0) continue;
    try {
      const detail = await getPostDetail(db, post.id);
      if (!detail) throw new Error('Gönderi bulunamadı');
      const parts = new Map(splitCarousel(buildSlideProps(detail, brand)).map((entry) => [entry.part, entry.slides]));
      // TikTok, Reels ile aynı videoyu paylaşır; video bir kez çizilir.
      const existingVideo = existing.get(slotKey({ ...items[0], format: 'reels', part: 0 }))?.media;
      let video = existingVideo?.videoUrl ? { videoUrl: existingVideo.videoUrl, ...(existingVideo.isAiGenerated ? { isAiGenerated: true } : {}) } : undefined;
      const renderVideo = async () => {
        const reels = buildReelsProps(detail, brand);
        const rendered = await renderers.renderReels({
          templateVersion: post.templateVersion,
          reels,
          musicSeed: musicSeed(reels),
          name: `${date}-${post.kind}-${post.audience}`,
        });
        video = typeof rendered === 'string' ? { videoUrl: rendered } : rendered;
        return video;
      };
      for (const item of pending) {
        if (item.format === 'carousel') {
          const slides = parts.get(item.part as 1 | 2 | 3);
          if (!slides) throw new Error(`Carousel parçası yok: ${item.part}`);
          const images = await renderers.renderStills(post.templateVersion, slides);
          await savePublication(db, date, item, { images });
        } else if (item.format === 'reels') {
          await savePublication(db, date, item, await renderVideo());
        } else {
          await savePublication(db, date, item, video ?? (await renderVideo()));
        }
        result.rendered.push(slotKey(item));
      }
    } catch (error) {
      result.failures.push(`${post.kind}-${post.audience}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return result;
}
