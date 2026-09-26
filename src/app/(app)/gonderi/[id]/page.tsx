import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { PostWorkspace } from '@/components/post/post-workspace';
import { getDb } from '@/db/client';
import { buildReelsProps } from '@/lib/posts/reels-props';
import { getPostDetail, getPostVersions } from '@/lib/posts/repository';
import { brandFromSettings, buildSlideProps } from '@/lib/posts/slide-props';
import { toDraftSource, toPostSummary, toVersionSummary } from '@/lib/posts/summary';
import { getSettings } from '@/lib/settings/repository';

export const metadata: Metadata = { title: 'Gönderi' };

export default async function PostPage(props: PageProps<'/gonderi/[id]'>) {
  await connection();
  const { id } = await props.params;
  const db = getDb();
  const detail = await getPostDetail(db, id);
  if (!detail) notFound();
  const { post } = detail;
  const [settings, versions] = await Promise.all([
    getSettings(db),
    getPostVersions(db, { date: post.date, kind: post.kind, audience: post.audience }),
  ]);
  const brand = brandFromSettings(settings);
  return (
    <PostWorkspace
      key={post.id}
      post={toPostSummary(post)}
      slides={buildSlideProps(detail, brand)}
      reels={buildReelsProps(detail, brand)}
      source={toDraftSource(detail)}
      versions={versions.map(toVersionSummary)}
    />
  );
}
