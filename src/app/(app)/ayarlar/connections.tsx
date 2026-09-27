'use client';

import { useActionState } from 'react';
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

function ConnectForm({ action, label, placeholder }: { action: typeof connectTelegramAction; label: string; placeholder: string }) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  return (
    <form action={formAction} className="space-y-2">
      <div className="flex gap-2">
        <Input name="token" type="password" autoComplete="off" aria-label={label} placeholder={placeholder} required />
        <Button type="submit" disabled={pending}>
          {pending ? 'Bağlanıyor…' : 'Bağla'}
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
          <CardTitle>Telegram onayı</CardTitle>
          <CardDescription>
            {telegram
              ? telegram.chatLinked
                ? `@${telegram.username} bağlı; onay mesajları sana geliyor.`
                : `@${telegram.username} bağlı. Son adım: Telegram'da bota /start yaz.`
              : "Telegram'da @BotFather'a /newbot yaz, bota bir ad ver ve verdiği anahtarı buraya yapıştır."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectForm action={connectTelegramAction} label="Telegram bot anahtarı" placeholder="123456789:AA…" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Instagram</CardTitle>
          <CardDescription>
            {instagram
              ? `@${instagram.username ?? '?'} bağlı${instagram.expiresAt ? `; anahtar ${new Date(instagram.expiresAt).toLocaleDateString('tr-TR')} tarihine kadar geçerli, kendiliğinden yenilenir.` : '.'}`
              : 'Meta geliştirici panelinde üretilen uzun ömürlü Instagram erişim anahtarını yapıştır.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectForm action={connectInstagramAction} label="Instagram erişim anahtarı" placeholder="IGAA…" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>TikTok (Buffer)</CardTitle>
          <CardDescription>
            {tiktok
              ? `${tiktok.channel ?? 'TikTok'} kanalı bağlı; Reels videoları aynı saatte TikTok'ta da paylaşılır.`
              : "Buffer'da TikTok'u bağla, Settings → API'den bir API anahtarı oluşturup buraya yapıştır."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectForm action={connectBufferAction} label="Buffer API anahtarı" placeholder="Buffer API anahtarı" />
        </CardContent>
      </Card>
    </div>
  );
}
