'use client';

import { useActionState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { connectBufferAction, connectInstagramAction, connectTelegramAction, type ConnectState } from './automation-actions';

const INITIAL_STATE: ConnectState = { status: 'idle' };

export type ConnectionStatus = {
  telegram: { username: string | null; chatLinked: boolean } | null;
  instagram: { username: string | null; expiresAt: string | null } | null;
  tiktok: { channel: string | null } | null;
};

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
      {state.status === 'connected' && <p className="text-sm text-emerald-700">Bağlandı{state.username ? `: @${state.username}` : ''} ✓</p>}
    </form>
  );
}

export function Connections({ status }: { status: ConnectionStatus }) {
  const { telegram, instagram, tiktok } = status;
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
    </div>
  );
}
