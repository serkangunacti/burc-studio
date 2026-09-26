'use client';

import { Player } from '@remotion/player';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AnimatedCircularProgressBar } from '@/components/ui/animated-circular-progress-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PostSummary } from '@/lib/posts/summary';
import { canShareFiles, saveBlob } from '@/lib/render/deliver';
import { postBaseName, reelsFileName } from '@/lib/render/file-names';
import { checkReelsSupport, renderReelsMp4 } from '@/lib/render/render-reels';
import { REELS_FPS, REELS_SIZE, reelsDurationInFrames } from '@/remotion/reels';
import type { ReelsProps } from '@/remotion/slide-types';
import { getTemplate } from '@/remotion/templates';

export function ReelsPanel({ post, reels, blocked }: { post: PostSummary; reels: ReelsProps; blocked: boolean }) {
  const controller = useRef<AbortController | null>(null);
  const [support, setSupport] = useState<{ ok: true } | { ok: false; reason: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const durationInFrames = reelsDurationInFrames(reels.signs.length);

  useEffect(() => {
    let active = true;
    checkReelsSupport()
      .then((result) => active && setSupport(result))
      .catch(() => active && setSupport({ ok: false, reason: 'Video desteği denetlenemedi; sayfayı yenile.' }));
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, []);

  async function prepare() {
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setError(null);
    setFile(null);
    setProgress(0);
    try {
      const blob = await renderReelsMp4({ templateVersion: post.templateVersion, reels, signal: abort.signal, onProgress: setProgress });
      setFile(new File([blob], reelsFileName(postBaseName(post)), { type: 'video/mp4' }));
    } catch (caught) {
      if (!abort.signal.aborted) setError(caught instanceof Error ? caught.message : 'Reels hazırlanamadı.');
    } finally {
      setRunning(false);
    }
  }

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: file.name });
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === 'AbortError')) toast.error('Paylaşım açılamadı.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Reels videosu</h2>
        </CardTitle>
        <CardDescription>59 sn · 1080×1920 · müziksiz. Müziği Instagram&apos;da ekleyebilirsin. Hazırlanırken sekmeyi açık tut.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Player
          component={getTemplate(post.templateVersion).Reels}
          inputProps={reels}
          durationInFrames={durationInFrames}
          fps={REELS_FPS}
          compositionWidth={REELS_SIZE.width}
          compositionHeight={REELS_SIZE.height}
          controls
          style={{ width: '100%', borderRadius: 16, overflow: 'hidden' }}
          acknowledgeRemotionLicense
        />
        {support && !support.ok && (
          <p role="alert" className="text-sm text-destructive">
            {support.reason}
          </p>
        )}
        {blocked && <p className="text-sm text-muted-foreground">Önce değişiklikleri kaydet; video kayıtlı sürümden üretilir.</p>}
        {!file && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={running || blocked || !support?.ok} onClick={() => void prepare()}>
              {running ? 'Hazırlanıyor…' : "Reels'i hazırla"}
            </Button>
            {running && (
              <Button type="button" variant="ghost" onClick={() => controller.current?.abort()}>
                İptal
              </Button>
            )}
          </div>
        )}
        {(running || file) && (
          <div className="flex items-center gap-4">
            <AnimatedCircularProgressBar
              className="size-20 text-base"
              max={100}
              value={Math.round(progress * 100)}
              gaugePrimaryColor="#7a5aa6"
              gaugeSecondaryColor="#f3e8f5"
            />
            <p aria-live="polite" className="text-sm">
              %{Math.round(progress * 100)} hazır
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {file && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => saveBlob(file, file.name)}>
              MP4 indir
            </Button>
            {canShareFiles([file]) && (
              <Button type="button" variant="secondary" onClick={() => void share()}>
                Reels&apos;i paylaş
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => setFile(null)}>
              Yeniden hazırla
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
