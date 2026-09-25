'use client';

import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { parseInstagramHandleInput, type Settings, type WatermarkPosition } from '@/lib/settings/schema';
import { saveSettingsAction, type SettingsFormState } from './actions';
import { WatermarkPreview } from './watermark-preview';

const INITIAL_STATE: SettingsFormState = { status: 'idle' };

export function SettingsForm({ initial }: { initial: Settings }) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, INITIAL_STATE);
  const [handle, setHandle] = useState(initial.instagramHandle ?? '');
  const [enabled, setEnabled] = useState(initial.watermark.enabled);
  const [position, setPosition] = useState<WatermarkPosition>(initial.watermark.position);
  const [opacity, setOpacity] = useState(Math.round(initial.watermark.opacity * 100));

  useEffect(() => {
    if (state.status === 'saved') toast.success('Ayarlar kaydedildi.');
  }, [state]);

  const previewHandle = parseInstagramHandleInput(handle);
  const errors = state.status === 'error' ? state.errors : {};

  return (
    <form action={formAction} className="grid gap-10 md:grid-cols-[1fr_260px]">
      <div className="space-y-8">
        <div className="space-y-2">
          <Label htmlFor="instagramHandle">Instagram kullanıcı adı</Label>
          <Input
            id="instagramHandle"
            name="instagramHandle"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="kullaniciadi"
            autoComplete="off"
          />
          <p className="text-sm text-muted-foreground">
            Sayfanın adı belli olunca buraya yaz. Boş bırakırsan filigran görünmez.
          </p>
          {errors.instagramHandle && (
            <p role="alert" className="text-sm text-destructive">
              {errors.instagramHandle}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium">Filigranı göster</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Filigranı göster" />
          <input type="hidden" name="watermarkEnabled" value={String(enabled)} />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Konum</legend>
          <RadioGroup value={position} onValueChange={(value) => setPosition(value as WatermarkPosition)}>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="bottom-center" aria-label="Alt orta" /> Alt orta
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="bottom-right" aria-label="Sağ alt" /> Sağ alt
            </label>
          </RadioGroup>
          <input type="hidden" name="watermarkPosition" value={position} />
        </fieldset>

        <div className="space-y-3">
          <span className="text-sm font-medium">Opaklık: %{opacity}</span>
          <Slider
            aria-label="Filigran opaklığı"
            value={[opacity]}
            min={20}
            max={100}
            step={5}
            onValueChange={(value) => setOpacity(typeof value === 'number' ? value : value[0])}
          />
          <input type="hidden" name="watermarkOpacity" value={opacity} />
          {errors.watermark && (
            <p role="alert" className="text-sm text-destructive">
              {errors.watermark}
            </p>
          )}
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>

      <WatermarkPreview
        handle={previewHandle.ok ? previewHandle.value : null}
        enabled={enabled}
        position={position}
        opacity={opacity / 100}
      />
    </form>
  );
}
