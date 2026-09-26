'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireSession } from '@/lib/auth/require-session';
import { parseGenerationForm, type GenerationFormErrors } from '@/lib/settings/generation-form';
import { saveSettings } from '@/lib/settings/repository';

export type GenerationFormState =
  | { status: 'idle' }
  | { status: 'saved'; savedAt: number }
  | { status: 'error'; errors: GenerationFormErrors };

export async function saveGenerationSettingsAction(_prev: GenerationFormState, formData: FormData): Promise<GenerationFormState> {
  await requireSession();
  const parsed = parseGenerationForm(formData);
  if (!parsed.ok) return { status: 'error', errors: parsed.errors };
  await saveSettings(getDb(), parsed.patch);
  revalidatePath('/ayarlar');
  return { status: 'saved', savedAt: Date.now() };
}
