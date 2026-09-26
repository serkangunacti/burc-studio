# Faz 3a: Pazartesi Haftalık Burç Yorumları — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Her pazartesi, günlük paketin yanında kadın ve erkek için ayrı birer **haftalık** carousel üretmek. Carousel'de kapak, 12 burç kartı ve kapanış bulunur. Her burç kartında 600–850 karakterlik geniş, genel bir haftalık yorum yer alır. Yorum, haftanın gökyüzünü ve o burç için çekilen haftanın tarot kartını tek metinde harmanlar; kartta burç/tarot ayrımı yoktur.

**Architecture:**
- Günlük üretim akışı bir **üretim tanımıyla** (`GenerationSpec`) genelleştirilir. Günlük ve haftalık akış yalnızca şu noktalarda ayrışır:
  - prompt,
  - uzunluk sınırları,
  - şablon sürümü,
  - bağlam: gökyüzü ya da haftanın gökyüzü + tarot kartları.
- Aynı JSON şeması, aynı kalite kapısı (sınırlar parametreli), aynı sürümleme, gönderi sayfası, arşiv ve indirme kullanılır.
- Haftalık gönderiler `kind='weekly'` ve `date=pazartesi` ile saklanır. Görünüm, dondurulmuş `pastel@1` ailesine dokunmadan ayrı bir `pastel-weekly@1` şablonuyla çizilir.

**Tech Stack:** Mevcut yığın; yeni paket yok.

**Spec:** `docs/superpowers/specs/2026-09-25-burc-studio-design.md`. Bu planla spec'e §1.7 Haftalık yorumlar eklenir (Task 1).

**Kullanıcı kararları (26.09.2026):**
- Haftalık yorum yalnızca pazartesi yayımlanır ve kadın/erkek ayrıdır.
- Her burç için tek kart vardır. Tarot ve burç ayrımı yapılmaz; genel, geniş ve uzun bir yorum yazılır.
- Pazartesi günleri günlük ve haftalık gönderiler birlikte çıkar.
- Günlük tarot kalır (sonraki faz).

## Global Constraints

- Faz 0–4a kuralları geçerlidir. Dondurulmuş `pastel-v1/` ve `pastel-v1-reels/` klasörleri değişmez; render-chain altın testi yeşil kalır.
- Çalışma dalı `faz-3a-haftalik`, başlangıç noktası güncel `main`.
- Haftalık metin sınırları (grafem):

  | Alan | Uzunluk | En fazla emoji |
  |---|---|---|
  | `baslik` | 3–40 | 1 |
  | `yorum` | **600–850**, tek paragraf | 3 |
  | `kisa` | 20–140 | 1 |

  Diğer alanlar günlük ile aynıdır.
- Hafta etiketi pazartesi–pazar aralığıdır, örneğin `28 Eylül – 4 Ekim`. Haftalık gönderi yalnızca pazartesi tarihiyle üretilebilir; başka bir gün `400` döner.
- Tarot:
  - Her kitle-hafta üretiminde `crypto` ile karıştırılmış 78 kartlık desteden birbirinden farklı 12 kart çekilir.
  - Kart, yorumun `meta.tarotCardId` alanında saklanır.
  - Metin kartın adını ya da "tarot" kelimesini kullanmaz, temasını doğal biçimde örer.
  - Tek burç yenilemede burcun mevcut kartı korunur.
- Prompt sürümü `haftalik-v1`, şablon sürümü `pastel-weekly@1`, dosya adı `YYYY-MM-DD_<kitle>-haftalik_NN-…`.
- Haftalık gönderilerde Reels paneli gösterilmez (Reels girişi "Günlük" başlıklıdır; haftalık Reels ayrı iştir).

## Review Focus

1. **Pazartesi olmayan tarih:** Haftalık üretim isteği reddedilmeli. Cron salı günü haftalık üretmemeli. → Task 5 HTTP ve cron testleri.
2. **Kısa haftalık yorum:** Model 850'yi aşan ya da 600'ün altında kalan metin dönerse o burç tek başına yeniden istenmeli; 420 sınırına göre kırpılmamalı. → Task 3 kalite testleri, Task 4 servis testi.
3. **Aynı hafta, iki kitle:** Kadın ve erkek çekilişleri bağımsız olmalı. Bir çekilişte aynı kart iki burca düşmemeli. → Task 2 ve Task 4 testleri.
4. **En uzun haftalık metin (850 grafem):** 4:5 kartta kırpılmadan sığmalı. → Task 6 şablon testi ve Task 7 E2E (`scrollHeight`).
5. **Pazartesi iş yükü:** Cron dört gönderiyi (2 günlük + 2 haftalık) 300 saniye içinde üretmeli. Biri başarısız olursa diğerleri yine üretilmeli. → Task 5 cron testi.

---

### Task 1: Spec eki, tarot destesi ve çekiliş

**Files:**
- Modify: `docs/superpowers/specs/2026-09-25-burc-studio-design.md` (§1.7 ekle)
- Create: `src/lib/tarot/deck.ts`, `src/lib/tarot/draw.ts`
- Test: `src/lib/tarot/deck.test.ts`, `src/lib/tarot/draw.test.ts`

**Interfaces:**
- Produces:
```ts
// src/lib/tarot/deck.ts
export type TarotSuit = 'kupa' | 'degnek' | 'kilic' | 'tilsim';
export type TarotCard = { id: string; name: string; arcana: 'buyuk' | 'kucuk'; suit: TarotSuit | null; keywords: string };
export const TAROT_DECK: readonly TarotCard[]; // 78
export function getTarotCard(id: string): TarotCard; // bilinmeyende fırlatır
// src/lib/tarot/draw.ts
export function drawCards(count: number, random?: (max: number) => number): TarotCard[]; // tekrarsız
```

- [ ] **Step 1: Spec eki**

`## 1. İçerik motoru` bölümünde `### 1.6 Özel gündem`ten sonra ekle:
```markdown
### 1.7 Haftalık yorumlar (26.09.2026 kararı)

- **Ne zaman:** Her pazartesi, günlük paketle birlikte kadın ve erkek için ayrı birer haftalık carousel üretilir: kapak, 12 burç kartı ve kapanış.
- **Kart içeriği:** Her burç tek kart. Başlık ve 600–850 karakterlik geniş, genel bir haftalık yorum; burç ve tarot ayrımı yoktur.
- **Metnin kaynağı:** Yorum, haftanın gökyüzü olaylarını (ay evreleri, burç geçişleri, retro başlangıç ve bitişleri) ve o burç için çekilen haftanın tarot kartını tek metinde harmanlar. Kartın adı metinde geçmez.
- **Görünüm ve üretim:**
  - Görünüm `pastel-weekly@1` şablonudur.
  - Cron pazartesi sabahı günlük paketin yanında haftalık paketi de üretir.
  - Arşivde "Haftalık" süzgeciyle ayrılır.
```

- [ ] **Step 2: Başarısız testleri yaz**

`src/lib/tarot/deck.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { TAROT_DECK, getTarotCard } from './deck';

describe('tarot destesi', () => {
  it('22 büyük ve 56 küçük arkanadan oluşan, kimlikleri tekil 78 kart içerir', () => {
    expect(TAROT_DECK).toHaveLength(78);
    expect(new Set(TAROT_DECK.map((card) => card.id)).size).toBe(78);
    expect(TAROT_DECK.filter((card) => card.arcana === 'buyuk')).toHaveLength(22);
    expect(TAROT_DECK.filter((card) => card.suit === 'kupa')).toHaveLength(14);
  });

  it('Türkçe adları ve anahtar kelimeleri verir', () => {
    expect(getTarotCard('yildiz')).toMatchObject({ name: 'Yıldız', arcana: 'buyuk' });
    expect(getTarotCard('kupa-as').name).toBe('Kupa Ası');
    expect(getTarotCard('tilsim-kralice').name).toBe('Tılsım Kraliçesi');
    expect(getTarotCard('kilic-10').keywords).toContain('tamamlanma');
    expect(() => getTarotCard('yok')).toThrow('Bilinmeyen tarot kartı: yok');
  });
});
```

`src/lib/tarot/draw.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { TAROT_DECK } from './deck';
import { drawCards } from './draw';

describe('drawCards', () => {
  it('istenen sayıda, tekrarsız kart çeker', () => {
    for (let run = 0; run < 50; run++) {
      const cards = drawCards(12);
      expect(cards).toHaveLength(12);
      expect(new Set(cards.map((card) => card.id)).size).toBe(12);
    }
  });

  it('karıştırma verilen rastgele kaynağı kullanır (Fisher–Yates)', () => {
    expect(drawCards(3, () => 0).map((card) => card.id)).toEqual([TAROT_DECK[1].id, TAROT_DECK[2].id, TAROT_DECK[3].id]);
  });
});
```

- [ ] **Step 3: Testlerin başarısız olduğunu gör**

Run: `npx vitest run src/lib/tarot`
Expected: FAIL. `./deck` ve `./draw` bulunamaz.

- [ ] **Step 4: Uygulamayı yaz**

`src/lib/tarot/deck.ts`: 78 kartlık veri, scratchpad'deki `deck.ts` taslağıdır. `getTarotCard` eklenir:
```ts
export function getTarotCard(id: string): TarotCard {
  const card = TAROT_DECK.find((candidate) => candidate.id === id);
  if (!card) throw new Error(`Bilinmeyen tarot kartı: ${id}`);
  return card;
}
```
(Deste verisinin tam metni için `MAJOR`, `SUITS` ve `RANKS` tabloları taslaktaki gibi kopyalanır.)

`src/lib/tarot/draw.ts`:
```ts
import { randomInt } from 'node:crypto';
import { TAROT_DECK, type TarotCard } from './deck';

// Fisher–Yates; `random(max)` 0 ≤ n < max döndürür.
export function drawCards(count: number, random: (max: number) => number = randomInt): TarotCard[] {
  const deck = [...TAROT_DECK];
  for (let index = deck.length - 1; index > 0; index--) {
    const swap = random(index + 1);
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }
  return deck.slice(0, count);
}
```
`random = () => 0` testinin beklentisi bu algoritmaya göre hesaplanır. Uygulama yazıldıktan sonra beklenti bir kez doğrulanır; tutmazsa gerçek çıktı ledger'da gerekçesiyle not edilerek teste yazılır.

- [ ] **Step 5: Testlerin geçtiğini gör ve commit**

Run: `npx vitest run src/lib/tarot && npm run typecheck && npm run lint`
```bash
git add docs/superpowers/specs src/lib/tarot
git commit -m "feat: 78 kartlık Türkçe tarot destesi ve tekrarsız çekiliş; spec'e haftalık yorumlar" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Haftanın gökyüzü

**Files:**
- Create: `src/lib/astro/week.ts`
- Test: `src/lib/astro/week.test.ts`

**Interfaces:**
- Consumes: `getSkySnapshot`, `eclipticLongitude`, `BODY_NAMES_TR`, `MOON_PHASE_NAMES_TR` (`src/lib/astro/sky.ts`); `SearchMoonQuarter`, `NextMoonQuarter` (astronomy-engine); tarih yardımcıları
- Produces:
```ts
export function isMonday(date: DateKey): boolean;
export function weekLabelTr(monday: DateKey): string; // '28 Eylül – 4 Ekim'
export type WeekSky = { monday: DateKey; label: string; sunSigns: SignSlug[]; events: string[] };
export function getWeekSky(monday: DateKey): WeekSky;
export function describeWeekSkyTr(week: WeekSky): string;
```

- [ ] **Step 1: Başarısız testi yaz**

`src/lib/astro/week.test.ts` (değerler astronomy-engine ile 26.09.2026'da hesaplandı):
```ts
import { describe, expect, it } from 'vitest';
import { describeWeekSkyTr, getWeekSky, isMonday, weekLabelTr } from './week';

describe('haftanın gökyüzü', () => {
  it('pazartesiyi tanır ve hafta etiketini yazar', () => {
    expect(isMonday('2026-09-28')).toBe(true);
    expect(isMonday('2026-09-29')).toBe(false);
    expect(weekLabelTr('2026-09-28')).toBe('28 Eylül – 4 Ekim');
    expect(weekLabelTr('2026-12-28')).toBe('28 Aralık – 3 Ocak');
  });

  it('28 Eylül haftasının burç geçişlerini, retro başlangıcını ve ay evresini sırayla listeler', () => {
    const week = getWeekSky('2026-09-28');
    expect(week.label).toBe('28 Eylül – 4 Ekim');
    expect(week.sunSigns).toEqual(['terazi']);
    expect(week.events).toEqual([
      '28 Eylül: Mars Aslan burcuna geçiyor.',
      '30 Eylül: Merkür Akrep burcuna geçiyor.',
      expect.stringMatching(/^3 Ekim: Son Dördün \((İkizler|Yengeç)\)\.$/),
      '3 Ekim: Venüs retrosu başlıyor.',
    ]);
    expect(describeWeekSkyTr(week)).toContain('Güneş hafta boyunca Terazi burcunda.');
  });

  it('5 Ekim haftasında Terazi yeni ayını bulur', () => {
    expect(getWeekSky('2026-10-05').events).toContainEqual('10 Ekim: Yeni Ay (Terazi).');
  });

  it('pazartesi olmayan tarih için hata verir', () => {
    expect(() => getWeekSky('2026-09-29')).toThrow('Haftalık gökyüzü pazartesi tarihiyle istenmeli');
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `npx vitest run src/lib/astro/week.test.ts`
Expected: FAIL. `./week` bulunamaz.

- [ ] **Step 3: Uygulamayı yaz**

`src/lib/astro/week.ts`:
```ts
import { NextMoonQuarter, SearchMoonQuarter } from 'astronomy-engine';
import { addDays, formatDateShortTr, istanbulDateKey, istanbulDayStart, type DateKey } from '@/lib/date/istanbul';
import { getSign, signFromLongitude, type SignSlug } from '@/lib/zodiac/signs';
import { BODY_NAMES_TR, PLANETS, eclipticLongitude, getSkySnapshot } from './sky';

export type WeekSky = { monday: DateKey; label: string; sunSigns: SignSlug[]; events: string[] };

const QUARTER_NAMES = ['Yeni Ay', 'İlk Dördün', 'Dolunay', 'Son Dördün'] as const;

export function isMonday(date: DateKey): boolean {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 1;
}

export function weekLabelTr(monday: DateKey): string {
  return `${formatDateShortTr(monday)} – ${formatDateShortTr(addDays(monday, 6))}`;
}

export function getWeekSky(monday: DateKey): WeekSky {
  if (!isMonday(monday)) throw new Error('Haftalık gökyüzü pazartesi tarihiyle istenmeli');
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const snapshots = days.map((day) => getSkySnapshot(day));
  const before = getSkySnapshot(addDays(monday, -1));
  const dated: { at: number; text: string }[] = [];

  snapshots.forEach((snapshot, index) => {
    const at = istanbulDayStart(snapshot.dateKey).getTime();
    const label = formatDateShortTr(snapshot.dateKey);
    for (const ingress of snapshot.ingresses) {
      if (ingress.body === 'Moon') continue;
      dated.push({ at: at + 1, text: `${label}: ${BODY_NAMES_TR[ingress.body]} ${getSign(ingress.sign).name} burcuna geçiyor.` });
    }
    const previous = index === 0 ? before : snapshots[index - 1];
    for (const planet of PLANETS) {
      const was = previous.retrogrades.includes(planet);
      const is = snapshot.retrogrades.includes(planet);
      if (!was && is) dated.push({ at: at + 3, text: `${label}: ${BODY_NAMES_TR[planet]} retrosu başlıyor.` });
      if (was && !is) dated.push({ at: at + 3, text: `${label}: ${BODY_NAMES_TR[planet]} retrosu bitiyor.` });
    }
  });

  const start = istanbulDayStart(monday);
  const end = istanbulDayStart(addDays(monday, 7));
  let quarter = SearchMoonQuarter(start);
  while (quarter.time.date < end) {
    const key = istanbulDateKey(quarter.time.date);
    const sign = getSign(signFromLongitude(eclipticLongitude('Moon', quarter.time.date))).name;
    dated.push({ at: istanbulDayStart(key).getTime() + 2, text: `${formatDateShortTr(key)}: ${QUARTER_NAMES[quarter.quarter]} (${sign}).` });
    quarter = NextMoonQuarter(quarter);
  }

  return {
    monday,
    label: weekLabelTr(monday),
    sunSigns: [...new Set(snapshots.map((snapshot) => snapshot.sunSign))],
    events: dated.sort((a, b) => a.at - b.at).map((event) => event.text),
  };
}

export function describeWeekSkyTr(week: WeekSky): string {
  const sun =
    week.sunSigns.length === 1
      ? `Güneş hafta boyunca ${getSign(week.sunSigns[0]).name} burcunda.`
      : `Güneş bu hafta ${week.sunSigns.map((sign) => getSign(sign).name).join(' burcundan ')} burcuna geçiyor.`;
  return [sun, ...(week.events.length ? week.events : ['Bu hafta büyük bir gökyüzü olayı yok; mevcut akış sürüyor.'])].join('\n');
}
```
(Aynı gün içindeki sıralama: önce burç geçişleri, sonra ay evresi, sonra retro. Test bu sırayı bekler.)

- [ ] **Step 4: Geçtiğini gör ve commit**

Run: `npx vitest run src/lib/astro && npm run typecheck && npm run lint`
```bash
git add src/lib/astro/week.ts src/lib/astro/week.test.ts
git commit -m "feat: haftanın gökyüzü özeti (geçişler, retrolar, ay evreleri)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Haftalık tür, metin sınırları, prompt ve sahte model

**Files:**
- Modify:
  - `src/lib/content/types.ts` (`READING_KINDS` içine `'weekly'`)
  - `src/db/schema.ts` (`ReadingMeta.tarotCardId?`)
  - `src/lib/content/quality.ts` (sınırlar parametreli)
  - `src/lib/content/quality.test.ts`
  - `src/lib/llm/mock-content.ts`, `src/lib/llm/mock-model.ts`, `src/lib/llm/mock-model.test.ts`
- Create: `src/lib/content/weekly-prompt.ts`, `src/db/migrations/0002_weekly.sql` (drizzle-kit)
- Test: `src/lib/content/weekly-prompt.test.ts`

**Interfaces:**
- Produces:
```ts
// src/lib/content/quality.ts
export type TextLimit = { min: number; max: number; maxEmoji: number };
export type EntryLimits = { baslik: TextLimit; yorum: TextLimit; kisa: TextLimit };
export const DAILY_LIMITS: EntryLimits; // 3–40/1, 280–420/2, 20–140/1
export const WEEKLY_LIMITS: EntryLimits; // 3–40/1, 600–850/3, 20–140/1
export function checkHoroscopeEntry(raw, limits?: EntryLimits); export function checkSingleSign(raw, expected, limits?);
export function checkHoroscopeBatch(raw, baseHashtags, limits?);
// src/lib/content/weekly-prompt.ts
export const WEEKLY_PROMPT_VERSION = 'haftalik-v1';
export const WEEKLY_INSTRUCTIONS: string;
export type WeeklyPromptInput = { monday: DateKey; audience: Audience; week: WeekSky; cards: ReadonlyMap<SignSlug, TarotCard>; recent: RecentHeadline[] };
export function buildWeeklyBatchPrompt(input: WeeklyPromptInput): { instructions: string; prompt: string };
export function buildWeeklySignPrompt(input: WeeklyPromptInput & { sign: SignSlug; issues: QualityIssue[] }): { instructions: string; prompt: string };
// src/lib/llm/mock-content.ts
export function mockWeeklyEntry(slug: SignSlug): HoroscopeEntryRaw; export function mockWeeklyBatch(): HoroscopeBatchRaw;
```
Sahte model, prompt'ta `HAFTALIK YORUM` işaretini görürse haftalık içerik döner.

- [ ] **Step 1: Başarısız testleri yaz**

`src/lib/content/quality.test.ts` sonuna ekle:
```ts
describe('haftalık sınırlar', () => {
  it('haftalık yorumu 600–850 aralığında ve en fazla 3 emojiyle kabul eder', () => {
    const entry = mockWeeklyEntry('aslan');
    expect(checkHoroscopeEntry(entry, WEEKLY_LIMITS).issues).toEqual([]);
    expect(checkHoroscopeEntry(entry).issues).toContainEqual({ field: 'yorum', message: expect.stringMatching(/^280-420 karakter olmalı/) });
    expect(checkHoroscopeEntry({ ...entry, yorum: entry.yorum.slice(0, 500) }, WEEKLY_LIMITS).issues[0].message).toMatch(/^600-850 karakter olmalı/);
    expect(checkHoroscopeBatch(mockWeeklyBatch(), ['#burç'], WEEKLY_LIMITS).entries.size).toBe(12);
  });
});
```
(Importlara `WEEKLY_LIMITS`, `mockWeeklyBatch` ve `mockWeeklyEntry` eklenir.)

`src/lib/content/weekly-prompt.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { getWeekSky } from '@/lib/astro/week';
import { getTarotCard } from '@/lib/tarot/deck';
import { SIGN_SLUGS } from '@/lib/zodiac/signs';
import { WEEKLY_INSTRUCTIONS, buildWeeklyBatchPrompt, buildWeeklySignPrompt } from './weekly-prompt';

const cards = new Map(SIGN_SLUGS.map((sign, index) => [sign, getTarotCard(index === 0 ? 'yildiz' : 'kupa-as')]));
const base = { monday: '2026-09-28', audience: 'erkek' as const, week: getWeekSky('2026-09-28'), cards, recent: [] };

describe('haftalık prompt', () => {
  it('hafta etiketini, haftanın gökyüzünü ve her burcun kartını içerir; kart adının metinde geçmemesini ister', () => {
    const { instructions, prompt } = buildWeeklyBatchPrompt(base);
    expect(instructions).toBe(WEEKLY_INSTRUCTIONS);
    expect(prompt).toContain('HAFTALIK YORUM');
    expect(prompt).toContain('Hafta: 28 Eylül – 4 Ekim.');
    expect(prompt).toContain('Bu yorumlar erkek okurlar için.');
    expect(prompt).toContain('30 Eylül: Merkür Akrep burcuna geçiyor.');
    expect(prompt).toContain('- Koç (koc, 21 Mart – 19 Nisan): cesur, girişken, sabırsız, enerjik — haftanın kartı: Yıldız (umut, ilham, iyileşme, yenilenmiş inanç)');
    expect(WEEKLY_INSTRUCTIONS).toContain('600–850 karakter');
    expect(WEEKLY_INSTRUCTIONS).toContain('kartın adını');
  });

  it('tek burç promptu yalnızca o burcu ve kartını ister', () => {
    const { prompt } = buildWeeklySignPrompt({ ...base, sign: 'koc', issues: [{ field: 'yorum', message: '600-850 karakter olmalı (şu an 420).' }] });
    expect(prompt).toContain('Yalnızca şu burç için yaz: Koç (koc)');
    expect(prompt).toContain('haftanın kartı: Yıldız');
    expect(prompt).toContain('- yorum: 600-850 karakter olmalı (şu an 420).');
    expect(prompt).not.toContain('- Boğa (boga');
  });
});
```

`src/lib/llm/mock-model.test.ts` sonuna ekle:
```ts
  it('haftalık istemde uzun haftalık yorumlar döner', async () => {
    const { object } = await generateObject({ model: createMockModel(), schema: horoscopeBatchSchema, prompt: 'HAFTALIK YORUM — her burç için yaz', maxRetries: 0 });
    expect(checkHoroscopeBatch(object, ['#burç'], WEEKLY_LIMITS).entries.size).toBe(12);
  });
```
(Bu `it` mevcut `describe` bloğunun içine eklenir; importlara `WEEKLY_LIMITS` eklenir.)

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `npx vitest run src/lib/content src/lib/llm`
Expected: FAIL. `WEEKLY_LIMITS`, `./weekly-prompt` ve `mockWeeklyEntry` bulunamaz.

- [ ] **Step 3: Uygulamayı yaz**

`src/lib/content/types.ts`: `READING_KINDS` → `['horoscope', 'tarot', 'special', 'weekly'] as const`.

`src/db/schema.ts`: `ReadingMeta` tipine `tarotCardId?: string` ekle. Ardından:
```bash
npx drizzle-kit generate --name weekly
```
Expected: `0002_weekly.sql` dosyası `ALTER TYPE "public"."reading_kind" ADD VALUE 'weekly';` içerir.

`src/lib/content/quality.ts`:
1. `textIssues` imzası aynı kalır.
2. Şunları ekle:
```ts
export type TextLimit = { min: number; max: number; maxEmoji: number };
export type EntryLimits = { baslik: TextLimit; yorum: TextLimit; kisa: TextLimit };
export const DAILY_LIMITS: EntryLimits = {
  baslik: { min: 3, max: 40, maxEmoji: 1 },
  yorum: { min: 280, max: 420, maxEmoji: 2 },
  kisa: { min: 20, max: 140, maxEmoji: 1 },
};
export const WEEKLY_LIMITS: EntryLimits = { ...DAILY_LIMITS, yorum: { min: 600, max: 850, maxEmoji: 3 } };
```
3. `checkHoroscopeEntry(raw, limits: EntryLimits = DAILY_LIMITS)` içindeki üç `textIssues` çağrısı `limits.baslik`, `limits.yorum` ve `limits.kisa` kullanır.
4. `checkSingleSign(raw, expected, limits = DAILY_LIMITS)` ve `checkHoroscopeBatch(raw, baseHashtags, limits = DAILY_LIMITS)` sınırları `checkHoroscopeEntry`'ye geçirir.

`src/lib/content/weekly-prompt.ts`:
```ts
import { describeWeekSkyTr, type WeekSky } from '@/lib/astro/week';
import type { DateKey } from '@/lib/date/istanbul';
import type { TarotCard } from '@/lib/tarot/deck';
import { SIGNS, getSign, type SignSlug } from '@/lib/zodiac/signs';
import { LUCKY_COLOR_IDS } from './lucky-colors';
import type { QualityIssue } from './quality';
import type { Audience, RecentHeadline } from './types';

export const WEEKLY_PROMPT_VERSION = 'haftalik-v1';

export const WEEKLY_INSTRUCTIONS = [
  "Sen Instagram'da her pazartesi paylaşılan haftalık burç yorumları yazan, Türkçe konuşan bir astroloji içerik yazarısın.",
  '',
  'Üslup:',
  '- Okura "sen" diye hitap et; sıcak, pozitif, cesaretlendirici ol, yer yer hafif ve zararsız bir espri kat.',
  '- Haftayı geniş bir bakışla anlat: haftanın başı, ortası ve sonu için somut öneriler ve küçük senaryolar ver; her burca uyacak genel cümlelerden kaçın.',
  '- Her burç için sana verilen haftanın kartının temasını yorumun içine doğal biçimde ör; kartın adını, "tarot" ya da "kart" kelimesini kullanma, metni burç ve tarot diye bölme.',
  '- Gökyüzü olaylarını gündelik dille yorumla; teknik terimleri gerekiyorsa tek cümleyle aç.',
  '- Emoji ölçülü olsun: yorumda en fazla 3, kısa metinde ve başlıkta en fazla 1.',
  '- Sağlık, ilaç, yatırım, borsa, kripto ya da bahis konusunda talimat verme; korkutucu ya da kaderci kehanetlerde bulunma.',
  '- Kadın ve erkek okurlara yazılan yorumlar bakış açısı ve örneklerle farklılaşsın; aşağılayıcı ya da klişe cinsiyet kalıplarına başvurma; "Koç kadını" gibi kalıplarla hitap etme.',
  '',
  'Biçim kuralları:',
  '- "baslik": en fazla 40 karakter.',
  '- "yorum": 600–850 karakter arası TEK paragraf; satır sonu kullanma.',
  '- "kisa": en fazla 140 karakter; haftanın özü.',
  '- "puanlar": ask, para ve saglik için haftalık 1–5 arası tam sayılar.',
  `- "sansliRenk": yalnızca şu kimliklerden biri: ${LUCKY_COLOR_IDS.join(', ')}.`,
  '- "sansliSayi": 1–99 arası tam sayı.',
  '- "kapakKanca": carousel kapağı için en fazla 60 karakterlik, haftayı özetleyen merak uyandıran cümle.',
  '- "caption": Instagram açıklaması; en fazla 700 karakter, hashtag içermez, okuru kaydetmeye ve arkadaşını etiketlemeye davet eder.',
  '- "hashtagler": en fazla 3 Türkçe hashtag önerisi.',
  '- Yanıtı yalnızca istenen JSON nesnesi olarak ver; önüne ya da arkasına açıklama ekleme.',
].join('\n');

export type WeeklyPromptInput = {
  monday: DateKey;
  audience: Audience;
  week: WeekSky;
  cards: ReadonlyMap<SignSlug, TarotCard>;
  recent: RecentHeadline[];
};

const AUDIENCE_TEXT: Record<Audience, string> = {
  kadin: 'Bu yorumlar kadın okurlar için. Örneklerini ve senaryolarını onların gündelik hayatından seç.',
  erkek: 'Bu yorumlar erkek okurlar için. Örneklerini ve senaryolarını onların gündelik hayatından seç.',
};

const ENTRY_SHAPE =
  '{"burc": "koc", "baslik": "...", "yorum": "...", "kisa": "...", "puanlar": {"ask": 4, "para": 3, "saglik": 5}, "sansliRenk": "lila", "sansliSayi": 7}';

function signLine(sign: SignSlug, cards: ReadonlyMap<SignSlug, TarotCard>): string {
  const info = getSign(sign);
  const card = cards.get(sign);
  return `- ${info.name} (${info.slug}, ${info.dateRange}): ${info.traits}${card ? ` — haftanın kartı: ${card.name} (${card.keywords})` : ''}`;
}

function contextLines(input: WeeklyPromptInput): string[] {
  return ['HAFTALIK YORUM', `Hafta: ${input.week.label}.`, AUDIENCE_TEXT[input.audience], '', 'Haftanın gökyüzü:', describeWeekSkyTr(input.week), ''];
}

function recentSection(recent: RecentHeadline[]): string {
  if (recent.length === 0) return 'Geçen hafta yazılmış yorum yok.';
  return ['Geçen hafta yazdıkların (tekrar etme):', ...recent.map((item) => `- ${getSign(item.sign).name}: ${item.headline} — ${item.short}`)].join('\n');
}

export function buildWeeklyBatchPrompt(input: WeeklyPromptInput): { instructions: string; prompt: string } {
  const prompt = [
    ...contextLines(input),
    'Burçlar:',
    ...SIGNS.map((sign) => signLine(sign.slug, input.cards)),
    '',
    recentSection(input.recent),
    '',
    'Her burç için bir haftalık yorum yaz ve şu JSON biçiminde yanıt ver:',
    `{"kapakKanca": "...", "caption": "...", "hashtagler": ["#..."], "burclar": [${ENTRY_SHAPE}]}`,
    '"burclar" dizisinde 12 burcun her biri tam bir kez, yukarıdaki sırayla ve "burc" alanında parantez içindeki kimlikle yer almalı.',
  ].join('\n');
  return { instructions: WEEKLY_INSTRUCTIONS, prompt };
}

export function buildWeeklySignPrompt(input: WeeklyPromptInput & { sign: SignSlug; issues: QualityIssue[] }): { instructions: string; prompt: string } {
  const sign = getSign(input.sign);
  const prompt = [
    ...contextLines(input),
    `Yalnızca şu burç için yaz: ${sign.name} (${sign.slug})`,
    signLine(input.sign, input.cards),
    '',
    recentSection(input.recent.filter((item) => item.sign === input.sign)),
    '',
    ...(input.issues.length
      ? ['Önceki denemede şu sorunlar vardı, bunları düzelt:', ...input.issues.map((issue) => `- ${issue.field}: ${issue.message}`), '']
      : []),
    'Şu JSON biçiminde yanıt ver:',
    `{"burc": ${ENTRY_SHAPE.replace('"koc"', `"${sign.slug}"`)}}`,
  ].join('\n');
  return { instructions: WEEKLY_INSTRUCTIONS, prompt };
}
```

`src/lib/llm/mock-content.ts` sonuna ekle:
```ts
export function mockWeeklyEntry(slug: SignSlug): HoroscopeEntryRaw {
  const daily = mockHoroscopeEntry(slug);
  const { name } = getSign(slug);
  return {
    ...daily,
    baslik: `${name} için geniş bir hafta`,
    yorum: `${daily.yorum.replace(/ ✨$/, '.')} Haftanın ortasında işlerin hızlandığını hissedeceksin; yarım kalan bir konuşmayı tamamlamak için doğru an çarşamba gibi görünüyor. Hafta sonuna doğru ise kendine ayırdığın zaman sana yeni bir bakış açısı kazandıracak, sevdiklerinle kuracağın küçük planlar moralini yükseltecek ✨`,
    kisa: `${name}: Haftanın ortasında hızlan, hafta sonunu kendine ayır ✨`,
  };
}

export function mockWeeklyBatch(): HoroscopeBatchRaw {
  return { ...mockHoroscopeBatch(), kapakKanca: 'Haftanın yıldızları senin için ne diyor? ✨', burclar: SIGN_SLUGS.map(mockWeeklyEntry) };
}
```
(`mockWeeklyEntry('koc').yorum` 600–850 grafem aralığında olmalı; quality testi bunu doğrular. Uzunluk tutmazsa cümle eklenir ya da kısaltılır.)

`src/lib/llm/mock-model.ts`:
1. `import { mockHoroscopeBatch, mockHoroscopeEntry, mockWeeklyBatch, mockWeeklyEntry } from './mock-content';`
2. `doGenerate` içinde `const text = JSON.stringify(prompt);` satırını kullan ve `const weekly = text.includes('HAFTALIK YORUM');` ekle.
3. Tek burç için `weekly ? mockWeeklyEntry : mockHoroscopeEntry`, paket için `weekly ? mockWeeklyBatch() : mockHoroscopeBatch()` seç.

- [ ] **Step 4: Geçtiğini gör ve commit**

Run: `npx vitest run src/lib/content src/lib/llm && npm run typecheck && npm run lint`
```bash
git add src/lib/content src/lib/llm src/db
git commit -m "feat: haftalık tür, 600–850 karakter sınırları, haftalık prompt ve sahte içerik" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Üretim tanımı ve haftalık üretim servisi

**Files:**
- Create: `src/lib/content/generation-spec.ts`
- Modify: `src/lib/content/horoscope-service.ts`, `src/lib/content/horoscope-service.test.ts`
- Test: `src/lib/content/weekly-service.test.ts`

**Interfaces:**
- Consumes: Task 1–3
- Produces:
```ts
// src/lib/content/generation-spec.ts
export type GeneratedKind = 'horoscope' | 'weekly';
export const GENERATED_KINDS: readonly GeneratedKind[];
export type SpecContext = { batchPrompt(): { instructions: string; prompt: string }; signPrompt(sign: SignSlug, issues: QualityIssue[]): { instructions: string; prompt: string }; tarotCardId(sign: SignSlug): string | undefined };
export type GenerationSpec = {
  kind: GeneratedKind; templateVersion: string; promptVersion: string; limits: EntryLimits; recentDays: number;
  validDate(date: DateKey): boolean;
  context(input: { date: DateKey; audience: Audience; recent: RecentHeadline[]; keptCards?: ReadonlyMap<SignSlug, string> }): SpecContext;
};
export const HOROSCOPE_SPEC: GenerationSpec; export const WEEKLY_SPEC: GenerationSpec;
export function specFor(kind: GeneratedKind): GenerationSpec;
// src/lib/content/horoscope-service.ts (imza genişler, eski çağrılar aynen çalışır)
export async function generateHoroscopeSet(deps, input: { date; audience; trigger; skipIfExists; kind?: GeneratedKind }): Promise<SetResult>;
export async function regenerateSign(deps, input: { date; audience; sign; kind?: GeneratedKind }): Promise<SetResult | { status: 'missing' }>;
```

- [ ] **Step 1: Başarısız testi yaz**

`src/lib/content/weekly-service.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { createMockModel } from '@/lib/llm/mock-model';
import type { ProviderSpec } from '@/lib/llm/providers';
import { getCurrentPost, getCurrentReadings } from './repository';
import { generateHoroscopeSet, regenerateSign } from './horoscope-service';

const MONDAY = '2026-09-28';
const mock: ProviderSpec = { id: 'mock', label: 'mock', model: 'mock', dailyCap: 1000, factory: () => createMockModel() };

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
const deps = () => ({ db, chain: [mock], baseHashtags: ['#burç'], timeoutMs: 1000 });

describe('haftalık üretim', () => {
  it('pazartesi için 12 uzun yorumlu, her burca farklı kartlı haftalık gönderi üretir', async () => {
    const result = await generateHoroscopeSet(deps(), { date: MONDAY, audience: 'kadin', trigger: 'button', skipIfExists: false, kind: 'weekly' });
    expect(result.status).toBe('created');
    const readings = await getCurrentReadings(db, { date: MONDAY, kind: 'weekly', audience: 'kadin' });
    expect(readings).toHaveLength(12);
    expect(readings[0]).toMatchObject({ promptVersion: 'haftalik-v1' });
    expect(readings.every((row) => row.body.length >= 600)).toBe(true);
    expect(new Set(readings.map((row) => row.meta.tarotCardId)).size).toBe(12);
    expect((await getCurrentPost(db, { date: MONDAY, kind: 'weekly', audience: 'kadin' }))?.post.templateVersion).toBe('pastel-weekly@1');
    expect(await getCurrentPost(db, { date: MONDAY, kind: 'horoscope', audience: 'kadin' })).toBeNull();
  });

  it('pazartesi olmayan tarih için haftalık üretmez', async () => {
    await expect(generateHoroscopeSet(deps(), { date: '2026-09-29', audience: 'kadin', trigger: 'button', skipIfExists: false, kind: 'weekly' })).rejects.toThrow(
      'Haftalık yorum yalnızca pazartesi üretilir',
    );
  });

  it('tek burç yenilemede burcun haftalık kartı korunur', async () => {
    await generateHoroscopeSet(deps(), { date: MONDAY, audience: 'erkek', trigger: 'button', skipIfExists: false, kind: 'weekly' });
    const key = { date: MONDAY, kind: 'weekly' as const, audience: 'erkek' as const };
    const before = (await getCurrentReadings(db, key)).find((row) => row.sign === 'aslan')!;
    expect((await regenerateSign(deps(), { date: MONDAY, audience: 'erkek', sign: 'aslan', kind: 'weekly' })).status).toBe('created');
    const after = (await getCurrentReadings(db, key)).find((row) => row.sign === 'aslan')!;
    expect(after.version).toBe(2);
    expect(after.meta.tarotCardId).toBe(before.meta.tarotCardId);
  });
});
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `npx vitest run src/lib/content/weekly-service.test.ts`
Expected: FAIL. `kind: 'weekly'` henüz yok sayılır ve günlük üretilir, ya da tip hatası çıkar.

- [ ] **Step 3: Üretim tanımını yaz**

`src/lib/content/generation-spec.ts`:
```ts
import { getSkySnapshot } from '@/lib/astro/sky';
import { getWeekSky, isMonday } from '@/lib/astro/week';
import type { DateKey } from '@/lib/date/istanbul';
import { getTarotCard, type TarotCard } from '@/lib/tarot/deck';
import { drawCards } from '@/lib/tarot/draw';
import { SIGN_SLUGS, type SignSlug } from '@/lib/zodiac/signs';
import { HOROSCOPE_PROMPT_VERSION, buildHoroscopeBatchPrompt, buildHoroscopeSignPrompt } from './horoscope-prompt';
import { DAILY_LIMITS, WEEKLY_LIMITS, type EntryLimits, type QualityIssue } from './quality';
import type { Audience, RecentHeadline } from './types';
import { WEEKLY_PROMPT_VERSION, buildWeeklyBatchPrompt, buildWeeklySignPrompt } from './weekly-prompt';

export type GeneratedKind = 'horoscope' | 'weekly';
export const GENERATED_KINDS: readonly GeneratedKind[] = ['horoscope', 'weekly'];

type Prompt = { instructions: string; prompt: string };
export type SpecContext = {
  batchPrompt(): Prompt;
  signPrompt(sign: SignSlug, issues: QualityIssue[]): Prompt;
  tarotCardId(sign: SignSlug): string | undefined;
};
export type GenerationSpec = {
  kind: GeneratedKind;
  templateVersion: string;
  promptVersion: string;
  limits: EntryLimits;
  recentDays: number;
  validDate(date: DateKey): boolean;
  context(input: { date: DateKey; audience: Audience; recent: RecentHeadline[]; keptCards?: ReadonlyMap<SignSlug, string> }): SpecContext;
};

export const HOROSCOPE_SPEC: GenerationSpec = {
  kind: 'horoscope',
  templateVersion: 'pastel@1',
  promptVersion: HOROSCOPE_PROMPT_VERSION,
  limits: DAILY_LIMITS,
  recentDays: 2,
  validDate: () => true,
  context({ date, audience, recent }) {
    const input = { dateKey: date, audience, sky: getSkySnapshot(date), recent };
    return {
      batchPrompt: () => buildHoroscopeBatchPrompt(input),
      signPrompt: (sign, issues) => buildHoroscopeSignPrompt({ ...input, sign, issues }),
      tarotCardId: () => undefined,
    };
  },
};

export const WEEKLY_SPEC: GenerationSpec = {
  kind: 'weekly',
  templateVersion: 'pastel-weekly@1',
  promptVersion: WEEKLY_PROMPT_VERSION,
  limits: WEEKLY_LIMITS,
  recentDays: 7,
  validDate: isMonday,
  context({ date, audience, recent, keptCards }) {
    // Yeni üretimde 12 farklı kart çekilir; tek burç yenilemede mevcut kartlar korunur.
    const drawn = drawCards(SIGN_SLUGS.length);
    const cards = new Map<SignSlug, TarotCard>(
      SIGN_SLUGS.map((sign, index) => [sign, keptCards?.get(sign) ? getTarotCard(keptCards.get(sign)!) : drawn[index]]),
    );
    const input = { monday: date, audience, week: getWeekSky(date), cards, recent };
    return {
      batchPrompt: () => buildWeeklyBatchPrompt(input),
      signPrompt: (sign, issues) => buildWeeklySignPrompt({ ...input, sign, issues }),
      tarotCardId: (sign) => cards.get(sign)?.id,
    };
  },
};

export function specFor(kind: GeneratedKind): GenerationSpec {
  return kind === 'weekly' ? WEEKLY_SPEC : HOROSCOPE_SPEC;
}
```

- [ ] **Step 4: Servisi tanıma bağla**

`src/lib/content/horoscope-service.ts` değişiklikleri:
1. `TEMPLATE_VERSION` kaldırılır; şablon `spec.templateVersion`'dan gelir. Başka dosyada kullanılıyorsa (`grep -rn TEMPLATE_VERSION src`) oradaki kullanım `HOROSCOPE_SPEC.templateVersion` olur.
2. `generateSign(router, context, sign, issues, limits)`:
   - prompt `context.signPrompt(sign, issues)`,
   - doğrulama `checkSingleSign(value, sign, limits)`.
3. `toNewReading(entry, source, runId, promptVersion, tarotCardId?)`:
   - `promptVersion: promptVersion`,
   - `meta`: `{ scores, luckyColor, luckyNumber, ...(tarotCardId ? { tarotCardId } : {}) }`.
4. `generateHoroscopeSet`:
   - `const spec = specFor(input.kind ?? 'horoscope');`
   - `if (!spec.validDate(input.date)) throw new Error('Haftalık yorum yalnızca pazartesi üretilir');` (kilit almadan önce)
   - `key.kind = spec.kind`
   - `recent = getRecentHeadlines(db, key, date, spec.recentDays)`
   - `const context = spec.context({ date, audience, recent });`
   - Paket: `...context.batchPrompt()`, doğrulama `checkHoroscopeBatch(value, deps.baseHashtags, spec.limits)`
   - Yeniden istenen burçlar: `generateSign(router, context, sign, issues, spec.limits)`
   - Kayıt: `toNewReading(entry, source, run.id, spec.promptVersion, context.tarotCardId(sign))`
   - `createPostVersion` içinde `templateVersion: spec.templateVersion`
5. `regenerateSign`:
   - `const spec = specFor(input.kind ?? 'horoscope');`, `key.kind = spec.kind`
   - `const keptCards = new Map((await getCurrentReadings(deps.db, key)).flatMap((row) => (row.meta.tarotCardId ? [[row.sign, row.meta.tarotCardId] as const] : [])));`
   - `const context = spec.context({ date, audience, recent, keptCards });`
   - Tek burç: `generateSign(router, context, sign, [farklı açı sorunu], spec.limits)`
   - Kayıt: `toNewReading(entry, source, run.id, spec.promptVersion, context.tarotCardId(input.sign))`

(Mevcut `horoscope-service.test.ts` testleri değişmeden geçmelidir; bu, günlük akışın korunduğunun kanıtıdır.)

- [ ] **Step 5: Tüm testlerin geçtiğini gör ve commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: Haftalık 3 test ve mevcut günlük testlerin hepsi PASS.
```bash
git add src/lib/content
git commit -m "feat: üretim tanımı; haftalık yorumlar tarot kartları ve haftanın gökyüzüyle üretilir" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: HTTP, cron ve günlük paket

**Files:**
- Modify: `src/lib/content/http.ts` (+test), `src/lib/content/daily-package.ts` (+test), `src/lib/cron/daily.ts` (+test), `src/lib/settings/schema.ts` (`PackageItem`)

**Interfaces:**
- Produces:
```ts
// src/lib/content/daily-package.ts
export type PackageItem = { kind: GeneratedKind; audience: Audience };
export function packageItemsFor(date: DateKey, plan: readonly PlanItem[]): PackageItem[]; // pazartesi: plan + her kitle için weekly
export type PackageItemResult = { item: PackageItem; result: SetResult } | { item: PackageItem; error: string };
export async function generateDailyPackage(deps, input: { date; items: readonly PackageItem[]; trigger; skipIfExists }): Promise<PackageItemResult[]>;
// http: POST /api/generate {date, audience, kind?: 'horoscope'|'weekly', force?}; POST /api/generate/sign {date, audience, sign, kind?}
```

- [ ] **Step 1: Başarısız testleri yaz**

`src/lib/content/daily-package.test.ts` sonuna ekle:
```ts
describe('packageItemsFor', () => {
  const plan = [
    { kind: 'horoscope' as const, audience: 'kadin' as const },
    { kind: 'horoscope' as const, audience: 'erkek' as const },
  ];
  it('pazartesi günlük plana her kitle için haftalık ekler, diğer günler eklemez', () => {
    expect(packageItemsFor('2026-09-28', plan)).toEqual([...plan, { kind: 'weekly', audience: 'kadin' }, { kind: 'weekly', audience: 'erkek' }]);
    expect(packageItemsFor('2026-09-29', plan)).toEqual(plan);
  });
});
```

`src/lib/content/http.test.ts` içindeki `describe('handleGenerate', …)` sonuna ekle:
```ts
  it('haftalık üretim yalnızca pazartesi tarihinde kabul edilir', async () => {
    const monday = await handleGenerate(post({ date: '2026-09-21', audience: 'kadin', kind: 'weekly' }), { ...deps(), today: '2026-09-26' });
    expect(monday.status).toBe(200);
    expect((await handleGenerate(post({ date: '2026-09-22', audience: 'kadin', kind: 'weekly' }), { ...deps(), today: '2026-09-26' })).status).toBe(400);
    expect((await handleGenerate(post({ date: '2026-09-21', audience: 'kadin', kind: 'tarot' }), { ...deps(), today: '2026-09-26' })).status).toBe(400);
  });
```

`src/lib/cron/daily.test.ts` sonuna ekle:
```ts
  it('pazartesi günlük ve haftalık paketleri birlikte üretir', async () => {
    const body = await (await handleDailyCron(request('Bearer cron-anahtari'), { ...deps(), today: '2026-09-28' })).json();
    expect(body.generated.map((entry: { item: { kind: string; audience: string }; result: { status: string } }) => `${entry.item.kind}:${entry.item.audience}:${entry.result.status}`)).toEqual([
      'horoscope:kadin:created',
      'horoscope:erkek:created',
      'weekly:kadin:created',
      'weekly:erkek:created',
    ]);
  });
```

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `npx vitest run src/lib/content src/lib/cron`
Expected: FAIL. `packageItemsFor` bulunamaz, `kind` alanı yok sayılır.

- [ ] **Step 3: Uygulamayı yaz**

`src/lib/content/daily-package.ts`:
```ts
import { isMonday } from '@/lib/astro/week';
import { AUDIENCES, type Audience } from './types';
import type { GeneratedKind } from './generation-spec';

export type PackageItem = { kind: GeneratedKind; audience: Audience };

export function packageItemsFor(date: DateKey, plan: readonly PlanItem[]): PackageItem[] {
  const planned = plan.map((item) => ({ kind: item.kind, audience: item.audience }) as PackageItem);
  if (!isMonday(date)) return planned;
  const audiences = AUDIENCES.filter((audience) => plan.some((item) => item.audience === audience));
  return [...planned, ...audiences.map((audience): PackageItem => ({ kind: 'weekly', audience }))];
}
```
`generateDailyPackage` `items: readonly PackageItem[]` alır ve her öğe için `generateHoroscopeSet(deps, { …, kind: item.kind })` çağırır. `PackageItemResult` `PackageItem` taşır.

`src/lib/content/http.ts`:
- `generateSchema` ve `signSchema` şemalarına `kind: z.enum(['horoscope', 'weekly']).optional()` eklenir.
- `readBody` sonrası `if (body.kind === 'weekly' && !isMonday(body.date)) return BAD_REQUEST();`
- Çağrılara `kind: body.kind` geçirilir.

`src/lib/cron/daily.ts`: `items: packageItemsFor(deps.today, generation.settings.dailyPlan)`.

- [ ] **Step 4: Geçtiğini gör ve commit**

Run: `npm test && npm run typecheck && npm run lint`
```bash
git add src/lib/content src/lib/cron src/lib/settings
git commit -m "feat: pazartesi günlük pakete haftalık yorumlar; API ve cron haftalık türü tanır" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `pastel-weekly@1` şablonu ve gönderi verisi

**Files:**
- Create: `src/remotion/templates/pastel-weekly-v1/{weekly-cover.tsx, weekly-sign.tsx, slide.tsx, index.ts}`, `…/slide.test.ts`
- Modify:
  - `src/remotion/templates/index.ts` (`'pastel-weekly@1'` girdisi)
  - `src/lib/posts/slide-props.ts` (haftalıkta tarih etiketi = hafta etiketi)
  - `src/lib/render/file-names.ts` (`weekly: 'haftalik'`)
  - `src/lib/posts/edit-schema.ts` + `edit.ts` (sınırlar türe göre)
  - `src/lib/posts/summary.ts` (`kind`)
  - `src/remotion/Root.tsx` (Studio örneği)

**Interfaces:**
- Produces:
  - `getTemplate('pastel-weekly@1')` döner. `Slide` alanı `PastelWeeklySlide`, `Reels` alanı `PastelReels`'tir (kullanılmaz).
  - `editLimitsFor(kind): typeof EDIT_LIMITS` haftalıkta `body: 850` döndürür.
  - `postBaseName` haftalıkta `…_kadin-haftalik` üretir.
  - Haftalık slaytlarda `dateLabel`, hafta etiketinin büyük harfli halidir (`28 EYLÜL – 4 EKİM`).

Tasarım:
- **Kapak:** `pastel@1` kapağıyla aynı düzen. Başlık "Haftalık / Burç Yorumları", tarih yerine hafta etiketi.
- **Burç kartı:**
  - Başlık satırında sağ üstte hafta etiketi.
  - Madalyon, burç adı ve tarihleri.
  - Kartta başlık ve uzun yorum. Yorum yazı boyutu: ≤700 grafemde 30px, üstünde 28px.
  - Altta yalnız şanslı renk ve sayı satırı (yıldızlar haftalıkta yok, metne yer açılır).
- **Kapanış, filigran ve zemin:** `pastel-v1` bileşenleri import edilir (`CtaSlide`, `Watermark`). Zemin `Background` `pastel-v1/slide.tsx` içinde dışa aktarılmadığı için haftalık klasörde aynı gradyan ve ışıltı yerleşimleriyle kopyalanır. Dondurulmuş dosyaya dokunulmaz.

Testler:
- `slide.test.ts`:
  - Kapakta 'Haftalık' ve '28 EYLÜL – 4 EKİM' bulunur.
  - 850 grafemlik yorumda `font-size:28px` kullanılır.
  - Kartta `data-star` yoktur.
  - Filigranda `data-mark="saturn"` bulunur.
- `slide-props.test.ts`: Haftalık gönderinin `dateLabel` değeri '28 EYLÜL – 4 EKİM' olur.
- `file-names.test.ts`: `postBaseName({date:'2026-09-28',kind:'weekly',audience:'kadin'})` = '2026-09-28_kadin-haftalik'.
- `edit.test.ts`: Haftalık gönderide 800 grafemlik yorum kabul edilir, 900 reddedilir.

Kod, Faz 2'deki `pastel-v1/cover-slide.tsx` ve `sign-slide.tsx` dosyalarının kopyası üzerine yukarıdaki farklarla yazılır:
- `bodyFontSize` sınırları 700/850,
- `ScoreRow` kaldırılır,
- başlık metni "Haftalık".

Her dosya yazıldıktan sonra Studio'da `Haftalik-Kadin` örneği açılır.

- [ ] Adımlar: başarısız testleri yaz → FAIL gör → şablon ve veri değişikliklerini yaz → `npx vitest run src/remotion src/lib/posts src/lib/render` PASS → commit (`feat: pastel-weekly@1 şablonu ve haftalık gönderi verisi`).

---

### Task 7: Arayüz — Bugün, gönderi sayfası, arşiv

**Files:**
- Modify:
  - `src/app/(app)/page.tsx`
  - `src/components/today/daily-package-panel.tsx`
  - `src/components/post/post-workspace.tsx` (başlık ve sınırlar türe göre; Reels yalnız günlükte)
  - `src/app/(app)/arsiv/page.tsx` (`tür` süzgeci)
  - `e2e/weekly.spec.ts`

Davranış:
- **Bugün sayfası:** `packageItemsFor(date, settings.dailyPlan)` ile kalemler kurulur; pazartesi 4 kalem görünür ("Kadın haftalık yorumlar" dahil).
  - `generate()` her kalem için `{date, audience, kind}` gönderir.
  - "Yarın" pazartesiyse haftalık kalemler yarın için de görünür.
- **Gönderi sayfası:**
  - Başlık `Kadın haftalık yorumlar` olur.
  - Yorum alanı sınırı 850'dir.
  - Reels paneli yalnız `post.kind === 'horoscope'` iken görünür.
- **Arşiv:**
  - `tür=gunluk|haftalik` süzgeci (Tümü/Günlük/Haftalık).
  - Kart etiketi türü gösterir.
  - `listArchivePage` `kind` süzgecini zaten destekler.

E2E (`e2e/weekly.spec.ts`), yarının tarihi pazartesi değilse bile test verisi `/api/generate` üzerinden en yakın geçmiş pazartesiyle üretilir:
1. Pazartesi için haftalık üret, gönderi sayfasını aç. 14 slayt görünür; ZIP'te `…_kadin-haftalik_01-kapak.jpg` bulunur; `[data-slot="body"]` sığar.
2. Arşivde "Haftalık" süzgeci yalnız haftalık gönderileri gösterir.
3. Salı tarihi için `kind: 'weekly'` isteği 400 döner.

- [ ] Adımlar: E2E'yi yaz → FAIL gör → arayüzü yaz → `npm run test:e2e` PASS → görsel kontrol (masaüstü ve mobil) → commit.

---

### Task 8: Tasarım onayı, dondurma ve pazartesiden önce canlıya alma (kontrolcü + kullanıcı)

1. **Gerçek örnek:** Production'a dokunmadan, yerel veritabanında gerçek Gemini ile 28 Eylül için bir kadın ve bir erkek haftalık paket üret (anahtar yerel ortama geçici olarak verilir, sonra silinir). JPEG'leri onay sayfasına "Haftalık" bölümü olarak ekle. Kullanıcıya tek soru sor: onay ya da değişiklik.
2. **Dondurma:** Onaydan sonra `pastel-weekly-v1/freeze.test.ts` eklenir (Faz 2 manifest yöntemi).
3. **Canlıya alma:**
   - Bütün dal incelemesi → düzeltmeler → `main`'e birleştir → deploy.
   - `npm run db:migrate:prod` ile `0002_weekly` migration'ını uygula (enum değeri ekleme, geri alınabilir değildir ama mevcut veriyi etkilemez).
   - `/api/generate` 401 kontrolü yapılır.
4. **Pazartesi doğrulaması:**
   - 28.09.2026 sabahı cron sonrası `generation_runs` içinde 4 başarılı çalışma (2 günlük, 2 haftalık) görülmeli.
   - Görülmezse Bugün sayfasından elle üretim yapılır ve nedeni raporlanır.
