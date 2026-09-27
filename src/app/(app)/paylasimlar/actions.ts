'use server';

import { requireSession } from '@/lib/auth/require-session';
import { automationDeps } from '@/lib/automation/runtime';
import { sendDayPlan } from '@/lib/automation/service';
import { isDateKey } from '@/lib/date/istanbul';

export type ResendState = { status: 'idle' } | { status: 'sent'; at: number } | { status: 'error'; error: string };

export async function resendDayPlanAction(_prev: ResendState, formData: FormData): Promise<ResendState> {
  await requireSession();
  const date = String(formData.get('date') ?? '');
  if (!isDateKey(date)) return { status: 'error', error: 'Geçersiz tarih.' };
  const result = await sendDayPlan(automationDeps(), date);
  return result.sent ? { status: 'sent', at: Date.now() } : { status: 'error', error: result.reason ?? 'Gönderilemedi.' };
}
