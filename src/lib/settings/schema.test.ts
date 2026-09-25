import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  HANDLE_ERROR,
  mergeSettings,
  normalizeInstagramHandle,
  parseInstagramHandleInput,
  parseStoredSettings,
} from './schema';

describe('normalizeInstagramHandle', () => {
  it.each([
    ['@Foo.Bar ', 'foo.bar'],
    ['https://www.instagram.com/foo.bar/?hl=tr', 'foo.bar'],
    ['instagram.com/foo_bar', 'foo_bar'],
    ['  @@kisi  ', 'kisi'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeInstagramHandle(input)).toBe(expected);
  });
});

describe('parseInstagramHandleInput', () => {
  it('boş değer kullanıcı adını kaldırır', () => {
    expect(parseInstagramHandleInput('   ')).toEqual({ ok: true, value: null });
    expect(parseInstagramHandleInput('@')).toEqual({ ok: true, value: null });
  });

  it('geçerli adı normalize eder', () => {
    expect(parseInstagramHandleInput('@Burc.Studio')).toEqual({ ok: true, value: 'burc.studio' });
  });

  it.each(['foo bar', 'a'.repeat(31), 'Ayşe', 'foo-bar'])('%s reddedilir', (input) => {
    expect(parseInstagramHandleInput(input)).toEqual({ ok: false, error: HANDLE_ERROR });
  });
});

describe('ayar birleştirme', () => {
  it('kayıt yoksa varsayılanlar gelir', () => {
    expect(parseStoredSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({
      instagramHandle: null,
      watermark: { enabled: true, position: 'bottom-center', opacity: 0.55 },
    });
  });

  it('kısmi yama diğer alanları korur', () => {
    const next = mergeSettings(DEFAULT_SETTINGS, { watermark: { position: 'bottom-right' } });
    expect(next.watermark).toEqual({ enabled: true, position: 'bottom-right', opacity: 0.55 });
  });

  it('geçersiz opaklık reddedilir', () => {
    expect(() => mergeSettings(DEFAULT_SETTINGS, { watermark: { opacity: 1.5 } })).toThrow();
  });
});
