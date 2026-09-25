import { describe, expect, it } from 'vitest';
import { parseSettingsForm } from './form';
import { HANDLE_ERROR } from './schema';

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const valid = { instagramHandle: '@Burc.Studio', watermarkEnabled: 'true', watermarkPosition: 'bottom-right', watermarkOpacity: '70' };

describe('parseSettingsForm', () => {
  it('geçerli formu yamaya çevirir', () => {
    expect(parseSettingsForm(form(valid))).toEqual({
      ok: true,
      patch: { instagramHandle: 'burc.studio', watermark: { enabled: true, position: 'bottom-right', opacity: 0.7 } },
    });
  });

  it('boş kullanıcı adı null olur', () => {
    const result = parseSettingsForm(form({ ...valid, instagramHandle: '' }));
    expect(result.ok && result.patch.instagramHandle).toBeNull();
  });

  it('geçersiz kullanıcı adı ve opaklık hatası döner', () => {
    expect(parseSettingsForm(form({ ...valid, instagramHandle: 'foo bar', watermarkOpacity: '5' }))).toEqual({
      ok: false,
      errors: { instagramHandle: HANDLE_ERROR, watermark: 'Filigran ayarları geçersiz.' },
    });
  });

  it('bilinmeyen konum reddedilir', () => {
    expect(parseSettingsForm(form({ ...valid, watermarkPosition: 'top-left' })).ok).toBe(false);
  });
});
