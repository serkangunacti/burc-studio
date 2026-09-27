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
      cronEnabled: true,
      dailyPlan: [
        { kind: 'horoscope', audience: 'kadin' },
        { kind: 'horoscope', audience: 'erkek' },
        { kind: 'tarot', audience: 'kadin' },
        { kind: 'tarot', audience: 'erkek' },
      ],
      baseHashtags: ['#burç', '#astroloji'],
      providerChain: [],
      spreadLoad: false,
      defaultFormat: '4x5',
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

describe('üretim ayarları', () => {
  it('Faz 0 kaydı yeni alanların varsayılanlarıyla okunur', () => {
    expect(parseStoredSettings({ instagramHandle: 'burc.studio' }).dailyPlan).toEqual([
      { kind: 'horoscope', audience: 'kadin' },
      { kind: 'horoscope', audience: 'erkek' },
      { kind: 'tarot', audience: 'kadin' },
      { kind: 'tarot', audience: 'erkek' },
    ]);
  });

  it('boş günlük plan, 2den fazla hashtag ve bilinmeyen sağlayıcı reddedilir', () => {
    expect(() => mergeSettings(DEFAULT_SETTINGS, { dailyPlan: [] })).toThrow();
    expect(() => mergeSettings(DEFAULT_SETTINGS, { baseHashtags: ['#a', '#b', '#c'] })).toThrow();
    expect(() => mergeSettings(DEFAULT_SETTINGS, { baseHashtags: ['burç'] })).toThrow();
    expect(() => mergeSettings(DEFAULT_SETTINGS, { providerChain: [{ id: 'openai' as never, enabled: true }] })).toThrow();
  });

  it('geçerli sağlayıcı tercihi kaydedilir', () => {
    const next = mergeSettings(DEFAULT_SETTINGS, { providerChain: [{ id: 'gemini-lite', enabled: true, dailyCap: 100 }] });
    expect(next.providerChain).toEqual([{ id: 'gemini-lite', enabled: true, dailyCap: 100 }]);
  });

  it('varsayılan format yalnızca 4x5 ya da 3x4 olabilir', () => {
    expect(mergeSettings(DEFAULT_SETTINGS, { defaultFormat: '3x4' }).defaultFormat).toBe('3x4');
    expect(() => mergeSettings(DEFAULT_SETTINGS, { defaultFormat: '5x5' as never })).toThrow();
  });
});
