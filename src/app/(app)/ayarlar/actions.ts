'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireSession } from '@/lib/auth/require-session';
import { parseSettingsForm, type SettingsFormErrors } from '@/lib/settings/form';
import { saveSettings } from '@/lib/settings/repository';

export type SettingsFormState =
  | { status: 'idle' }
  | { status: 'saved'; savedAt: number }
  | { status: 'error'; errors: SettingsFormErrors };

export async function saveSettingsAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireSession();
  const parsed = parseSettingsForm(formData);
  if (!parsed.ok) return { status: 'error', errors: parsed.errors };
  await saveSettings(getDb(), parsed.patch);
  revalidatePath('/ayarlar');
  return { status: 'saved', savedAt: Date.now() };
}
