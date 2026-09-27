'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { resendDayPlanAction, type ResendState } from './actions';

const INITIAL_STATE: ResendState = { status: 'idle' };

export function ResendButton({ date }: { date: string }) {
  const [state, formAction, pending] = useActionState(resendDayPlanAction, INITIAL_STATE);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="date" value={date} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Gönderiliyor…' : "Planı Telegram'a yeniden gönder"}
      </Button>
      {state.status === 'sent' && <span className="text-sm text-emerald-700">Gönderildi ✓</span>}
      {state.status === 'error' && (
        <span role="alert" className="text-sm text-destructive">
          {state.error}
        </span>
      )}
    </form>
  );
}
