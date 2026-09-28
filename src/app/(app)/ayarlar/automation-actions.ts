'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireSession } from '@/lib/auth/require-session';
import { automationDeps } from '@/lib/automation/runtime';
import { connectBuffer, connectGitHub, connectInstagram, connectTelegram } from '@/lib/automation/service';
import { BufferError } from '@/lib/buffer/client';
import { InstagramError } from '@/lib/instagram/client';
import { parseAutomationForm } from '@/lib/settings/automation-form';
import { getSettings, saveSettings } from '@/lib/settings/repository';
import { TelegramError } from '@/lib/telegram/client';

export type AutomationFormState = { status: 'idle' } | { status: 'saved'; savedAt: number } | { status: 'error'; error: string };
export type ConnectState = { status: 'idle' } | { status: 'connected'; username: string | null; at: number } | { status: 'error'; error: string };

export async function saveAutomationSettingsAction(_prev: AutomationFormState, formData: FormData): Promise<AutomationFormState> {
  await requireSession();
  const db = getDb();
  const parsed = parseAutomationForm(formData, (await getSettings(db)).automation);
  if (!parsed.ok) return { status: 'error', error: parsed.error };
  await saveSettings(db, parsed.patch);
  revalidatePath('/ayarlar');
  return { status: 'saved', savedAt: Date.now() };
}

export async function connectTelegramAction(_prev: ConnectState, formData: FormData): Promise<ConnectState> {
  await requireSession();
  const token = String(formData.get('token') ?? '').trim();
  if (!/^\d+:[\w-]{30,}$/.test(token)) return { status: 'error', error: "Bu bir Telegram bot anahtarına benzemiyor (örnek: 123456789:AA…). BotFather'ın verdiği anahtarı yapıştır." };
  try {
    const { username } = await connectTelegram(automationDeps(), token);
    revalidatePath('/ayarlar');
    return { status: 'connected', username, at: Date.now() };
  } catch (error) {
    if (error instanceof TelegramError) return { status: 'error', error: 'Telegram anahtarı kabul etmedi; anahtarı yeniden kopyalayıp dene.' };
    throw error;
  }
}

export async function connectInstagramAction(_prev: ConnectState, formData: FormData): Promise<ConnectState> {
  await requireSession();
  const token = String(formData.get('token') ?? '').trim();
  if (token.length < 50) return { status: 'error', error: 'Instagram erişim anahtarı çok kısa görünüyor; tamamını yapıştır.' };
  try {
    const { username } = await connectInstagram(automationDeps(), token);
    revalidatePath('/ayarlar');
    return { status: 'connected', username, at: Date.now() };
  } catch (error) {
    if (error instanceof InstagramError) return { status: 'error', error: `Instagram anahtarı doğrulanamadı: ${error.message}` };
    throw error;
  }
}

export async function connectBufferAction(_prev: ConnectState, formData: FormData): Promise<ConnectState> {
  await requireSession();
  const token = String(formData.get('token') ?? '').trim();
  if (token.length < 20) return { status: 'error', error: "Buffer API anahtarı çok kısa görünüyor; Buffer → Settings → API'den tamamını kopyala." };
  try {
    const { channel } = await connectBuffer(automationDeps(), token);
    revalidatePath('/ayarlar');
    return { status: 'connected', username: channel, at: Date.now() };
  } catch (error) {
    if (error instanceof BufferError) return { status: 'error', error: `Buffer bağlantısı kurulamadı: ${error.message}` };
    throw error;
  }
}

export async function connectGitHubAction(_prev: ConnectState, formData: FormData): Promise<ConnectState> {
  await requireSession();
  const token = String(formData.get('token') ?? '').trim();
  if (!/^(github_pat_|ghp_)\w{20,}$/.test(token)) return { status: 'error', error: 'Bu bir GitHub anahtarına benzemiyor (github_pat_… ile başlamalı).' };
  try {
    const { repository } = await connectGitHub(automationDeps(), token);
    revalidatePath('/ayarlar');
    return { status: 'connected', username: repository, at: Date.now() };
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : String(error) };
  }
}
