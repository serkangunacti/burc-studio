import { getCurrentPostsForDate } from '@/lib/content/repository';
import { packageItemsFor } from '@/lib/content/daily-package';
import { specFor } from '@/lib/content/generation-spec';
import { posts as postsTable, publications as publicationsTable } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import type { DateKey } from '@/lib/date/istanbul';
import { musicSeed } from '@/lib/music/compose';
import { buildReelsProps } from '@/lib/posts/reels-props';
import { getPostDetail } from '@/lib/posts/repository';
import { brandFromSettings } from '@/lib/posts/slide-props';
import { getSettings } from '@/lib/settings/repository';
import type { Db } from '@/db/types';
import type { ReelsProps, SlideProps } from '@/remotion/slide-types';
import { planPublications } from './plan';
import { listPublications, savePublication } from './repository';
import { automationStartReason } from './start';
import {MAX_REELS_MP4_SECONDS} from '@/remotion/reels';

export type Renderers = {
  renderStills: (templateVersion: string, slides: SlideProps[]) => Promise<Uint8Array[]>;
  // Videoyu üretip herkese açık adresini döndürür.
  renderReels: (input: { templateVersion: string; reels: ReelsProps; musicSeed: number; name: string }) => Promise<string | { videoUrl: string; durationSeconds?: number; isAiGenerated?: boolean; parts?: {videoUrl: string; durationSeconds: number}[] }>;
  hasVideo?: (videoUrl: string) => Promise<boolean>;
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

export async function renderDay(db: Db, date: DateKey, renderers: Renderers, options: { force?: boolean; only?: string } = {}): Promise<RenderDayResult> {
  const settings = await getSettings(db);
  if (!settings.automation.enabled || automationStartReason(settings.automation.startDate, date)) return { rendered: [], kept: [], failures: [] };
  const brand = brandFromSettings(settings);
  const posts = await getCurrentPostsForDate(db, date);
  const plan = planPublications(date, posts, settings.automation);
  // Eski carousel formatındaki satırları tamamen temizle (artık yalnızca reels/video paylaşılıyor).
  await db.delete(publicationsTable).where(and(eq(publicationsTable.date, date), eq(publicationsTable.format, 'carousel')));
  const existing = new Map((await listPublications(db, date)).map((row) => [slotKey(row), row]));
  const result: RenderDayResult = { rendered: [], kept: [], failures: [] };
  const existingVideoRows=[...existing.values()].filter(row=>row.format!=='carousel'&&row.status!=='expired');
  const missingBlobPosts=new Set<string>();
  const checkedUrls=new Map<string,boolean>();
  if(renderers.hasVideo){
    for(const row of existingVideoRows){
      const url=row.media.videoUrl;
      if(!url)continue;
      let available=checkedUrls.get(url);
      if(available===undefined){available=await renderers.hasVideo(url);checkedUrls.set(url,available);}
      if(!available)missingBlobPosts.add(row.postId);
    }
  }
  const invalidVideoPosts=new Set(existingVideoRows.filter(row=>
    row.part!==0||row.media.partCount!==1||!row.media.videoUrl||typeof row.media.durationSeconds!=='number'||
    !Number.isFinite(row.media.durationSeconds)||row.media.durationSeconds<=0||row.media.durationSeconds>MAX_REELS_MP4_SECONDS
  ).map(row=>row.postId));
  // Any broken asset withdraws today's approvals before replacement rendering starts.
  if((missingBlobPosts.size||invalidVideoPosts.size)&&!options.only&&!options.force){
    if(existingVideoRows.some(row=>row.status==='publishing'))return {...result,failures:['Paylaşım sürüyor; günün video paketi yeniden doğrulanana kadar bekletildi']};
    await db.update(publicationsTable).set({status:'ready',approvedAt:null,error:'Tam günlük video paketi yeniden doğrulanıyor'})
      .where(and(eq(publicationsTable.date,date),eq(publicationsTable.status,'approved')));
  }
  // Invalidate the entire rebuild before its first render: no mix of old and new approvals.
  if(options.force && !options.only){
    if([...existing.values()].some(row=>row.status==='publishing'))return {...result,failures:['Paylaşım sürüyor; paketin yeniden hazırlanması bekletildi']};
    await db.update(publicationsTable).set({status:'ready',approvedAt:null,media:{},error:'Video paketi yeniden render ediliyor'}).where(eq(publicationsTable.date,date));
  }

  for (const post of posts) {
    if (options.only && `${post.kind}-${post.audience}` !== options.only) continue;
    const items = plan.filter(item => item.postId === post.id);
    if (!items.length) continue;
    const targetTemplateVersion = (post.kind !== 'special' ? specFor(post.kind)?.templateVersion : undefined) ?? post.templateVersion;
    const templateOutdated = post.templateVersion !== targetTemplateVersion;
    const oldVideos = [...existing.values()].filter(row => row.postId === post.id && row.format === 'reels').sort((a,b) => a.part-b.part);
    const unsafe=oldVideos.some(row=>row.part!==0||row.media.partCount!==1||typeof row.media.durationSeconds!=='number'||!Number.isFinite(row.media.durationSeconds)||row.media.durationSeconds<=0||row.media.durationSeconds>MAX_REELS_MP4_SECONDS);
    const replace = options.force === true || !!options.only || templateOutdated || unsafe || missingBlobPosts.has(post.id);
    const partCount = oldVideos[0]?.media.partCount ?? 1;
    const pending = items.filter(item => replace || Array.from({length:partCount},(_,part)=>existing.get(slotKey({...item,part}))).some(row=>!row));
    if (!pending.length) {
      result.kept.push(...[...existing.values()].filter(row=>row.postId===post.id).map(slotKey));
      continue;
    }
    // Eski kuyruk teslimleri render sürerken eski videoyu yayınlamasın.
    if (replace) {
      const active = [...existing.values()].filter(row=>row.postId===post.id && row.status==='publishing');
      if (active.length) { result.failures.push(`${post.kind}-${post.audience}: paylaşım sürüyor; yeniden render bekletildi`); continue; }
      await db.update(publicationsTable).set({status:'ready',approvedAt:null,media:{},error:'Video yeniden render ediliyor'}).where(and(eq(publicationsTable.date,date),eq(publicationsTable.postId,post.id)));
    }
    try {
      let videos: {videoUrl:string;durationSeconds?:number;isAiGenerated?:boolean}[];
      if (!replace && oldVideos.length===partCount && oldVideos.every(row=>row.media.videoUrl)) {
        videos = oldVideos.map(row=>({videoUrl:row.media.videoUrl!, ...(row.media.durationSeconds!==undefined?{durationSeconds:row.media.durationSeconds}:{}), ...(row.media.isAiGenerated?{isAiGenerated:true}:{})}));
      } else {
        const detail = await getPostDetail(db,post.id);
        if (!detail) throw new Error('Gönderi bulunamadı');
        if (templateOutdated) await db.update(postsTable).set({templateVersion:targetTemplateVersion}).where(eq(postsTable.id,post.id));
        const reels = buildReelsProps(detail,brand);
        const readingBySign = new Map(detail.slides.flatMap(s=>s.reading?[[s.reading.sign,s.reading] as const]:[]));
        const enrichedReels = {...reels,signs:reels.signs.map(sign=>({...sign,body:readingBySign.get(sign.sign)?.body??sign.short}))};
        const rendered = await renderers.renderReels({templateVersion:targetTemplateVersion,reels:enrichedReels,musicSeed:musicSeed(reels),name:`${date}-${post.kind}-${post.audience}`});
        const video = typeof rendered==='string'?{videoUrl:rendered}:rendered;
        videos = 'parts' in video && video.parts?.length ? video.parts.map(part=>({...part,...(video.isAiGenerated?{isAiGenerated:true}:{})})) : [video];
      }
      if (videos.length!==1 || videos.some(video=>typeof video.durationSeconds!=='number'||!Number.isFinite(video.durationSeconds)||video.durationSeconds<=0||video.durationSeconds>MAX_REELS_MP4_SECONDS)) throw new Error('Tek MP4 video 178,9 saniyelik süre kontrolünü geçemedi');
      for (const item of pending) {
        for (const [part,video] of videos.entries()) {
          const planned = {...item,part,scheduledAt:new Date(item.scheduledAt.getTime()+part*settings.automation.partGapMinutes*60_000)};
          const media = {...video,...(video.durationSeconds!==undefined?{partCount:videos.length}:{})};
          const saved = await savePublication(db,date,planned,media,{force:replace});
          if (saved) result.rendered.push(slotKey(planned));
        }
        if (replace) {
          const stale = [...existing.values()].filter(row=>row.postId===post.id && row.format===item.format && row.part>=videos.length);
          for (const row of stale) await db.update(publicationsTable).set({status:'expired',error:'Yeni render sürümünde bu parça yok'}).where(eq(publicationsTable.id,row.id));
        }
      }
    } catch (error) {
      result.failures.push(`${post.kind}-${post.audience}: ${error instanceof Error?error.message:String(error)}`);
    }
  }
  return result;
}
