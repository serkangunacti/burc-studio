'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AUDIENCE_LABELS } from '@/lib/content/types';
import { formatDateLongTr } from '@/lib/date/istanbul';
import { applyDraft, createDraft, draftToEdit, isEmptyEdit, type DraftSource } from '@/lib/posts/draft';
import { STATUS_LABELS, type PostSummary, type VersionSummary } from '@/lib/posts/summary';
import { saveBlob } from '@/lib/render/deliver';
import { postBaseName, slideFileName } from '@/lib/render/file-names';
import { renderSlideJpeg } from '@/lib/render/render-images';
import { cn } from '@/lib/utils';
import type { SlideProps } from '@/remotion/slide-types';
import { ExportPanel } from './export-panel';
import { PostTextEditor, SlideEditor } from './slide-editor';
import { SlideStrip } from './slide-strip';

export function PostWorkspace({
  post,
  slides,
  source,
  versions,
}: {
  post: PostSummary;
  slides: SlideProps[];
  source: DraftSource;
  versions: VersionSummary[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => createDraft(source));
  const [selected, setSelected] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const preview = useMemo(() => applyDraft(slides, draft), [slides, draft]);
  const edit = useMemo(() => draftToEdit(source, draft), [source, draft]);
  const dirty = !isEmptyEdit(edit);
  const current = versions.find((version) => version.isCurrent);
  const openPost = (postId: string) => router.push(`/gonderi/${postId}`);

  async function downloadSlide(index: number) {
    try {
      const blob = await renderSlideJpeg(post.templateVersion, slides[index]);
      saveBlob(blob, slideFileName(postBaseName(post), index, slides[index].slide));
    } catch {
      toast.error('Slayt indirilemedi; tekrar dene.');
    }
  }

  async function save() {
    setSaving(true);
    setErrors({});
    const response = await fetch(`/api/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(edit),
    }).catch(() => null);
    const data = ((await response?.json().catch(() => null)) ?? {}) as {
      status?: string;
      postId?: string;
      error?: string;
      errors?: Record<string, string>;
    };
    setSaving(false);
    if (response?.ok && data.status === 'created' && data.postId) {
      toast.success('Yeni sürüm kaydedildi.');
      openPost(data.postId);
      return;
    }
    if (response?.ok) {
      // Sunucu boşlukları kırpıp hashtagleri normalleştirdi ve fark bulmadı; taslak kayıtlı sürüme döner.
      setDraft(createDraft(source));
      toast.info('Değişiklik yok.');
      return;
    }
    if (data.errors) setErrors(data.errors);
    toast.error(data.error ?? 'Kaydedilemedi.');
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">{formatDateLongTr(post.date)}</p>
        <h1 className="font-heading text-3xl sm:text-4xl">{AUDIENCE_LABELS[post.audience]} burç yorumları</h1>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Sürüm {post.version}</Badge>
          <Badge variant="secondary" data-testid="post-status">
            {STATUS_LABELS[post.status]}
          </Badge>
        </div>
      </header>

      {!post.isCurrent && current && (
        <p role="status" className="rounded-xl border bg-secondary p-3 text-sm">
          Bu eski bir sürüm; yalnızca indirilebilir.{' '}
          <Link href={`/gonderi/${current.id}`} className="font-semibold underline">
            Güncel sürüme git
          </Link>
        </p>
      )}

      <SlideStrip
        slides={preview}
        templateVersion={post.templateVersion}
        selected={selected}
        onSelect={setSelected}
        onDownload={downloadSlide}
        downloadDisabled={dirty}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {post.isCurrent && (
            <>
              <SlideEditor
                slide={preview[selected].slide}
                post={post}
                draft={draft}
                errors={errors}
                onChange={setDraft}
                onRegenerated={openPost}
              />
              <PostTextEditor draft={draft} errors={errors} onChange={setDraft} />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>
                  {saving ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
                </Button>
                {dirty && <span className="text-sm text-muted-foreground">Kaydedilmemiş değişiklikler var.</span>}
              </div>
            </>
          )}
        </div>
        <aside className="space-y-6">
          <ExportPanel post={post} slides={slides} blocked={dirty} />
          <nav aria-label="Sürümler" className="space-y-2">
            <h2 className="text-sm font-medium">Sürümler</h2>
            <ul className="space-y-1 text-sm">
              {versions.map((version) => (
                <li key={version.id}>
                  <Link
                    href={`/gonderi/${version.id}`}
                    aria-current={version.id === post.id ? 'page' : undefined}
                    className={cn('hover:underline', version.id === post.id && 'font-semibold')}
                  >
                    Sürüm {version.version}
                    {version.isCurrent ? ' (güncel)' : ''}
                  </Link>
                  <span className="text-muted-foreground"> · {STATUS_LABELS[version.status]}</span>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </section>
  );
}
