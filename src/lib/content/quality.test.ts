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
    expect(checkHoroscopeEntry(entry).entry!.body.length).toBeLessThanOrEqual(420);
    expect(checkHoroscopeEntry({ ...entry, yorum: entry.yorum.slice(0, 500) }, WEEKLY_LIMITS).issues[0].message).toMatch(/^600-850 karakter olmalı/);
    expect(checkSingleSign({ burc: entry }, 'aslan', WEEKLY_LIMITS).entry?.body.length).toBeGreaterThanOrEqual(600);
    expect(checkHoroscopeBatch(mockWeeklyBatch(), ['#burç'], WEEKLY_LIMITS).entries.size).toBe(12);
  });
});

describe('haftalık yasaklı ifadeler', () => {
  it('yorumda tarot sözcüğü ya da çekilen kartın adı geçerse o burcu reddeder', () => {
    const entry = mockWeeklyEntry('aslan');
    const forbidden = () => ['tarot', 'Kupa Ası'];
    expect(checkHoroscopeEntry(entry, WEEKLY_LIMITS, forbidden).issues).toEqual([]);
    const leaked = { ...entry, yorum: entry.yorum.replace('Haftanın ortasında', 'Kupa ası sana diyor ki haftanın ortasında') };
    expect(checkHoroscopeEntry(leaked, WEEKLY_LIMITS, forbidden).issues).toContainEqual({ field: 'yorum', message: 'Metinde "Kupa Ası" geçmemeli.' });
    const tarot = { ...entry, yorum: entry.yorum.replace('Haftanın ortasında', 'Tarot falın haftanın ortasında') };
    expect(checkHoroscopeBatch({ ...mockWeeklyBatch(), burclar: [tarot] }, ['#burç'], WEEKLY_LIMITS, forbidden).failedSigns.find((failed) => failed.sign === 'aslan')?.issues).toContainEqual({
      field: 'yorum',
      message: 'Metinde "tarot" geçmemeli.',
    });
  });
});

describe('parça halinde paket', () => {
  it('yalnızca istenen burçları değerlendirir; yarısından fazlası eksikse reddeder; gönderi alanlarını istenirse arar', () => {
    const signs = ['koc', 'boga', 'ikizler', 'yengec'] as const;
    const full = mockWeeklyBatch();
    const check = checkHoroscopeBatch(full, ['#burç'], WEEKLY_LIMITS, undefined, signs);
    expect([...check.entries.keys()]).toEqual([...signs]);
    expect(check.failedSigns).toEqual([]);
    const partial = checkHoroscopeBatch({ ...full, burclar: full.burclar.slice(0, 1) }, ['#burç'], WEEKLY_LIMITS, undefined, signs);
    expect(partial.failedSigns.map((failed) => failed.sign)).toEqual(['boga', 'ikizler', 'yengec']);
    expect(batchIssues(partial).map((issue) => issue.field)).toContain('burclar');
    const half = checkHoroscopeBatch({ ...full, burclar: full.burclar.slice(0, 2) }, ['#burç'], WEEKLY_LIMITS, undefined, signs);
    expect(batchIssues(half)).toEqual([]);
    const noPost = checkHoroscopeBatch({ ...full, caption: 'x' }, ['#burç'], WEEKLY_LIMITS, undefined, signs);
    expect(batchIssues(noPost).map((issue) => issue.field)).toContain('caption');
    expect(batchIssues(noPost, false)).toEqual([]);
  });
});

describe('uzun yorumun cümle sınırında kısaltılması', () => {
  it('sınırı aşan yorumdan sondaki cümleleri çıkarır; aralığa giremiyorsa ya da cümle sınırı yoksa reddeder', () => {
    const entry = mockWeeklyEntry('aslan');
    const long = `${entry.yorum} Hafta sonu için küçük bir kaçamak planlamak da iyi gelebilir. Pazar akşamı kendine sakin bir film gecesi yap. Yeni haftaya dinlenmiş ve umutlu girmek için telefonunu erkenden bir kenara bırak. Sevdiğin birine içten bir mesaj yazmak da gününü güzelleştirecek.`;
    expect(long.length).toBeGreaterThan(850);
    const { entry: trimmed, issues } = checkHoroscopeEntry({ ...entry, yorum: long }, WEEKLY_LIMITS);
    expect(issues).toEqual([]);
    expect(trimmed!.body.length).toBeLessThanOrEqual(850);
    expect(long.startsWith(trimmed!.body.replace(/[.!?…✨\s]+$/u, ''))).toBe(true);
    expect(trimmed!.body).toMatch(/[.!?…✨]$/u);
    const oneSentence = 'Bu hafta '.repeat(110).trim();
    expect(checkHoroscopeEntry({ ...entry, yorum: oneSentence }, WEEKLY_LIMITS).issues[0].message).toMatch(/^600-850 karakter olmalı/);
  });
});

describe('cümle sınırı tespiti', () => {
  it('sıra sayısı, saat ve ondalıktaki noktayı cümle sonu saymaz; açılış tırnağını önceki cümleye katmaz', () => {
    const entry = mockWeeklyEntry('aslan');
    const head = entry.yorum.replace(/ ✨$/, '.');
    const ordinal = `${head} Çarşamba günü Güneş 7. evini aydınlatırken saat 20.00 sularında içindeki sesi dinle, sevdiklerinle uzun bir sohbete otur, ertelediğin küçük işleri tek tek bitir, evini biraz toparla ve hafta sonuna doğru kendine yepyeni, heyecan verici bir hedef koy.`;
    expect(ordinal.length).toBeGreaterThan(850);
    const fitted = checkHoroscopeEntry({ ...entry, yorum: ordinal }, WEEKLY_LIMITS).entry!.body;
    expect(fitted.endsWith('7.')).toBe(false);
    expect(fitted).toBe(head);
    const quote = `${head} Hafta sonu kendine şunu söyle: "Kendine inan." Bu cümle sana güç verecek, sevdiklerinle geçireceğin zaman da seni besleyecek ve pazar akşamı sakin ve uzun bir yürüyüşle zihnini güzelce toparlayıp yeni haftaya hazır, umutlu ve enerjik başlayacaksın.`;
    expect(quote.length).toBeGreaterThan(850);
    expect(checkHoroscopeEntry({ ...entry, yorum: quote }, WEEKLY_LIMITS).entry!.body.endsWith('"')).toBe(false);
  });
});

describe('yasaklı ifadenin alanı', () => {
  it('kart adı başlıktaysa uyarı başlık alanına verilir', () => {
    const entry = { ...mockWeeklyEntry('aslan'), baslik: 'Kupa Ası haftası' };
    expect(checkHoroscopeEntry(entry, WEEKLY_LIMITS, () => ['Kupa Ası']).issues).toContainEqual({ field: 'baslik', message: 'Metinde "Kupa Ası" geçmemeli.' });
  });
});
