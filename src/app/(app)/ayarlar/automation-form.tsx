'use client';

import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { slotFieldName } from '@/lib/settings/automation-form';
import type { AutomationSettings } from '@/lib/settings/schema';
import { saveAutomationSettingsAction, type AutomationFormState } from './automation-actions';

const INITIAL_STATE: AutomationFormState = { status: 'idle' };
const ROWS = [
  ['horoscope', 'kadin', 'Kadın günlük burç'],
  ['horoscope', 'erkek', 'Erkek günlük burç'],
  ['tarot', 'kadin', 'Kadın tarot'],
  ['tarot', 'erkek', 'Erkek tarot'],
  ['weekly', 'kadin', 'Kadın haftalık (pazartesi)'],
  ['weekly', 'erkek', 'Erkek haftalık (pazartesi)'],
] as const;

export function AutomationSettingsForm({ initial }: { initial: AutomationSettings }) {
  const [state, formAction, pending] = useActionState(saveAutomationSettingsAction, INITIAL_STATE);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [tiktokEnabled, setTiktokEnabled] = useState(initial.tiktok.enabled);

  useEffect(() => {
    if (state.status === 'saved') toast.success('Paylaşım saatleri kaydedildi.');
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium">{"Her sabah paylaşımları hazırla ve Telegram'dan onay iste"}</span>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Otomatik paylaşım" />
        <input type="hidden" name="enabled" value={String(enabled)} />
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium">{"Reels videolarını aynı saatte TikTok'ta da paylaş (Buffer)"}</span>
        <Switch checked={tiktokEnabled} onCheckedChange={setTiktokEnabled} aria-label="TikTok paylaşımı" />
        <input type="hidden" name="tiktokEnabled" value={String(tiktokEnabled)} />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Paylaşım saatleri (TSİ)</legend>
        <div className="grid grid-cols-[1fr_110px_110px] items-center gap-x-3 gap-y-2 text-sm">
          <span />
          <span className="text-muted-foreground">Carousel</span>
          <span className="text-muted-foreground">Reels</span>
          {ROWS.map(([kind, audience, label]) => (
            <div key={`${kind}-${audience}`} className="contents">
              <span>{label}</span>
              {(['carousel', 'reels'] as const).map((format) => (
                <Input
                  key={format}
                  type="time"
                  aria-label={`${label} ${format === 'carousel' ? 'carousel' : 'Reels'} saati`}
                  name={slotFieldName(kind, audience, format)}
                  defaultValue={initial.schedule[kind][audience][format]}
                  required
                />
              ))}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Carousel üç parça hâlinde paylaşılır: son parça yazdığın saatte, diğerleri aralıkla ardından.</p>
      </fieldset>

      <div className="max-w-xs space-y-2">
        <Label htmlFor="partGapMinutes">Carousel parçaları arası (dakika)</Label>
        <Input id="partGapMinutes" name="partGapMinutes" type="number" min={1} max={30} defaultValue={initial.partGapMinutes} />
      </div>

      {state.status === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Kaydediliyor…' : 'Paylaşım ayarlarını kaydet'}
      </Button>
    </form>
  );
}
