import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getDb } from '@/db/client';
import { getUsageSummary } from '@/lib/content/runs';
import { availableProviders } from '@/lib/llm/providers';
import { getSettings } from '@/lib/settings/repository';
import { GenerationSettingsForm } from './generation-form';
import { SettingsForm } from './settings-form';
import { UsageTable } from './usage-table';

export const metadata: Metadata = { title: 'Ayarlar' };

export default async function SettingsPage() {
  await connection();
  const db = getDb();
  const [settings, usage] = await Promise.all([getSettings(db), getUsageSummary(db, 7)]);
  const providers = availableProviders(process.env).map(({ id, label, model, dailyCap }) => ({ id, label, model, dailyCap }));
  return (
    <section className="mx-auto max-w-4xl space-y-12">
      <h1 className="font-heading text-4xl">Ayarlar</h1>
      <div className="space-y-6">
        <h2 className="font-heading text-2xl">Marka ve filigran</h2>
        <SettingsForm initial={settings} />
      </div>
      <div className="space-y-6">
        <h2 className="font-heading text-2xl">İçerik üretimi</h2>
        <GenerationSettingsForm initial={settings} providers={providers} />
      </div>
      <div className="space-y-4">
        <h2 className="font-heading text-2xl">Sağlayıcı kullanımı</h2>
        <UsageTable rows={usage} />
      </div>
    </section>
  );
}
