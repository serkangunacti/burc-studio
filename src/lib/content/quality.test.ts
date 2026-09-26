import { describe, expect, it } from 'vitest';
import { mockHoroscopeBatch, mockHoroscopeEntry, mockWeeklyBatch, mockWeeklyEntry } from '@/lib/llm/mock-content';
import { WEEKLY_LIMITS, batchIssues, checkHoroscopeBatch, checkHoroscopeEntry, checkSingleSign } from './quality';

const BASE = ['#burç', '#astroloji'];

describe('checkHoroscopeEntry', () => {
  it('geçerli girdiyi normalize eder', () => {
    const { entry, issues } = checkHoroscopeEntry({ ...mockHoroscopeEntry('ikizler'), burc: 'İKİZLER', sansliRenk: 'Pudra Pembe' });
    expect(issues).toEqual([]);
    expect(entry).toMatchObject({ sign: 'ikizler', luckyColor: 'pudra', scores: { love: 4, money: 3, health: 4 } });
  });

  it('kısa yorum, fazla emoji, İngilizce metin, puan, renk ve sayı hatalarını yakalar', () => {
    const { entry, issues } = checkHoroscopeEntry({
      ...mockHoroscopeEntry('koc'),
      yorum: 'Today the stars are with you and your plans will work out ✨✨✨',
      puanlar: { ask: 6, para: 3.5, saglik: 0 },
      sansliRenk: 'mor',
      sansliSayi: 100,
    });
    expect(entry).toBeNull();
    const fields = issues.map((issue) => issue.field);
    expect(fields).toEqual(expect.arrayContaining(['yorum', 'puanlar.ask', 'puanlar.para', 'puanlar.saglik', 'sansliRenk', 'sansliSayi']));
    expect(issues.some((issue) => issue.message === 'Metin Türkçe görünmüyor.')).toBe(true);
    expect(issues.some((issue) => issue.message.startsWith('En fazla 2 emoji'))).toBe(true);
  });

  it('yasaklı ifadeyi yakalar', () => {
    const { issues } = checkHoroscopeEntry({
      ...mockHoroscopeEntry('koc'),
      yorum: `${mockHoroscopeEntry('koc').yorum.slice(0, 300)} Hisse senedi al.`,
    });
    expect(issues.some((issue) => issue.message.includes('hisse senedi al'))).toBe(true);
  });
});

describe('checkHoroscopeBatch', () => {
  it('tam ve geçerli yanıtı kabul eder, hashtagleri birleştirir', () => {
    const check = checkHoroscopeBatch(mockHoroscopeBatch(), BASE);
    expect(check.entries.size).toBe(12);
    expect(check.failedSigns).toEqual([]);
    expect(check.post).toEqual({
      coverHook: 'Bugün yıldızlar senden yana ✨',
      caption: mockHoroscopeBatch().caption,
      hashtags: ['#burç', '#astroloji', '#günlükburç', '#yıldızlar'],
    });
    expect(batchIssues(check)).toEqual([]);
  });

  it('tekrar eden burcu yok sayar, eksik ve hatalı burçları listeler', () => {
    const raw = mockHoroscopeBatch();
    raw.burclar = raw.burclar.filter((entry) => entry.burc !== 'Balık');
    raw.burclar.push({ ...mockHoroscopeEntry('koc'), yorum: 'kısa' });
    raw.burclar[1] = { ...mockHoroscopeEntry('boga'), yorum: 'kısa' };
    const check = checkHoroscopeBatch(raw, BASE);
    expect(check.entries.size).toBe(10);
    expect(check.entries.get('koc')?.body).toBe(mockHoroscopeEntry('koc').yorum);
    expect(check.failedSigns.map((failed) => failed.sign)).toEqual(['boga', 'balik']);
    expect(check.failedSigns[1].issues).toEqual([{ field: 'burc', message: 'Bu burç yanıtta yok.' }]);
    expect(batchIssues(check)).toEqual([]);
  });

  it("6'dan fazla burç geçersizse ya da caption hashtag içeriyorsa yanıtı reddeder", () => {
    const raw = mockHoroscopeBatch();
    raw.burclar = raw.burclar.slice(0, 5);
    raw.caption = 'Günün yorumları burada, hemen oku ve paylaş arkadaşım #burç';
    const issues = batchIssues(checkHoroscopeBatch(raw, BASE));
    expect(issues.map((issue) => issue.field)).toEqual(expect.arrayContaining(['caption', 'burclar']));
  });
});

describe('checkSingleSign', () => {
  it('beklenen burç değilse reddeder', () => {
    expect(checkSingleSign({ burc: mockHoroscopeEntry('aslan') }, 'aslan').entry?.sign).toBe('aslan');
    expect(checkSingleSign({ burc: mockHoroscopeEntry('yay') }, 'aslan').issues).toContainEqual({
      field: 'burc',
      message: 'Aslan için yazılmalıydı.',
    });
  });
});

describe('gönderi alanlarının dili', () => {
  it('İngilizce kapak kancası ve caption yanıtı reddeder', () => {
    const raw = mockHoroscopeBatch();
    raw.kapakKanca = 'Your stars today';
    raw.caption = 'Save this post and tag a friend who really needs to hear this today!';
    const check = checkHoroscopeBatch(raw, BASE);
    expect(check.post).toBeNull();
    expect(batchIssues(check)).toContainEqual({ field: 'caption', message: 'Metin Türkçe görünmüyor.' });
  });
});

describe('haftalık sınırlar', () => {
  it('haftalık yorumu 600–850 aralığında ve en fazla 3 emojiyle kabul eder', () => {
    const entry = mockWeeklyEntry('aslan');
    expect(checkHoroscopeEntry(entry, WEEKLY_LIMITS).issues).toEqual([]);
    expect(checkHoroscopeEntry(entry).issues).toContainEqual({ field: 'yorum', message: expect.stringMatching(/^280-420 karakter olmalı/) });
    expect(checkHoroscopeEntry({ ...entry, yorum: entry.yorum.slice(0, 500) }, WEEKLY_LIMITS).issues[0].message).toMatch(/^600-850 karakter olmalı/);
    expect(checkSingleSign({ burc: entry }, 'aslan', WEEKLY_LIMITS).entry?.body.length).toBeGreaterThanOrEqual(600);
    expect(checkHoroscopeBatch(mockWeeklyBatch(), ['#burç'], WEEKLY_LIMITS).entries.size).toBe(12);
  });
});
