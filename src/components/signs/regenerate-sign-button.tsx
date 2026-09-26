'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { Audience } from '@/lib/content/types';
import type { DateKey } from '@/lib/date/istanbul';
import { cn } from '@/lib/utils';
import type { SignSlug } from '@/lib/zodiac/signs';

export function RegenerateSignButton({
  date,
  audience,
  sign,
  name,
  onRegenerated,
}: {
  date: DateKey;
  audience: Audience;
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
      aria-label={`${name} yorumunu yeniden üret`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const response = await fetch('/api/generate/sign', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ date, audience, sign }),
          });
          const data = (await response.json().catch(() => ({}))) as { error?: string; postId?: string };
          if (response.ok) {
            toast.success(`${name} yorumu yenilendi.`);
            if (onRegenerated && data.postId) onRegenerated(data.postId);
            else router.refresh();
          } else {
            toast.error(data.error ?? 'Yeniden üretilemedi.');
          }
        })
      }
    >
      <RefreshCw className={cn('size-4', pending && 'animate-spin')} aria-hidden />
      Yeniden üret
    </Button>
  );
}
