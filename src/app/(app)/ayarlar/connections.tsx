'use client';

import { useActionState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { checkConnectionsAction, connectBufferAction, connectGitHubAction, connectInstagramAction, connectTelegramAction, type ConnectState, type HealthState } from './automation-actions';
import type { BufferRateLimit } from '@/lib/buffer/client';

const INITIAL_STATE: ConnectState = { status: 'idle' };

export type ConnectionStatus = {
  telegram: { username: string | null; chatLinked: boolean } | null;
  instagram: { username: string | null; expiresAt: string | null } | null;
  tiktok: { channel: string | null } | null;
  renderTrigger: boolean;
  rateLimits?: BufferRateLimit[];
};

function RateLimits({limits}:{limits:BufferRateLimit[]}) {
  return <div className="space-y-1 text-sm">{limits.length ? limits.map(limit=><p key={limit.windowSeconds}>Buffer {limit.windowSeconds===900?'15 dk':limit.windowSeconds===86400?'24 saat':limit.windowSeconds===2592000?'30 gün':`${limit.windowSeconds} sn`}: <strong>{limit.remaining}/{limit.limit}</strong> istek kaldı. Kayıt yenilenmesi: {new Date(limit.resetsAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})}.</p>) : <p className="text-muted-foreground">Kota bilgisi ilk Buffer yanıtıyla görünür; görmek için ayrıca sorgu yapılmaz.</p>}</div>;
}

function HealthCheck() {
  const [state,action,pending] = useActionState(checkConnectionsAction,{status:'idle'} as HealthState);
  const report = state.status==='checked' ? state.report : null;
  return <div className="space-y-3 rounded-lg border p-4 md:col-span-2 xl:col-span-3">
    <form action={action}><Button type="submit" variant="outline" disabled={pending}>{pending?'Kontrol ediliyor…':'Bağlantı sağlığını kontrol et'}</Button></form>
    {state.status==='error' && <p role="alert" className="text-destructive">{state.error}</p>}
    {report && <div role="status" className="space-y-1 text-sm">
      <p>Telegram: {report.telegram?.webhookOk && report.telegram.chatLinked ? '✓ Webhook ve onay sohbeti hazır' : 'Kontrol gerekli'}{report.telegram?.lastError ? ` · ${report.telegram.lastError}` : ''}. Bekleyen güncelleme: {report.telegram?.pendingUpdates ?? '—'}.</p>
      <p>Instagram carousel: {report.instagram ? report.instagram.publishing.ok ? `✓ Yayın izni var; ${report.instagram.publishing.used}/${report.instagram.publishing.total} yayın` : report.instagram.publishing.error : 'Bağlı değil'}.</p>
      <p>Instagram Reels (Buffer): {report.instagramReels?.ok ? '✓ Kanal hazır' : report.instagramReels?.error ?? 'Bağlı değil'}.</p>
      <p>TikTok (Buffer): {report.tiktok?.ok && report.tiktok.enabled ? '✓ Kanal hazır, paylaşım açık' : report.tiktok?.error ?? 'Paylaşım kapalı veya bağlı değil'}.</p>
      <p>GitHub hazırlık tetikleyicisi: {report.renderTrigger ? '✓ Bağlı' : 'Bağlı değil; yedek zamanlama kullanılıyor'}.</p>
      <RateLimits limits={report.bufferRateLimits} />
    </div>}
  </div>;
}

// Anahtarlar kaydedildikten sonra tarayıcıya geri gönderilmez; kutu boş kalır, bağlı olduğu etiket ve yer tutucuyla belirtilir.
function ConnectedTitle({ title, state }: { title: string; state: 'connected' | 'pending' | null }) {
  return (
    <CardTitle className="flex items-center justify-between gap-2">
      {title}
      {state === 'connected' && <Badge className="bg-emerald-600 text-white">✓ Bağlı</Badge>}
      {state === 'pending' && <Badge variant="secondary">/start bekleniyor</Badge>}
    </CardTitle>
  );
}

function ConnectForm({ action, label, placeholder, connected }: { action: typeof connectTelegramAction; label: string; placeholder: string; connected: boolean }) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  return (
    <form action={formAction} className="space-y-2">
      <div className="flex gap-2">
        <Input
          name="token"
          type="password"
          autoComplete="off"
          aria-label={label}
          placeholder={connected ? 'Bağlı — değiştirmek için yeni anahtar yapıştır' : placeholder}
          required
        />
        <Button type="submit" disabled={pending}>
          {pending ? 'Bağlanıyor…' : connected ? 'Değiştir' : 'Bağla'}
        </Button>
      </div>
      {state.status === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.status === 'connected' && <p className="text-sm text-emerald-700">Bağlandı{state.username ? `: ${state.username}` : ''} ✓</p>}
    </form>
  );
}

export function Connections({ status }: { status: ConnectionStatus }) {
  const { telegram, instagram, tiktok, renderTrigger } = status;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card>
        <CardHeader>
          <ConnectedTitle title="Telegram onayı" state={telegram ? (telegram.chatLinked ? 'connected' : 'pending') : null} />
          <CardDescription>
            {telegram
              ? telegram.chatLinked
                ? `@${telegram.username} bağlı; onay mesajları sana geliyor.`
                : `@${telegram.username} bağlı. Son adım: Telegram'da bota /start yaz.`
              : "Telegram'da @BotFather'a /newbot yaz, bota bir ad ver ve verdiği anahtarı buraya yapıştır."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectForm action={connectTelegramAction} label="Telegram bot anahtarı" placeholder="123456789:AA…" connected={telegram !== null} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <ConnectedTitle title="Instagram" state={instagram ? 'connected' : null} />
          <CardDescription>
            {instagram
              ? `@${instagram.username ?? '?'} bağlı${instagram.expiresAt ? `; anahtar ${new Date(instagram.expiresAt).toLocaleDateString('tr-TR')} tarihine kadar geçerli, kendiliğinden yenilenir.` : '.'}`
              : 'Meta geliştirici panelinde üretilen uzun ömürlü Instagram erişim anahtarını yapıştır.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectForm action={connectInstagramAction} label="Instagram erişim anahtarı" placeholder="IGAA…" connected={instagram !== null} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <ConnectedTitle title="TikTok (Buffer)" state={tiktok ? 'connected' : null} />
          <CardDescription>
            {tiktok
              ? `${tiktok.channel ?? 'TikTok'} kanalı bağlı; Reels videoları aynı saatte TikTok'ta da paylaşılır.`
              : "Buffer'da TikTok'u bağla, Settings → API'den bir API anahtarı oluşturup buraya yapıştır."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectForm action={connectBufferAction} label="Buffer API anahtarı" placeholder="Buffer API anahtarı" connected={tiktok !== null} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <ConnectedTitle title="Hazırlık tetikleyicisi (GitHub)" state={renderTrigger ? 'connected' : null} />
          <CardDescription>
            {renderTrigger
              ? 'İçerik üretimi biter bitmez görsel ve Reels hazırlığı başlar.'
              : "Bağlı değilken hazırlık GitHub'ın yedek zamanlamasıyla (06:07–07:07) başlar; bu zamanlama gecikebilir."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectForm action={connectGitHubAction} label="GitHub anahtarı" placeholder="github_pat_…" connected={renderTrigger} />
        </CardContent>
      </Card>
      <div className="md:col-span-2 xl:col-span-3"><RateLimits limits={status.rateLimits ?? []} /></div>
      <HealthCheck />
    </div>
  );
}
