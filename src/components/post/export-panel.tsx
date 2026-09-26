'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AnimatedCircularProgressBar } from '@/components/ui/animated-circular-progress-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PostSummary } from '@/lib/posts/summary';
import { formatCaption } from '@/lib/render/caption';
import { canShareFiles, saveBlob } from '@/lib/render/deliver';
import { CAPTION_FILE_NAME, postBaseName, slideFileName, zipFileName } from '@/lib/render/file-names';
import { renderPostImages } from '@/lib/render/render-images';
import { buildZip } from '@/lib/render/zip';
import type { SlideProps } from '@/remotion/slide-types';

const JSON_HEADERS = { 'content-type': 'application/json' };

export function ExportPanel({ post, slides, blocked }: { post: PostSummary; slides: SlideProps[]; blocked: boolean }) {
  const router = useRouter();
  const controller = useRef<AbortController | null>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: slides.length });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const baseName = postBaseName(post);
  const caption = formatCaption(post.caption, post.hashtags);
  const shareable = files !== null && canShareFiles(files);

  useEffect(() => () => controller.current?.abort(), []);

  async function prepare() {
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setError(null);
    setFiles(null);
    setProgress({ done: 0, total: slides.length });
    try {
      const blobs = await renderPostImages({
        templateVersion: post.templateVersion,
        slides,
        signal: abort.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setFiles(blobs.map((blob, index) => new File([blob], slideFileName(baseName, index, slides[index].slide), { type: 'image/jpeg' })));
    } catch (caught) {
      if (!abort.signal.aborted) setError(caught instanceof Error ? caught.message : 'Görseller hazırlanamadı.');
    } finally {
      setRunning(false);
    }
  }

  async function markDownloaded() {
    await fetch(`/api/posts/${post.id}/status`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ action: 'downloaded' }) }).catch(
      () => null,
    );
    router.refresh();
  }

  async function downloadZip() {
    if (!files) return;
    const entries = await Promise.all(files.map(async (file) => ({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) })));
    entries.push({ name: CAPTION_FILE_NAME, data: new TextEncoder().encode(caption) });
    saveBlob(new Blob([new Uint8Array(buildZip(entries))], { type: 'application/zip' }), zipFileName(baseName));
    await markDownloaded();
  }

  async function share() {
    if (!files) return;
    try {
      await navigator.share({ files, title: baseName });
      await markDownloaded();
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === 'AbortError')) toast.error('Paylaşım açılamadı.');
    }
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      toast.success('Caption kopyalandı.');
    } catch {
      toast.error('Kopyalanamadı; metni elle seç.');
    }
  }

  async function togglePublished() {
    const published = post.status !== 'paylasildi';
    const response = await fetch(`/api/posts/${post.id}/status`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'published', value: published }),
    }).catch(() => null);
    if (!response?.ok) {
      toast.error('Durum güncellenemedi.');
      return;
    }
    toast.success(published ? 'Paylaşıldı olarak işaretlendi.' : 'Paylaşıldı işareti kaldırıldı.');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>İndir ve paylaş</CardTitle>
        <CardDescription>Görseller tarayıcında hazırlanır; bu sırada sekmeyi açık tut.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {blocked && <p className="text-sm text-muted-foreground">Önce değişiklikleri kaydet; indirme kayıtlı sürümü kullanır.</p>}
        {!files && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={running || blocked} onClick={() => void prepare()}>
              {running ? 'Hazırlanıyor…' : "JPEG'leri hazırla"}
            </Button>
            {running && (
              <Button type="button" variant="ghost" onClick={() => controller.current?.abort()}>
                İptal
              </Button>
            )}
          </div>
        )}
        {(running || files) && (
          <div className="flex items-center gap-4">
            <AnimatedCircularProgressBar
              className="size-20 text-base"
              max={progress.total}
              value={progress.done}
              gaugePrimaryColor="#7a5aa6"
              gaugeSecondaryColor="#f3e8f5"
            />
            <p aria-live="polite" className="text-sm">
              {progress.done}/{progress.total} görsel hazır
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {files && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void downloadZip()}>
              ZIP indir
            </Button>
            {shareable && (
              <Button type="button" variant="secondary" onClick={() => void share()}>
                Paylaş / Fotoğraflara kaydet
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => setFiles(null)}>
              Yeniden hazırla
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => void copyCaption()}>
            Caption&apos;ı kopyala
          </Button>
          <Button type="button" variant="outline" onClick={() => void togglePublished()}>
            {post.status === 'paylasildi' ? 'Paylaşıldı işaretini kaldır' : 'Paylaşıldı olarak işaretle'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
