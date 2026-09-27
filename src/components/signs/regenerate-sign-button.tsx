'use client';

import { RefreshCw, Shuffle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { Audience, ReadingKind } from '@/lib/content/types';
import type { DateKey } from '@/lib/date/istanbul';
import { cn } from '@/lib/utils';
import type { SignSlug } from '@/lib/zodiac/signs';

export function RegenerateSignButton({
  date,
  audience,
  sign,
  name,
  kind = 'horoscope',
  redrawCard = false,
  onRegenerated,
}: {
  date: DateKey;
  audience: Audience;
  kind?: ReadingKind;
  // Tarot: burcun kartı diğer 11 kartın dışından yeniden çekilir ve yorum yeniden yazılır.
  redrawCard?: boolean;
  sign: SignSlug;
  name: string;
  onRegenerated?: (postId: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={redrawCard ? `${name} kartını yeniden çek` : `${name} yorumunu yeniden üret`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const response = await fetch('/api/generate/sign', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ date, audience, sign, kind, redrawCard }),
          });
          const data = (await response.json().catch(() => ({}))) as { error?: string; postId?: string };
          if (response.ok) {
            toast.success(redrawCard ? `${name} için yeni kart çekildi.` : `${name} yorumu yenilendi.`);
            if (onRegenerated && data.postId) onRegenerated(data.postId);
            else router.refresh();
          } else {
            toast.error(data.error ?? 'Yeniden üretilemedi.');
          }
        })
      }
    >
      {redrawCard ? (
        <Shuffle className={cn('size-4', pending && 'animate-pulse')} aria-hidden />
      ) : (
        <RefreshCw className={cn('size-4', pending && 'animate-spin')} aria-hidden />
      )}
      {redrawCard ? 'Kartı yeniden çek' : 'Yeniden üret'}
    </Button>
  );
}
