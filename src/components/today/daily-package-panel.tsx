'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedListItem } from '@/components/ui/animated-list';
import { Confetti, type ConfettiRef } from '@/components/ui/confetti';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { AUDIENCE_LABELS, type Audience } from '@/lib/content/types';
import type { DateKey } from '@/lib/date/istanbul';

type Item = { kind: 'horoscope'; audience: Audience; ready: boolean };
type LogEntry = { id: number; text: string; tone: 'info' | 'success' | 'error' };

const label = (audience: Audience) => `${AUDIENCE_LABELS[audience]} burç yorumları`;

export function DailyPackagePanel({ date, items }: { date: DateKey; items: Item[] }) {
  const router = useRouter();
  const confetti = useRef<ConfettiRef>(null);
  const nextId = useRef(0);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const allReady = items.every((item) => item.ready);

  const append = (text: string, tone: LogEntry['tone']) => setLog((previous) => [...previous, { id: nextId.current++, text, tone }]);

  async function generate(force: boolean) {
    if (force && !window.confirm('Günün tüm yorumları yeniden üretilecek. Eski sürümler arşivde kalır. Devam edilsin mi?')) return;
    setRunning(true);
    setLog([]);
    const targets = force ? items : items.filter((item) => !item.ready);
    const outcomes = await Promise.all(
      targets.map(async (item) => {
        append(`${label(item.audience)} hazırlanıyor…`, 'info');
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ date, audience: item.audience, force }),
        });
        const data = (await response.json().catch(() => ({}))) as { status?: string; providers?: string[]; error?: string };
        if (response.ok) {
          append(`✓ ${label(item.audience)} hazır${data.providers ? ` (${data.providers.join(', ')})` : ''}`, 'success');
          return true;
        }
        append(`✗ ${label(item.audience)}: ${data.error ?? 'Bilinmeyen hata'}`, 'error');
        return false;
      }),
    );
    setRunning(false);
    if (outcomes.every(Boolean)) {
      append('Paket hazır 🎉', 'success');
      void confetti.current?.fire({});
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Günün paketi</CardTitle>
        <CardDescription>Plandaki gönderiler tek tıkla üretilir; eksik olanlar tamamlanır.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.audience} className="flex items-center justify-between rounded-xl border px-4 py-3">
              <span className="text-sm font-medium">{label(item.audience)}</span>
              <Badge variant={item.ready ? 'secondary' : 'outline'}>{item.ready ? 'Hazır' : 'Bekliyor'}</Badge>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <ShimmerButton type="button" background="#7a5aa6" disabled={running || allReady} onClick={() => void generate(false)}>
            {running ? 'Üretiliyor…' : 'Günün paketini oluştur'}
          </ShimmerButton>
          <Button type="button" variant="ghost" disabled={running} onClick={() => void generate(true)}>
            Tümünü yeniden üret
          </Button>
        </div>
        {log.length > 0 && (
          <div aria-live="polite" className="space-y-2">
            {log.map((entry) => (
              <AnimatedListItem key={entry.id}>
                <p
                  className={
                    entry.tone === 'error' ? 'text-sm text-destructive' : entry.tone === 'success' ? 'text-sm text-primary' : 'text-sm text-muted-foreground'
                  }
                >
                  {entry.text}
                </p>
              </AnimatedListItem>
            ))}
          </div>
        )}
        <Confetti ref={confetti} manualstart className="pointer-events-none fixed inset-0 z-50 size-full" />
      </CardContent>
    </Card>
  );
}
