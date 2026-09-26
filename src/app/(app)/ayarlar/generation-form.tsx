'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { ProviderId } from '@/lib/llm/provider-ids';
import type { Settings } from '@/lib/settings/schema';
import { saveGenerationSettingsAction, type GenerationFormState } from './generation-actions';

export type ProviderOption = { id: ProviderId; label: string; model: string; dailyCap: number };
type Row = ProviderOption & { enabled: boolean };

const INITIAL_STATE: GenerationFormState = { status: 'idle' };

function initialRows(preferences: Settings['providerChain'], providers: ProviderOption[]): Row[] {
  const byId = new Map(providers.map((provider) => [provider.id, provider]));
  const rows: Row[] = [];
  for (const preference of preferences) {
    const provider = byId.get(preference.id);
    if (!provider) continue;
    byId.delete(preference.id);
    rows.push({ ...provider, enabled: preference.enabled, dailyCap: preference.dailyCap ?? provider.dailyCap, model: preference.model ?? provider.model });
  }
  return [...rows, ...[...byId.values()].map((provider) => ({ ...provider, enabled: true }))];
}

export function GenerationSettingsForm({ initial, providers }: { initial: Settings; providers: ProviderOption[] }) {
  const [state, formAction, pending] = useActionState(saveGenerationSettingsAction, INITIAL_STATE);
  const [cronEnabled, setCronEnabled] = useState(initial.cronEnabled);
  const [spreadLoad, setSpreadLoad] = useState(initial.spreadLoad);
  const [rows, setRows] = useState(() => initialRows(initial.providerChain, providers));
  const planned = new Set(initial.dailyPlan.map((item) => `${item.kind}:${item.audience}`));
  const errors = state.status === 'error' ? state.errors : {};

  useEffect(() => {
    if (state.status === 'saved') toast.success('Üretim ayarları kaydedildi.');
  }, [state]);

  const move = (index: number, offset: -1 | 1) =>
    setRows((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(index + offset, 0, row);
      return next;
    });
  const update = (index: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)));

  return (
    <form action={formAction} className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium">Her sabah otomatik üret</span>
        <Switch checked={cronEnabled} onCheckedChange={setCronEnabled} aria-label="Her sabah otomatik üret" />
        <input type="hidden" name="cronEnabled" value={String(cronEnabled)} />
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium">Yükü sağlayıcılara dağıt (kadın ve erkek farklı sağlayıcıdan başlar)</span>
        <Switch checked={spreadLoad} onCheckedChange={setSpreadLoad} aria-label="Yükü sağlayıcılara dağıt" />
        <input type="hidden" name="spreadLoad" value={String(spreadLoad)} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Günlük plan</legend>
        {[
          ['horoscope:kadin', 'Kadın burç yorumları'],
          ['horoscope:erkek', 'Erkek burç yorumları'],
        ].map(([value, text]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="dailyPlan" value={value} defaultChecked={planned.has(value)} className="size-4 accent-primary" />
            {text}
          </label>
        ))}
        {errors.dailyPlan && (
          <p role="alert" className="text-sm text-destructive">
            {errors.dailyPlan}
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((index) => (
          <div key={index} className="space-y-2">
            <Label htmlFor={`hashtag${index + 1}`}>{index + 1}. temel hashtag</Label>
            <Input id={`hashtag${index + 1}`} name={`hashtag${index + 1}`} defaultValue={initial.baseHashtags[index] ?? ''} placeholder="#burç" />
          </div>
        ))}
        {errors.baseHashtags && (
          <p role="alert" className="text-sm text-destructive sm:col-span-2">
            {errors.baseHashtags}
          </p>
        )}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Sağlayıcı sırası (yukarıdaki önce denenir)</legend>
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Yapılandırılmış sağlayıcı yok. Vercel ortam değişkenlerine anahtar ekle.</p>}
        {rows.map((row, index) => (
          <div key={row.id} className="grid items-center gap-2 rounded-xl border p-3 sm:grid-cols-[auto_1fr_120px_auto]">
            <Switch checked={row.enabled} onCheckedChange={(enabled) => update(index, { enabled })} aria-label={`${row.label} açık`} />
            <div className="space-y-1">
              <p className="text-sm font-medium">{row.label}</p>
              <Input aria-label={`${row.label} modeli`} value={row.model} onChange={(event) => update(index, { model: event.target.value })} />
            </div>
            <Input
              aria-label={`${row.label} günlük tavan`}
              type="number"
              min={1}
              value={row.dailyCap}
              onChange={(event) => update(index, { dailyCap: Number(event.target.value) })}
            />
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`${row.label} yukarı`} disabled={index === 0} onClick={() => move(index, -1)}>
                <ArrowUp aria-hidden />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`${row.label} aşağı`} disabled={index === rows.length - 1} onClick={() => move(index, 1)}>
                <ArrowDown aria-hidden />
              </Button>
            </div>
          </div>
        ))}
        <input
          type="hidden"
          name="providerChain"
          value={JSON.stringify(rows.map(({ id, enabled, dailyCap, model }) => ({ id, enabled, dailyCap, model })))}
        />
        {errors.providerChain && (
          <p role="alert" className="text-sm text-destructive">
            {errors.providerChain}
          </p>
        )}
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? 'Kaydediliyor…' : 'Üretim ayarlarını kaydet'}
      </Button>
    </form>
  );
}
