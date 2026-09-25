import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getDb } from '@/db/client';
import { getSettings } from '@/lib/settings/repository';
import { SettingsForm } from './settings-form';

export const metadata: Metadata = { title: 'Ayarlar' };

export default async function SettingsPage() {
  await connection();
  const settings = await getSettings(getDb());
  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <h1 className="font-heading text-4xl">Ayarlar</h1>
      <SettingsForm initial={settings} />
    </section>
  );
}
