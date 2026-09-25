# Faz 1: Günlük Burç Motoru — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tek tıkla (ve her sabah cron ile) 12 burç için kadın ve erkeğe ayrı, gökyüzü verisine dayanan, kalite kapısından geçmiş Türkçe günlük yorumlar üretmek. Metinler ücretsiz LLM sağlayıcıları arasında otomatik yedeklemeyle üretilir, sürümlü olarak saklanır ve sitede gösterilir.

**Architecture:** `astronomy-engine` günün gökyüzü özetini çıkarır. Prompt oluşturucu bu özeti, burç özelliklerini ve son iki günün başlıklarını birleştirir. `generateWithFailover` sırasıyla AI Gateway → Gemini → Gemini Lite → Ollama Cloud (+opsiyonel) sağlayıcılarını dener; zod şeması ve kalite kapısıyla doğrular. Geçemeyen burçlar tek tek yeniden istenir. Sonuç `readings` ve `posts`/`post_slides` tablolarına yeni sürüm olarak transaction içinde yazılır. Eşzamanlı üretimi `generation_runs` üzerindeki koşullu tekil index kilitler.

**Tech Stack:** Faz 0 yığını + AI SDK 7 (`ai`, `@ai-sdk/gateway`, `@ai-sdk/google`, `@ai-sdk/openai-compatible`), `astronomy-engine` 2.1.19, Magic UI (`animated-list`, `confetti`, `magic-card`, `orbiting-circles`), shadcn `badge`.

**Spec:** `docs/superpowers/specs/2026-09-25-burc-studio-design.md` (Faz 1 satırı ve §1–§2, §6)

## Global Constraints

- Faz 0'ın tüm Global Constraints maddeleri geçerli (Node 24.x, npm, Next 16 proxy, Türkçe arayüz, `connection()`, `src/components/ui/**` vendor, commit biçimi).
- Çalışma dalı `faz-1-gunluk-burc`. Başlangıç noktası, Faz 0'ın birleştirildiği `main`.
- "Bugün" her zaman `istanbulDateKey()` ile bulunur. Üretime izin verilen tarih aralığı bugün−7 … bugün+1'dir.
- Metin sınırları (grafem sayısı, `Intl.Segmenter`):
  - `baslik`: 3–40, en fazla 1 emoji.
  - `yorum`: 280–420, en fazla 2 emoji.
  - `kisa`: 20–140, en fazla 1 emoji.
  - `kapakKanca`: 5–60, en fazla 1 emoji.
  - `caption`: 40–700, en fazla 4 emoji, `#` içermez.
- Diğer içerik kuralları:
  - Hashtag: en fazla 5. Önce ayarlardaki 2 temel hashtag, sonra modelin önerileri.
  - Puanlar 1–5, şanslı sayı 1–99 aralığında tam sayı olmalı.
  - Şanslı renk yalnızca `LUCKY_COLORS` kimliklerinden biri olabilir.
- LLM çağrıları yalnızca `generateWithFailover` üzerinden yapılır. Her çağrıda `maxRetries: 0` ve açık zaman aşımı (`AbortController`) kullanılır. Her deneme `llm_calls` tablosuna yazılır.
- Sağlayıcı varsayılanları:

  | Sağlayıcı | Model | Günlük tavan |
  |---|---|---|
  | `gateway` | `google/gemini-2.5-flash` | 300 |
  | `gemini` | `gemini-3.5-flash` | 18 |
  | `gemini-lite` | `gemini-3.5-flash-lite` | 450 |
  | `ollama-cloud` | `gemma4:31b` (`https://ollama.com/v1`) | 100 |
  | `ollama-local` | `gemma4:26b` (`http://localhost:11434/v1`) | 10000 |

- Ollama, Groq, OpenRouter ve Cerebras'ta `supportsStructuredOutputs: false` kullanılır: JSON modu açılır, JSON biçimi prompt içinde tarif edilir.
- 429 alan sağlayıcı 60 dakika atlanır. Spec'teki "o gün dolu" kuralı dakikalık limitler günü kilitlemesin diye 60 dakikalık soğumaya çevrildi.
- Yük dağıtımı (`spreadLoad`) varsayılan olarak kapalıdır. Açıkken zincir kitleye göre döndürülür: kadın 1. sağlayıcıdan, erkek 2. sağlayıcıdan başlar.
- Hiçbir üretim silinmez. Yeniden üretim yeni `version` ekler, eski sürüm `is_current=false` olarak kalır. Gönderi slaytları her zaman belirli bir `reading_id` sürümüne bağlıdır.
- Şablon sürümü sabiti: `TEMPLATE_VERSION = 'pastel@1'` (render Faz 2'de).
- Testler gerçek sağlayıcıya asla gitmez. Birim testlerde `MockLanguageModelV4`, E2E'de `LLM_MOCK=1` ve `LLM_PROVIDER_OVERRIDE=mock` kullanılır.
- `src/db/schema.ts` yalnızca göreli import kullanır. drizzle-kit `@/` takma adını çözmez.

## Review Focus

1. **Modelin burç adlarını farklı yazması:** Model "Koç", "İKİZLER", "Aries", "♓ Balık" gibi adlar döndürebilir; bir burcu iki kez yazıp başka birini atlayabilir. Kimlik doğru eşlenmeli, tekrar eden yok sayılmalı, eksik burç tek başına yeniden istenmeli. 12'den az burçla asla kayıt yapılmamalı. → Task 4 `quality.test.ts`, Task 10 `horoscope-service.test.ts`.
2. **Çakışan üretim:** Çift tıklama ya da aynı anda çalışan cron ve buton, ikinci isteğe "şu anda üretiliyor" (409) döndürmeli. Çift "güncel" sürüm oluşmamalı. Yarıda kalan çalışma 10 dakika sonra kilidi bırakmalı. → Task 8 `runs.test.ts`, Task 10, Task 11 `http.test.ts`.
3. **Türkçe büyük/küçük harf (İ/ı):** Burç adlarında ve hashtag'lerde `tr-TR` kurallarıyla çalışılmalı. Örneğin `#İkizler` → `#ikizler` olmalı, `i̇kizler` olmamalı. → Task 1 `turkish.test.ts`, Task 3 `hashtags.test.ts`.
4. **Grafem temelli uzunluk ve emoji sayımı:** 👩‍❤️‍👨 ve 🇹🇷 gibi dizileri tek karakter saymalı. UTF-16 `.length` kullanılmamalı. → Task 1 `turkish.test.ts`.
5. **Sürekli hatalı yanıt:** Bir sağlayıcı sürekli 200 dönüp İngilizce, fazla uzun ya da yasaklı ifadeli metin verirse 1 tekrardan sonra sıradaki sağlayıcıya geçilmeli. Geçersiz metin asla kaydedilmemeli. Zincir biterse net hata dönmeli ve çalışma `failed` olarak işaretlenmeli. → Task 7 `router.test.ts`, Task 10.

---

### Task 1: Türkçe metin yardımcıları ve burç verisi

**Files:**
- Create: `src/lib/text/turkish.ts`, `src/lib/zodiac/signs.ts`
- Test: `src/lib/text/turkish.test.ts`, `src/lib/zodiac/signs.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
```ts
// src/lib/text/turkish.ts
export function foldTurkish(input: string): string;   // tr-TR küçük harf + ç→c ğ→g ı→i ö→o ş→s ü→u, harf dışını atar
export function graphemeLength(text: string): number;
export function countEmoji(text: string): number;
export function looksTurkish(text: string): boolean;
// src/lib/zodiac/signs.ts
export const SIGN_SLUGS: readonly ['koc','boga','ikizler','yengec','aslan','basak','terazi','akrep','yay','oglak','kova','balik'];
export type SignSlug = (typeof SIGN_SLUGS)[number];
export type Element = 'ates' | 'toprak' | 'hava' | 'su';
export type Sign = { slug: SignSlug; name: string; glyph: string; dateRange: string; element: Element; ruler: string; traits: string };
export const SIGNS: readonly Sign[];
export function getSign(slug: SignSlug): Sign;
export function signFromLongitude(longitude: number): SignSlug;
export function normalizeSignName(input: string): SignSlug | null;
```

- [ ] **Step 1: Dalı aç**

```bash
cd ~/burc-studio && git switch main && git pull && git switch -c faz-1-gunluk-burc
```

- [ ] **Step 2: Başarısız testleri yaz**

`src/lib/text/turkish.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { countEmoji, foldTurkish, graphemeLength, looksTurkish } from './turkish';

describe('foldTurkish', () => {
  it.each([
    ['İkizler', 'ikizler'],
    ['IKIZLER', 'ikizler'],
    ['Yengeç Burcu', 'yengecburcu'],
    ['♓ Balık', 'balik'],
    ['ŞÜĞÖÇ', 'sugoc'],
  ])('%s → %s', (input, expected) => {
    expect(foldTurkish(input)).toBe(expected);
  });
});

describe('graphemeLength ve countEmoji', () => {
  it('birleşik emoji ve bayrakları tek karakter sayar', () => {
    const text = 'a👩‍❤️‍👨b🇹🇷';
    expect(text.length).toBe(14);
    expect(graphemeLength(text)).toBe(4);
    expect(countEmoji(text)).toBe(2);
  });

  it('Türkçe harfleri tek karakter sayar', () => {
    expect(graphemeLength('Günaydın')).toBe(8);
    expect(countEmoji('Harika bir gün ✨')).toBe(1);
  });
});

describe('looksTurkish', () => {
  it('Türkçe metni kabul eder, İngilizceyi reddeder', () => {
    expect(looksTurkish('Bugün yıldızlar senden yana, küçük bir sürpriz seni bekliyor.')).toBe(true);
    expect(looksTurkish('Today the stars are with you and your plans will work out with ease.')).toBe(false);
    expect(looksTurkish('Bugun yildizlar senden yana')).toBe(false);
  });
});
```

`src/lib/zodiac/signs.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SIGN_SLUGS, SIGNS, getSign, normalizeSignName, signFromLongitude } from './signs';

describe('burç verisi', () => {
  it('12 burç doğru sırada tanımlıdır', () => {
    expect(SIGNS.map((s) => s.slug)).toEqual([...SIGN_SLUGS]);
    expect(getSign('ikizler')).toMatchObject({ name: 'İkizler', element: 'hava' });
  });
});

describe('signFromLongitude', () => {
  it.each([
    [0, 'koc'],
    [29.99, 'koc'],
    [30, 'boga'],
    [180.36, 'terazi'],
    [359.9, 'balik'],
    [-1, 'balik'],
    [360, 'koc'],
  ])('%s° → %s', (longitude, expected) => {
    expect(signFromLongitude(longitude)).toBe(expected);
  });
});

describe('normalizeSignName', () => {
  it.each([
    ['Koç', 'koc'],
    ['KOÇ', 'koc'],
    ['İkizler', 'ikizler'],
    ['IKIZLER', 'ikizler'],
    ['Yengeç Burcu', 'yengec'],
    ['♓ Balık', 'balik'],
    ['oglak', 'oglak'],
    ['Aries', 'koc'],
    ['Pisces', 'balik'],
    ['Ejderha', null],
    ['', null],
  ])('%s → %s', (input, expected) => {
    expect(normalizeSignName(input)).toBe(expected);
  });
});
```

- [ ] **Step 3: Testlerin başarısız olduğunu gör**

Run: `npx vitest run src/lib/text src/lib/zodiac`
Expected: FAIL — modüller bulunamaz.

- [ ] **Step 4: Uygulamaları yaz**

`src/lib/text/turkish.ts`:
```ts
const segmenter = new Intl.Segmenter('tr', { granularity: 'grapheme' });
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
const TURKISH_LETTERS = /[çğıöşüÇĞİÖŞÜ]/;
const ENGLISH_WORDS = /\b(the|and|you|your|today|will|with|this|that)\b/gi;

export function foldTurkish(input: string): string {
  return input
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşüâîû]/g, (char) => FOLD[char])
    .replace(/[^a-z]/g, '');
}

export function graphemeLength(text: string): number {
  let count = 0;
  for (const _ of segmenter.segment(text)) count++;
  return count;
}

export function countEmoji(text: string): number {
  let count = 0;
  for (const { segment } of segmenter.segment(text)) if (EMOJI.test(segment)) count++;
  return count;
}

export function looksTurkish(text: string): boolean {
  return TURKISH_LETTERS.test(text) && (text.match(ENGLISH_WORDS)?.length ?? 0) < 3;
}
```

`src/lib/zodiac/signs.ts`:
```ts
import { foldTurkish } from '@/lib/text/turkish';

export const SIGN_SLUGS = ['koc', 'boga', 'ikizler', 'yengec', 'aslan', 'basak', 'terazi', 'akrep', 'yay', 'oglak', 'kova', 'balik'] as const;
export type SignSlug = (typeof SIGN_SLUGS)[number];
export type Element = 'ates' | 'toprak' | 'hava' | 'su';
export type Sign = { slug: SignSlug; name: string; glyph: string; dateRange: string; element: Element; ruler: string; traits: string };

// Glifler U+FE0E ile biter: iOS'ta renkli emoji yerine metin olarak çizilsin.
export const SIGNS: readonly Sign[] = [
  { slug: 'koc', name: 'Koç', glyph: '♈︎', dateRange: '21 Mart – 19 Nisan', element: 'ates', ruler: 'Mars', traits: 'cesur, girişken, sabırsız, enerjik' },
  { slug: 'boga', name: 'Boğa', glyph: '♉︎', dateRange: '20 Nisan – 20 Mayıs', element: 'toprak', ruler: 'Venüs', traits: 'sabırlı, güvenilir, keyfine düşkün, inatçı' },
  { slug: 'ikizler', name: 'İkizler', glyph: '♊︎', dateRange: '21 Mayıs – 20 Haziran', element: 'hava', ruler: 'Merkür', traits: 'meraklı, konuşkan, çok yönlü, kararsız' },
  { slug: 'yengec', name: 'Yengeç', glyph: '♋︎', dateRange: '21 Haziran – 22 Temmuz', element: 'su', ruler: 'Ay', traits: 'duygusal, koruyucu, sezgisel, alıngan' },
  { slug: 'aslan', name: 'Aslan', glyph: '♌︎', dateRange: '23 Temmuz – 22 Ağustos', element: 'ates', ruler: 'Güneş', traits: 'cömert, özgüvenli, yaratıcı, ilgi seven' },
  { slug: 'basak', name: 'Başak', glyph: '♍︎', dateRange: '23 Ağustos – 22 Eylül', element: 'toprak', ruler: 'Merkür', traits: 'titiz, analitik, yardımsever, eleştirel' },
  { slug: 'terazi', name: 'Terazi', glyph: '♎︎', dateRange: '23 Eylül – 22 Ekim', element: 'hava', ruler: 'Venüs', traits: 'uyumlu, zarif, adil, kararsız' },
  { slug: 'akrep', name: 'Akrep', glyph: '♏︎', dateRange: '23 Ekim – 21 Kasım', element: 'su', ruler: 'Plüton', traits: 'tutkulu, derin, kararlı, gizemli' },
  { slug: 'yay', name: 'Yay', glyph: '♐︎', dateRange: '22 Kasım – 21 Aralık', element: 'ates', ruler: 'Jüpiter', traits: 'özgür ruhlu, iyimser, maceracı, dobra' },
  { slug: 'oglak', name: 'Oğlak', glyph: '♑︎', dateRange: '22 Aralık – 19 Ocak', element: 'toprak', ruler: 'Satürn', traits: 'disiplinli, hırslı, sorumluluk sahibi, ağırbaşlı' },
  { slug: 'kova', name: 'Kova', glyph: '♒︎', dateRange: '20 Ocak – 18 Şubat', element: 'hava', ruler: 'Uranüs', traits: 'özgün, yenilikçi, bağımsız, mesafeli' },
  { slug: 'balik', name: 'Balık', glyph: '♓︎', dateRange: '19 Şubat – 20 Mart', element: 'su', ruler: 'Neptün', traits: 'hayalperest, şefkatli, sezgisel, dağınık' },
];

const BY_SLUG = Object.fromEntries(SIGNS.map((sign) => [sign.slug, sign])) as Record<SignSlug, Sign>;
const ENGLISH_NAMES: Record<string, SignSlug> = {
  aries: 'koc', taurus: 'boga', gemini: 'ikizler', cancer: 'yengec', leo: 'aslan', virgo: 'basak',
  libra: 'terazi', scorpio: 'akrep', sagittarius: 'yay', capricorn: 'oglak', aquarius: 'kova', pisces: 'balik',
};

export function getSign(slug: SignSlug): Sign {
  return BY_SLUG[slug];
}

export function signFromLongitude(longitude: number): SignSlug {
  const normalized = ((longitude % 360) + 360) % 360;
  return SIGN_SLUGS[Math.floor(normalized / 30)];
}

export function normalizeSignName(input: string): SignSlug | null {
  const folded = foldTurkish(input).replace(/burcu$/, '');
  if ((SIGN_SLUGS as readonly string[]).includes(folded)) return folded as SignSlug;
  return ENGLISH_NAMES[folded] ?? null;
}
```

- [ ] **Step 5: Testlerin geçtiğini gör**

Run: `npx vitest run src/lib/text src/lib/zodiac && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/text src/lib/zodiac
git commit -m "feat: Türkçe metin yardımcıları ve burç verisi" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Gökyüzü modülü

**Files:**
- Create: `src/lib/astro/sky.ts`
- Test: `src/lib/astro/sky.test.ts`

**Interfaces:**
- Consumes: `DateKey`, `istanbulNoon`, `istanbulDayStart`, `istanbulDateKey`, `formatDateShortTr` (Faz 0); `signFromLongitude`, `getSign`, `SignSlug` (Task 1)
- Produces:
```ts
export const PLANETS: readonly ['Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
export type Planet; export type SkyBody = 'Sun' | 'Moon' | Planet;
export const BODY_NAMES_TR: Record<SkyBody, string>;
export type MoonPhaseName = 'yeni-ay'|'hilal'|'ilk-dordun'|'buyuyen-ay'|'dolunay'|'kuculen-ay'|'son-dordun'|'balsamik-ay';
export const MOON_PHASE_NAMES_TR: Record<MoonPhaseName, string>;
export function moonPhaseName(angle: number): MoonPhaseName;
export function eclipticLongitude(body: SkyBody, at: Date): number; // tropikal, tarih ekliptiği
export type Lunation = { kind: 'yeni-ay' | 'dolunay'; dateKey: DateKey; sign: SignSlug };
export type SkySnapshot = { dateKey: DateKey; sunSign: SignSlug; moonSign: SignSlug; moonPhase: MoonPhaseName; retrogrades: Planet[]; ingresses: { body: SkyBody; sign: SignSlug }[]; upcomingLunation: Lunation | null };
export function getSkySnapshot(dateKey: DateKey): SkySnapshot;
export function describeSkyTr(sky: SkySnapshot): string;   // prompt için çok satırlı
export function skyHeadlineTr(sky: SkySnapshot): string;   // arayüz için tek satır
```

Test beklentileri astronomy-engine ile hesaplandı ve bağımsız kaynaklarla doğrulandı:
- 26.09.2026 dolunayı 16:49 UTC'de Koç'ta (timeanddate, astronomy.com).
- 2026 Merkür retroları 26 Şub–20 Mar, 29 Haz–23 Tem ve 24 Eki–13 Kas (Britannica, Old Farmer's Almanac).
- Güneş, 23.09.2026 00:05 UTC'de Terazi'ye geçiyor.

- [ ] **Step 1: Başarısız testi yaz**

`src/lib/astro/sky.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { describeSkyTr, getSkySnapshot, moonPhaseName, skyHeadlineTr } from './sky';

describe('moonPhaseName', () => {
  it.each([
    [0, 'yeni-ay'],
    [350, 'yeni-ay'],
    [45, 'hilal'],
    [90, 'ilk-dordun'],
    [151.6, 'buyuyen-ay'],
    [175.9, 'dolunay'],
    [225, 'kuculen-ay'],
    [270, 'son-dordun'],
    [315, 'balsamik-ay'],
  ])('%s° → %s', (angle, expected) => {
    expect(moonPhaseName(angle)).toBe(expected);
  });
});

describe('getSkySnapshot', () => {
  it("Güneş 23 Eylül'de Terazi'ye geçer", () => {
    expect(getSkySnapshot('2026-09-22').sunSign).toBe('basak');
    const equinox = getSkySnapshot('2026-09-23');
    expect(equinox.sunSign).toBe('terazi');
    expect(equinox.ingresses).toContainEqual({ body: 'Sun', sign: 'terazi' });
  });

  it("26 Eylül öğleninde Ay Balık'ta ve evresi dolunaydır", () => {
    const sky = getSkySnapshot('2026-09-26');
    expect(sky.moonPhase).toBe('dolunay');
    expect(sky.moonSign).toBe('balik');
  });

  it("24 Eylül'den bakınca yaklaşan olay Koç'taki dolunaydır", () => {
    const sky = getSkySnapshot('2026-09-24');
    expect(sky.moonPhase).toBe('buyuyen-ay');
    expect(sky.upcomingLunation).toEqual({ kind: 'dolunay', dateKey: '2026-09-26', sign: 'koc' });
  });

  it('Merkür retrosunu doğru tarihlerde bulur', () => {
    expect(getSkySnapshot('2026-03-10').retrogrades).toContain('Mercury');
    expect(getSkySnapshot('2026-04-01').retrogrades).not.toContain('Mercury');
    expect(getSkySnapshot('2026-10-30').retrogrades).toContain('Mercury');
    expect(getSkySnapshot('2026-11-20').retrogrades).not.toContain('Mercury');
  });
});

describe('Türkçe gökyüzü özetleri', () => {
  it('prompt özeti burç ve evre adlarını içerir', () => {
    const text = describeSkyTr(getSkySnapshot('2026-09-24'));
    expect(text).toContain('Güneş Terazi burcunda.');
    expect(text).toContain('Ay Balık burcunda; evresi: Büyüyen Ay.');
    expect(text).toContain('Yaklaşan: 26 Eylül tarihinde Koç burcunda Dolunay.');
  });

  it('arayüz başlığı tek satırdır', () => {
    expect(skyHeadlineTr(getSkySnapshot('2026-09-26'))).toMatch(/^Güneş: Terazi · Ay: Balık · Dolunay/);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `npx vitest run src/lib/astro`
Expected: FAIL — `./sky` bulunamaz.

- [ ] **Step 3: Uygulamayı yaz**

```bash
npm install astronomy-engine@2.1.19
```

`src/lib/astro/sky.ts`:
```ts
import { Body, Ecliptic, EclipticGeoMoon, GeoVector, MoonPhase, NextMoonQuarter, SearchMoonQuarter, SunPosition } from 'astronomy-engine';
import { formatDateShortTr, istanbulDateKey, istanbulDayStart, istanbulNoon, type DateKey } from '@/lib/date/istanbul';
import { getSign, signFromLongitude, type SignSlug } from '@/lib/zodiac/signs';

export const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
export type Planet = (typeof PLANETS)[number];
export type SkyBody = 'Sun' | 'Moon' | Planet;

export const BODY_NAMES_TR: Record<SkyBody, string> = {
  Sun: 'Güneş', Moon: 'Ay', Mercury: 'Merkür', Venus: 'Venüs', Mars: 'Mars',
  Jupiter: 'Jüpiter', Saturn: 'Satürn', Uranus: 'Uranüs', Neptune: 'Neptün', Pluto: 'Plüton',
};

export type MoonPhaseName = 'yeni-ay' | 'hilal' | 'ilk-dordun' | 'buyuyen-ay' | 'dolunay' | 'kuculen-ay' | 'son-dordun' | 'balsamik-ay';
const PHASE_ORDER: MoonPhaseName[] = ['yeni-ay', 'hilal', 'ilk-dordun', 'buyuyen-ay', 'dolunay', 'kuculen-ay', 'son-dordun', 'balsamik-ay'];
export const MOON_PHASE_NAMES_TR: Record<MoonPhaseName, string> = {
  'yeni-ay': 'Yeni Ay', hilal: 'Hilal', 'ilk-dordun': 'İlk Dördün', 'buyuyen-ay': 'Büyüyen Ay',
  dolunay: 'Dolunay', 'kuculen-ay': 'Küçülen Ay', 'son-dordun': 'Son Dördün', 'balsamik-ay': 'Balsamik Ay',
};

export type Lunation = { kind: 'yeni-ay' | 'dolunay'; dateKey: DateKey; sign: SignSlug };
export type SkySnapshot = {
  dateKey: DateKey;
  sunSign: SignSlug;
  moonSign: SignSlug;
  moonPhase: MoonPhaseName;
  retrogrades: Planet[];
  ingresses: { body: SkyBody; sign: SignSlug }[];
  upcomingLunation: Lunation | null;
};

const DAY_MS = 86_400_000;
const INGRESS_BODIES: SkyBody[] = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

export function moonPhaseName(angle: number): MoonPhaseName {
  const normalized = ((angle % 360) + 360) % 360;
  return PHASE_ORDER[Math.floor(((normalized + 22.5) % 360) / 45)];
}

export function eclipticLongitude(body: SkyBody, at: Date): number {
  if (body === 'Sun') return SunPosition(at).elon;
  if (body === 'Moon') return EclipticGeoMoon(at).lon;
  return Ecliptic(GeoVector(Body[body], at, true)).elon;
}

function isRetrograde(planet: Planet, at: Date): boolean {
  let motion = eclipticLongitude(planet, new Date(at.getTime() + DAY_MS / 2)) - eclipticLongitude(planet, new Date(at.getTime() - DAY_MS / 2));
  if (motion > 180) motion -= 360;
  if (motion < -180) motion += 360;
  return motion < 0;
}

function findUpcomingLunation(from: Date, days: number): Lunation | null {
  const until = from.getTime() + days * DAY_MS;
  for (let quarter = SearchMoonQuarter(from); quarter.time.date.getTime() < until; quarter = NextMoonQuarter(quarter)) {
    if (quarter.quarter === 0 || quarter.quarter === 2) {
      return {
        kind: quarter.quarter === 0 ? 'yeni-ay' : 'dolunay',
        dateKey: istanbulDateKey(quarter.time.date),
        sign: signFromLongitude(eclipticLongitude('Moon', quarter.time.date)),
      };
    }
  }
  return null;
}

export function getSkySnapshot(dateKey: DateKey): SkySnapshot {
  const noon = istanbulNoon(dateKey);
  const dayStart = istanbulDayStart(dateKey);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);
  return {
    dateKey,
    sunSign: signFromLongitude(eclipticLongitude('Sun', noon)),
    moonSign: signFromLongitude(eclipticLongitude('Moon', noon)),
    moonPhase: moonPhaseName(MoonPhase(noon)),
    retrogrades: PLANETS.filter((planet) => isRetrograde(planet, noon)),
    ingresses: INGRESS_BODIES.flatMap((body) => {
      const before = signFromLongitude(eclipticLongitude(body, dayStart));
      const after = signFromLongitude(eclipticLongitude(body, dayEnd));
      return before === after ? [] : [{ body, sign: after }];
    }),
    upcomingLunation: findUpcomingLunation(dayStart, 3),
  };
}

export function describeSkyTr(sky: SkySnapshot): string {
  const lines = [
    `Güneş ${getSign(sky.sunSign).name} burcunda.`,
    `Ay ${getSign(sky.moonSign).name} burcunda; evresi: ${MOON_PHASE_NAMES_TR[sky.moonPhase]}.`,
    sky.retrogrades.length
      ? `Retrodaki gezegenler: ${sky.retrogrades.map((planet) => BODY_NAMES_TR[planet]).join(', ')}.`
      : 'Retroda gezegen yok.',
    ...sky.ingresses.map(({ body, sign }) => `Bugün ${BODY_NAMES_TR[body]} ${getSign(sign).name} burcuna geçiyor.`),
  ];
  if (sky.upcomingLunation) {
    const { kind, dateKey, sign } = sky.upcomingLunation;
    lines.push(`Yaklaşan: ${formatDateShortTr(dateKey)} tarihinde ${getSign(sign).name} burcunda ${kind === 'dolunay' ? 'Dolunay' : 'Yeni Ay'}.`);
  }
  return lines.join('\n');
}

export function skyHeadlineTr(sky: SkySnapshot): string {
  const parts = [
    `Güneş: ${getSign(sky.sunSign).name}`,
    `Ay: ${getSign(sky.moonSign).name}`,
    MOON_PHASE_NAMES_TR[sky.moonPhase],
  ];
  if (sky.retrogrades.length) parts.push(`Retro: ${sky.retrogrades.map((planet) => BODY_NAMES_TR[planet]).join(', ')}`);
  return parts.join(' · ');
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npx vitest run src/lib/astro && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/astro
git commit -m "feat: astronomy-engine ile günün gökyüzü özeti" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: İçerik tipleri, şanslı renkler ve hashtag yardımcıları

**Files:**
- Create: `src/lib/content/types.ts`, `src/lib/content/lucky-colors.ts`, `src/lib/content/hashtags.ts`
- Test: `src/lib/content/lucky-colors.test.ts`, `src/lib/content/hashtags.test.ts`

**Interfaces:**
- Consumes: `foldTurkish` (Task 1), `DateKey`, `SignSlug`
- Produces:
```ts
// src/lib/content/types.ts
export const READING_KINDS: readonly ['horoscope', 'tarot', 'special']; export type ReadingKind;
export const READING_AUDIENCES: readonly ['kadin', 'erkek', 'genel']; export type ReadingAudience;
export type Audience = 'kadin' | 'erkek';
export const AUDIENCES: readonly Audience[]; // ['kadin', 'erkek'] — sıra yük dağıtımında kullanılır
export const AUDIENCE_LABELS: Record<Audience, string>; // { kadin: 'Kadın', erkek: 'Erkek' }
export const RUN_TRIGGERS: readonly ['cron', 'button', 'regenerate', 'local']; export type RunTrigger;
export type RecentHeadline = { date: DateKey; sign: SignSlug; headline: string; short: string };
// src/lib/content/lucky-colors.ts
export const LUCKY_COLORS: readonly { id: string; name: string; hex: string }[];
export type LuckyColorId; export const LUCKY_COLOR_IDS: readonly LuckyColorId[];
export function getLuckyColor(id: LuckyColorId): { id; name; hex };
export function normalizeLuckyColor(input: string): LuckyColorId | null;
// src/lib/content/hashtags.ts
export const MAX_HASHTAGS = 5;
export function normalizeHashtag(input: string): string | null;
export function mergeHashtags(base: readonly string[], suggested: readonly string[]): string[];
```

- [ ] **Step 1: Başarısız testleri yaz**

`src/lib/content/lucky-colors.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { LUCKY_COLOR_IDS, getLuckyColor, normalizeLuckyColor } from './lucky-colors';

describe('şanslı renkler', () => {
  it('12 pastel renk tanımlıdır', () => {
    expect(LUCKY_COLOR_IDS).toHaveLength(12);
    expect(getLuckyColor('lila')).toEqual({ id: 'lila', name: 'Lila', hex: '#C8B6E2' });
  });

  it.each([
    ['lila', 'lila'],
    ['Pudra Pembe', 'pudra'],
    ['BEBEK MAVİSİ', 'bebek-mavisi'],
    ['adaçayı yeşili', 'adacayi'],
    ['mor', null],
  ])('%s → %s', (input, expected) => {
    expect(normalizeLuckyColor(input)).toBe(expected);
  });
});
```

`src/lib/content/hashtags.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mergeHashtags, normalizeHashtag } from './hashtags';

describe('normalizeHashtag', () => {
  it.each([
    ['#İkizler Burcu', '#ikizlerburcu'],
    ['Günlük Burç', '#günlükburç'],
    ['##Astroloji!', '#astroloji'],
    ['###', null],
    ['   ', null],
  ])('%s → %s', (input, expected) => {
    expect(normalizeHashtag(input)).toBe(expected);
  });
});

describe('mergeHashtags', () => {
  it('temel etiketler önce gelir, tekrar yok, en fazla 5', () => {
    expect(mergeHashtags(['#burç', '#astroloji'], ['#Burç', '#günlükburç', '#terazi', '#dolunay', '#ekstra'])).toEqual([
      '#burç', '#astroloji', '#günlükburç', '#terazi', '#dolunay',
    ]);
  });
});
```

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `npx vitest run src/lib/content`
Expected: FAIL — modüller bulunamaz.

- [ ] **Step 3: Uygulamaları yaz**

`src/lib/content/types.ts`:
```ts
import type { DateKey } from '@/lib/date/istanbul';
import type { SignSlug } from '@/lib/zodiac/signs';

export const READING_KINDS = ['horoscope', 'tarot', 'special'] as const;
export type ReadingKind = (typeof READING_KINDS)[number];
export const READING_AUDIENCES = ['kadin', 'erkek', 'genel'] as const;
export type ReadingAudience = (typeof READING_AUDIENCES)[number];
export type Audience = 'kadin' | 'erkek';
export const AUDIENCES: readonly Audience[] = ['kadin', 'erkek'];
export const AUDIENCE_LABELS: Record<Audience, string> = { kadin: 'Kadın', erkek: 'Erkek' };
export const RUN_TRIGGERS = ['cron', 'button', 'regenerate', 'local'] as const;
export type RunTrigger = (typeof RUN_TRIGGERS)[number];
export type RecentHeadline = { date: DateKey; sign: SignSlug; headline: string; short: string };
```

`src/lib/content/lucky-colors.ts`:
```ts
import { foldTurkish } from '@/lib/text/turkish';

export const LUCKY_COLORS = [
  { id: 'lila', name: 'Lila', hex: '#C8B6E2' },
  { id: 'pudra', name: 'Pudra Pembe', hex: '#F4C2C2' },
  { id: 'bebek-mavisi', name: 'Bebek Mavisi', hex: '#BFD7ED' },
  { id: 'adacayi', name: 'Adaçayı Yeşili', hex: '#B7C9A8' },
  { id: 'seftali', name: 'Şeftali', hex: '#FFD1B3' },
  { id: 'lavanta', name: 'Lavanta', hex: '#D9C6F0' },
  { id: 'krem', name: 'Krem', hex: '#F6EEDF' },
  { id: 'nane', name: 'Nane Yeşili', hex: '#BEE3D3' },
  { id: 'mercan', name: 'Mercan', hex: '#F7A99C' },
  { id: 'limon', name: 'Limon Sarısı', hex: '#FFF1A8' },
  { id: 'altin', name: 'Altın', hex: '#D9B870' },
  { id: 'gumus', name: 'Gümüş', hex: '#C9CDD2' },
] as const;

export type LuckyColorId = (typeof LUCKY_COLORS)[number]['id'];
export const LUCKY_COLOR_IDS: readonly LuckyColorId[] = LUCKY_COLORS.map((color) => color.id);

export function getLuckyColor(id: LuckyColorId) {
  return LUCKY_COLORS.find((color) => color.id === id)!;
}

export function normalizeLuckyColor(input: string): LuckyColorId | null {
  const folded = foldTurkish(input);
  return LUCKY_COLORS.find((color) => foldTurkish(color.id) === folded || foldTurkish(color.name) === folded)?.id ?? null;
}
```

`src/lib/content/hashtags.ts`:
```ts
export const MAX_HASHTAGS = 5;

export function normalizeHashtag(input: string): string | null {
  const body = input.trim().replace(/^#+/, '').toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}_]/gu, '');
  return body ? `#${body}` : null;
}

export function mergeHashtags(base: readonly string[], suggested: readonly string[]): string[] {
  const result: string[] = [];
  for (const tag of [...base, ...suggested]) {
    const normalized = normalizeHashtag(tag);
    if (normalized && !result.includes(normalized)) result.push(normalized);
    if (result.length === MAX_HASHTAGS) break;
  }
  return result;
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npx vitest run src/lib/content && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content
git commit -m "feat: içerik tipleri, şanslı renk paleti ve hashtag birleştirme" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Yanıt şeması ve kalite kapısı

**Files:**
- Create: `src/lib/content/horoscope-schema.ts`, `src/lib/content/quality.ts`, `src/lib/llm/mock-content.ts`
- Test: `src/lib/content/quality.test.ts`

**Interfaces:**
- Consumes: `graphemeLength`, `countEmoji`, `looksTurkish` (Task 1); `normalizeSignName`, `SIGN_SLUGS`, `getSign`, `SignSlug` (Task 1); `normalizeLuckyColor`, `LuckyColorId`, `mergeHashtags` (Task 3)
- Produces:
```ts
// src/lib/content/horoscope-schema.ts
export const horoscopeEntrySchema; export const horoscopeBatchSchema; export const horoscopeSingleSchema;
export type HoroscopeEntryRaw = { burc: string; baslik: string; yorum: string; kisa: string; puanlar: { ask: number; para: number; saglik: number }; sansliRenk: string; sansliSayi: number };
export type HoroscopeBatchRaw = { kapakKanca: string; caption: string; hashtagler: string[]; burclar: HoroscopeEntryRaw[] };
export type HoroscopeSingleRaw = { burc: HoroscopeEntryRaw };
// src/lib/content/quality.ts
export const MAX_FAILED_SIGNS = 6;
export type QualityIssue = { field: string; message: string };
export type HoroscopeEntry = { sign: SignSlug; headline: string; body: string; short: string; scores: { love: number; money: number; health: number }; luckyColor: LuckyColorId; luckyNumber: number };
export type HoroscopePostFields = { coverHook: string; caption: string; hashtags: string[] };
export function checkHoroscopeEntry(raw: HoroscopeEntryRaw): { sign: SignSlug | null; entry: HoroscopeEntry | null; issues: QualityIssue[] };
export function checkSingleSign(raw: HoroscopeSingleRaw, expected: SignSlug): { entry: HoroscopeEntry | null; issues: QualityIssue[] };
export type BatchCheck = { entries: Map<SignSlug, HoroscopeEntry>; failedSigns: { sign: SignSlug; issues: QualityIssue[] }[]; post: HoroscopePostFields | null; postIssues: QualityIssue[] };
export function checkHoroscopeBatch(raw: HoroscopeBatchRaw, baseHashtags: readonly string[]): BatchCheck;
export function batchIssues(check: BatchCheck): QualityIssue[]; // boşsa yanıt kabul edilir
// src/lib/llm/mock-content.ts
export function mockHoroscopeEntry(slug: SignSlug): HoroscopeEntryRaw;
export function mockHoroscopeBatch(): HoroscopeBatchRaw;
```

- [ ] **Step 1: Sahte içerik ve başarısız testi yaz**

(`zod` Faz 0'da kuruldu.)

`src/lib/content/horoscope-schema.ts`:
```ts
import { z } from 'zod';

export const horoscopeEntrySchema = z.object({
  burc: z.string(),
  baslik: z.string(),
  yorum: z.string(),
  kisa: z.string(),
  puanlar: z.object({ ask: z.number(), para: z.number(), saglik: z.number() }),
  sansliRenk: z.string(),
  sansliSayi: z.number(),
});

export const horoscopeBatchSchema = z.object({
  kapakKanca: z.string(),
  caption: z.string(),
  hashtagler: z.array(z.string()),
  burclar: z.array(horoscopeEntrySchema),
});

export const horoscopeSingleSchema = z.object({ burc: horoscopeEntrySchema });

export type HoroscopeEntryRaw = z.infer<typeof horoscopeEntrySchema>;
export type HoroscopeBatchRaw = z.infer<typeof horoscopeBatchSchema>;
export type HoroscopeSingleRaw = z.infer<typeof horoscopeSingleSchema>;
```

`src/lib/llm/mock-content.ts`:
```ts
import type { HoroscopeBatchRaw, HoroscopeEntryRaw } from '@/lib/content/horoscope-schema';
import { SIGN_SLUGS, getSign, type SignSlug } from '@/lib/zodiac/signs';

export function mockHoroscopeEntry(slug: SignSlug): HoroscopeEntryRaw {
  const { name, traits } = getSign(slug);
  const trait = traits.split(', ')[0];
  return {
    burc: name,
    baslik: `${name} için ışıltılı bir gün`,
    yorum: `Bugün ${name} burcu olarak ${trait} yanın öne çıkıyor. Gökyüzündeki hareketlilik sana küçük ama anlamlı fırsatlar getiriyor; bir arkadaşının önerisi aklına yepyeni bir fikir düşürebilir. İşte acele etmeden adım atarsan emeğinin karşılığını görürsün. Akşam saatlerinde kendine vakit ayır ve sevdiğin bir şarkıyla güne tatlı bir kapanış yap ✨`,
    kisa: `${name}: Küçük fırsatlara açık ol, akşamı kendine ayır ✨`,
    puanlar: { ask: 4, para: 3, saglik: 4 },
    sansliRenk: 'lila',
    sansliSayi: SIGN_SLUGS.indexOf(slug) + 7,
  };
}

export function mockHoroscopeBatch(): HoroscopeBatchRaw {
  return {
    kapakKanca: 'Bugün yıldızlar senden yana ✨',
    caption: 'Günün burç yorumları hazır! Burcunu bul, kaydet ve sevdiğinle paylaş. Sen hangi burçsun? Yorumlarda buluşalım 💫',
    hashtagler: ['#günlükburç', '#yıldızlar'],
    burclar: SIGN_SLUGS.map(mockHoroscopeEntry),
  };
}
```

`src/lib/content/quality.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mockHoroscopeBatch, mockHoroscopeEntry } from '@/lib/llm/mock-content';
import { batchIssues, checkHoroscopeBatch, checkHoroscopeEntry, checkSingleSign } from './quality';

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
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `npx vitest run src/lib/content/quality.test.ts`
Expected: FAIL — `./quality` bulunamaz.

- [ ] **Step 3: Kalite kapısını yaz**

`src/lib/content/quality.ts`:
```ts
import { countEmoji, graphemeLength, looksTurkish } from '@/lib/text/turkish';
import { SIGN_SLUGS, getSign, normalizeSignName, type SignSlug } from '@/lib/zodiac/signs';
import { mergeHashtags } from './hashtags';
import type { HoroscopeBatchRaw, HoroscopeEntryRaw, HoroscopeSingleRaw } from './horoscope-schema';
import { LUCKY_COLOR_IDS, normalizeLuckyColor, type LuckyColorId } from './lucky-colors';

export const MAX_FAILED_SIGNS = 6;

export type QualityIssue = { field: string; message: string };
export type HoroscopeEntry = {
  sign: SignSlug;
  headline: string;
  body: string;
  short: string;
  scores: { love: number; money: number; health: number };
  luckyColor: LuckyColorId;
  luckyNumber: number;
};
export type HoroscopePostFields = { coverHook: string; caption: string; hashtags: string[] };
export type BatchCheck = {
  entries: Map<SignSlug, HoroscopeEntry>;
  failedSigns: { sign: SignSlug; issues: QualityIssue[] }[];
  post: HoroscopePostFields | null;
  postIssues: QualityIssue[];
};

const BANNED_PHRASES = [
  'doktora gitmene gerek yok',
  'ilacını bırak',
  'yatırım tavsiyesi',
  'hisse senedi al',
  'kripto al',
  'bahis oyna',
  'kaza geçireceksin',
  'hastalanacaksın',
  'öleceksin',
  'ayrılacaksınız',
];

function textIssues(field: string, text: string, limits: { min: number; max: number; maxEmoji: number }): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const length = graphemeLength(text.trim());
  if (length < limits.min || length > limits.max) {
    issues.push({ field, message: `${limits.min}-${limits.max} karakter olmalı (şu an ${length}).` });
  }
  if (countEmoji(text) > limits.maxEmoji) issues.push({ field, message: `En fazla ${limits.maxEmoji} emoji kullanılmalı.` });
  const lower = text.toLocaleLowerCase('tr-TR');
  const banned = BANNED_PHRASES.find((phrase) => lower.includes(phrase));
  if (banned) issues.push({ field, message: `Yasaklı ifade: "${banned}".` });
  return issues;
}

function scoreIssues(raw: HoroscopeEntryRaw): QualityIssue[] {
  return (['ask', 'para', 'saglik'] as const).flatMap((key) => {
    const value = raw.puanlar[key];
    return Number.isInteger(value) && value >= 1 && value <= 5
      ? []
      : [{ field: `puanlar.${key}`, message: '1 ile 5 arasında tam sayı olmalı.' }];
  });
}

export function checkHoroscopeEntry(raw: HoroscopeEntryRaw): { sign: SignSlug | null; entry: HoroscopeEntry | null; issues: QualityIssue[] } {
  const sign = normalizeSignName(raw.burc);
  const luckyColor = normalizeLuckyColor(raw.sansliRenk);
  const issues: QualityIssue[] = [
    ...(sign ? [] : [{ field: 'burc', message: `Tanınmayan burç adı: "${raw.burc}".` }]),
    ...textIssues('baslik', raw.baslik, { min: 3, max: 40, maxEmoji: 1 }),
    ...textIssues('yorum', raw.yorum, { min: 280, max: 420, maxEmoji: 2 }),
    ...textIssues('kisa', raw.kisa, { min: 20, max: 140, maxEmoji: 1 }),
    ...(looksTurkish(`${raw.baslik} ${raw.yorum} ${raw.kisa}`) ? [] : [{ field: 'yorum', message: 'Metin Türkçe görünmüyor.' }]),
    ...scoreIssues(raw),
    ...(luckyColor ? [] : [{ field: 'sansliRenk', message: `Şu kimliklerden biri olmalı: ${LUCKY_COLOR_IDS.join(', ')}.` }]),
    ...(Number.isInteger(raw.sansliSayi) && raw.sansliSayi >= 1 && raw.sansliSayi <= 99
      ? []
      : [{ field: 'sansliSayi', message: '1 ile 99 arasında tam sayı olmalı.' }]),
  ];
  if (issues.length > 0 || !sign || !luckyColor) return { sign, entry: null, issues };
  return {
    sign,
    issues: [],
    entry: {
      sign,
      headline: raw.baslik.trim(),
      body: raw.yorum.trim(),
      short: raw.kisa.trim(),
      scores: { love: raw.puanlar.ask, money: raw.puanlar.para, health: raw.puanlar.saglik },
      luckyColor,
      luckyNumber: raw.sansliSayi,
    },
  };
}

export function checkSingleSign(raw: HoroscopeSingleRaw, expected: SignSlug): { entry: HoroscopeEntry | null; issues: QualityIssue[] } {
  const { sign, entry, issues } = checkHoroscopeEntry(raw.burc);
  if (sign !== expected) return { entry: null, issues: [{ field: 'burc', message: `${getSign(expected).name} için yazılmalıydı.` }] };
  return { entry, issues };
}

export function checkHoroscopeBatch(raw: HoroscopeBatchRaw, baseHashtags: readonly string[]): BatchCheck {
  const entries = new Map<SignSlug, HoroscopeEntry>();
  const issuesBySign = new Map<SignSlug, QualityIssue[]>();
  for (const item of raw.burclar) {
    const { sign, entry, issues } = checkHoroscopeEntry(item);
    if (!sign || entries.has(sign)) continue;
    if (entry) {
      entries.set(sign, entry);
      issuesBySign.delete(sign);
    } else if (!issuesBySign.has(sign)) {
      issuesBySign.set(sign, issues);
    }
  }
  const failedSigns = SIGN_SLUGS.filter((sign) => !entries.has(sign)).map((sign) => ({
    sign,
    issues: issuesBySign.get(sign) ?? [{ field: 'burc', message: 'Bu burç yanıtta yok.' }],
  }));
  const postIssues = [
    ...textIssues('kapakKanca', raw.kapakKanca, { min: 5, max: 60, maxEmoji: 1 }),
    ...textIssues('caption', raw.caption, { min: 40, max: 700, maxEmoji: 4 }),
    ...(raw.caption.includes('#') ? [{ field: 'caption', message: 'Caption hashtag içermemeli; hashtagler ayrı alanda.' }] : []),
  ];
  const post = postIssues.length
    ? null
    : { coverHook: raw.kapakKanca.trim(), caption: raw.caption.trim(), hashtags: mergeHashtags(baseHashtags, raw.hashtagler) };
  return { entries, failedSigns, post, postIssues };
}

export function batchIssues(check: BatchCheck): QualityIssue[] {
  return [
    ...check.postIssues,
    ...(check.failedSigns.length > MAX_FAILED_SIGNS
      ? [{ field: 'burclar', message: `${check.failedSigns.length} burç geçersiz ya da eksik.` }]
      : []),
  ];
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npx vitest run src/lib/content && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content src/lib/llm/mock-content.ts
git commit -m "feat: burç yanıt şeması ve kalite kapısı" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Prompt oluşturucu

**Files:**
- Create: `src/lib/content/horoscope-prompt.ts`
- Test: `src/lib/content/horoscope-prompt.test.ts`

**Interfaces:**
- Consumes: `SkySnapshot`, `describeSkyTr` (Task 2); `SIGNS`, `getSign`, `SignSlug` (Task 1); `LUCKY_COLOR_IDS` (Task 3); `Audience`, `RecentHeadline` (Task 3); `QualityIssue` (Task 4); `formatDateLongTr`, `formatDateShortTr` (Faz 0)
- Produces:
```ts
export const HOROSCOPE_PROMPT_VERSION = 'burc-v1';
export const HOROSCOPE_INSTRUCTIONS: string;
export type HoroscopePromptInput = { dateKey: DateKey; audience: Audience; sky: SkySnapshot; recent: RecentHeadline[] };
export function buildHoroscopeBatchPrompt(input: HoroscopePromptInput): { instructions: string; prompt: string };
export function buildHoroscopeSignPrompt(input: HoroscopePromptInput & { sign: SignSlug; issues: QualityIssue[] }): { instructions: string; prompt: string };
// Tek burç prompt'u şu satırı içerir (sahte model buna bakar): "Yalnızca şu burç için yaz: <Ad> (<slug>)"
```

- [ ] **Step 1: Başarısız testi yaz**

`src/lib/content/horoscope-prompt.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { getSkySnapshot } from '@/lib/astro/sky';
import { HOROSCOPE_INSTRUCTIONS, buildHoroscopeBatchPrompt, buildHoroscopeSignPrompt } from './horoscope-prompt';

const base = {
  dateKey: '2026-09-24',
  audience: 'kadin' as const,
  sky: getSkySnapshot('2026-09-24'),
  recent: [{ date: '2026-09-23', sign: 'koc' as const, headline: 'Cesaretin parlıyor', short: 'Koç: Bugün sahne senin' }],
};

describe('buildHoroscopeBatchPrompt', () => {
  it('tarih, okur kitlesi, gökyüzü, 12 burç ve tekrar önleme bilgisini içerir', () => {
    const { instructions, prompt } = buildHoroscopeBatchPrompt(base);
    expect(instructions).toBe(HOROSCOPE_INSTRUCTIONS);
    expect(prompt).toContain('Tarih: 24 Eylül 2026 Perşembe.');
    expect(prompt).toContain('Bu yorumlar kadın okurlar için.');
    expect(prompt).toContain('Güneş Terazi burcunda.');
    expect(prompt).toContain('- Koç (koc, 21 Mart – 19 Nisan): cesur, girişken, sabırsız, enerjik');
    expect(prompt).toContain('- Balık (balik, 19 Şubat – 20 Mart)');
    expect(prompt).toContain('23 Eylül Koç: Cesaretin parlıyor — Koç: Bugün sahne senin');
    expect(prompt).toContain('"burclar"');
    expect(prompt).not.toContain('Yalnızca şu burç için yaz');
  });

  it('erkek okur kitlesini ve boş geçmişi yazar', () => {
    const { prompt } = buildHoroscopeBatchPrompt({ ...base, audience: 'erkek', recent: [] });
    expect(prompt).toContain('Bu yorumlar erkek okurlar için.');
    expect(prompt).toContain('Son günlerde yazılmış yorum yok.');
  });
});

describe('talimatlar', () => {
  it('biçim kurallarını ve renk kimliklerini içerir', () => {
    expect(HOROSCOPE_INSTRUCTIONS).toContain('280–420 karakter');
    expect(HOROSCOPE_INSTRUCTIONS).toContain('lila, pudra, bebek-mavisi');
    expect(HOROSCOPE_INSTRUCTIONS).toContain('en fazla 3 Türkçe hashtag');
  });
});

describe('buildHoroscopeSignPrompt', () => {
  it('yalnızca hedef burcu ve düzeltilecek sorunları ister', () => {
    const { prompt } = buildHoroscopeSignPrompt({ ...base, sign: 'aslan', issues: [{ field: 'yorum', message: '280-420 karakter olmalı (şu an 120).' }] });
    expect(prompt).toContain('Yalnızca şu burç için yaz: Aslan (aslan)');
    expect(prompt).toContain('- yorum: 280-420 karakter olmalı (şu an 120).');
    expect(prompt).toContain('{"burc": {');
    expect(prompt).not.toContain('- Koç (koc');
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `npx vitest run src/lib/content/horoscope-prompt.test.ts`
Expected: FAIL — `./horoscope-prompt` bulunamaz.

- [ ] **Step 3: Uygulamayı yaz**

`src/lib/content/horoscope-prompt.ts`:
```ts
import { describeSkyTr, type SkySnapshot } from '@/lib/astro/sky';
import { formatDateLongTr, formatDateShortTr, type DateKey } from '@/lib/date/istanbul';
import { SIGNS, getSign, type SignSlug } from '@/lib/zodiac/signs';
import { LUCKY_COLOR_IDS } from './lucky-colors';
import type { QualityIssue } from './quality';
import type { Audience, RecentHeadline } from './types';

export const HOROSCOPE_PROMPT_VERSION = 'burc-v1';

export const HOROSCOPE_INSTRUCTIONS = [
  "Sen Instagram'da paylaşılacak günlük burç yorumları yazan, Türkçe konuşan bir astroloji içerik yazarısın.",
  '',
  'Üslup:',
  '- Okura "sen" diye hitap et; sıcak, pozitif ve cesaretlendirici ol, yer yer hafif ve zararsız bir espri kat.',
  '- Her yorum somut bir öneri ya da küçük bir gözlem içersin; her burca uyacak genel cümlelerden kaçın.',
  '- Emoji ölçülü olsun: yorumda en fazla 2, kısa metinde ve başlıkta en fazla 1.',
  '- Sağlık, ilaç, yatırım, borsa, kripto ya da bahis konusunda talimat verme; korkutucu ya da kaderci kehanetlerde bulunma.',
  '- Kadın ve erkek okurlara yazılan yorumlar bakış açısı ve örnek senaryolar bakımından farklılaşsın; aşağılayıcı ya da klişe cinsiyet kalıplarına başvurma.',
  '- Astrolojiyi eğlenceli bir rehber gibi sun; kesin gelecek iddiasında bulunma.',
  '',
  'Biçim kuralları:',
  '- "baslik": en fazla 40 karakter.',
  '- "yorum": 280–420 karakter arası tek paragraf.',
  '- "kisa": en fazla 140 karakter; Reels videosunda gösterilecek özet.',
  '- "puanlar": ask, para ve saglik için 1–5 arası tam sayılar.',
  `- "sansliRenk": yalnızca şu kimliklerden biri: ${LUCKY_COLOR_IDS.join(', ')}.`,
  '- "sansliSayi": 1–99 arası tam sayı.',
  '- "kapakKanca": carousel kapağı için en fazla 60 karakterlik merak uyandıran cümle.',
  '- "caption": Instagram açıklaması; en fazla 700 karakter, hashtag içermez, okuru kaydetmeye ve arkadaşını etiketlemeye davet eder.',
  '- "hashtagler": en fazla 3 Türkçe hashtag önerisi.',
  '- Yanıtı yalnızca istenen JSON nesnesi olarak ver; önüne ya da arkasına açıklama ekleme.',
].join('\n');

export type HoroscopePromptInput = { dateKey: DateKey; audience: Audience; sky: SkySnapshot; recent: RecentHeadline[] };

const AUDIENCE_TEXT: Record<Audience, string> = {
  kadin: 'Bu yorumlar kadın okurlar için. Örneklerini ve senaryolarını onların gündelik hayatından seç.',
  erkek: 'Bu yorumlar erkek okurlar için. Örneklerini ve senaryolarını onların gündelik hayatından seç.',
};

const ENTRY_SHAPE =
  '{"burc": "koc", "baslik": "...", "yorum": "...", "kisa": "...", "puanlar": {"ask": 4, "para": 3, "saglik": 5}, "sansliRenk": "lila", "sansliSayi": 7}';

function recentSection(recent: RecentHeadline[]): string {
  if (recent.length === 0) return 'Son günlerde yazılmış yorum yok.';
  return [
    'Son günlerde yazdıkların (tekrar etme, farklı açılar bul):',
    ...recent.map((item) => `- ${formatDateShortTr(item.date)} ${getSign(item.sign).name}: ${item.headline} — ${item.short}`),
  ].join('\n');
}

function contextLines(input: HoroscopePromptInput): string[] {
  return [`Tarih: ${formatDateLongTr(input.dateKey)}.`, AUDIENCE_TEXT[input.audience], '', 'Günün gökyüzü:', describeSkyTr(input.sky), ''];
}

export function buildHoroscopeBatchPrompt(input: HoroscopePromptInput): { instructions: string; prompt: string } {
  const prompt = [
    ...contextLines(input),
    'Burçlar:',
    ...SIGNS.map((sign) => `- ${sign.name} (${sign.slug}, ${sign.dateRange}): ${sign.traits}`),
    '',
    recentSection(input.recent),
    '',
    'Her burç için bir yorum yaz ve şu JSON biçiminde yanıt ver:',
    `{"kapakKanca": "...", "caption": "...", "hashtagler": ["#..."], "burclar": [${ENTRY_SHAPE}]}`,
    '"burclar" dizisinde 12 burcun her biri tam bir kez, yukarıdaki sırayla ve "burc" alanında parantez içindeki kimlikle yer almalı.',
  ].join('\n');
  return { instructions: HOROSCOPE_INSTRUCTIONS, prompt };
}

export function buildHoroscopeSignPrompt(
  input: HoroscopePromptInput & { sign: SignSlug; issues: QualityIssue[] },
): { instructions: string; prompt: string } {
  const sign = getSign(input.sign);
  const prompt = [
    ...contextLines(input),
    `Yalnızca şu burç için yaz: ${sign.name} (${sign.slug}), ${sign.dateRange}: ${sign.traits}`,
    '',
    recentSection(input.recent.filter((item) => item.sign === input.sign)),
    '',
    ...(input.issues.length
      ? ['Önceki denemede şu sorunlar vardı, bunları düzelt:', ...input.issues.map((issue) => `- ${issue.field}: ${issue.message}`), '']
      : []),
    'Şu JSON biçiminde yanıt ver:',
    `{"burc": ${ENTRY_SHAPE.replace('"koc"', `"${sign.slug}"`)}}`,
  ].join('\n');
  return { instructions: HOROSCOPE_INSTRUCTIONS, prompt };
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npx vitest run src/lib/content && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/horoscope-prompt.ts src/lib/content/horoscope-prompt.test.ts
git commit -m "feat: günlük burç prompt oluşturucu" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: LLM sağlayıcıları ve sahte model

**Files:**
- Create: `src/lib/llm/provider-ids.ts`, `src/lib/llm/providers.ts`, `src/lib/llm/mock-model.ts`
- Test: `src/lib/llm/providers.test.ts`, `src/lib/llm/mock-model.test.ts`

**Interfaces:**
- Consumes: `mockHoroscopeBatch`, `mockHoroscopeEntry` (Task 4); `SIGN_SLUGS`, `SignSlug` (Task 1)
- Produces:
```ts
// src/lib/llm/provider-ids.ts (bağımlılıksız; istemci tarafında da import edilebilir)
export const PROVIDER_IDS: readonly ['gateway','gemini','gemini-lite','ollama-cloud','groq','openrouter','cerebras','ollama-local','mock'];
export type ProviderId = (typeof PROVIDER_IDS)[number];
// src/lib/llm/providers.ts
export type ProviderSpec = { id: ProviderId; label: string; model: string; dailyCap: number; factory: (modelId: string) => LanguageModel };
export type ProviderPreference = { id: ProviderId; enabled: boolean; dailyCap?: number; model?: string };
export function availableProviders(env: Record<string, string | undefined>): ProviderSpec[]; // varsayılan sırada
export function resolveProviderChain(preferences: readonly ProviderPreference[], available: readonly ProviderSpec[], override?: string): ProviderSpec[];
// src/lib/llm/mock-model.ts
export function createMockModel(): MockLanguageModelV4; // prompt'ta "Yalnızca şu burç için yaz: … (slug)" varsa tek burç, yoksa 12'lik paket döner
```

- [ ] **Step 1: Başarısız testleri yaz**

`src/lib/llm/providers.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { availableProviders, resolveProviderChain } from './providers';

const ENV = { VERCEL: '1', GOOGLE_GENERATIVE_AI_API_KEY: 'g', OLLAMA_API_KEY: 'o' };

describe('availableProviders', () => {
  it('anahtar yoksa boş döner', () => {
    expect(availableProviders({})).toEqual([]);
  });

  it('anahtarı olanları varsayılan sıra, model ve tavanlarla döner', () => {
    expect(availableProviders(ENV).map(({ id, model, dailyCap }) => ({ id, model, dailyCap }))).toEqual([
      { id: 'gateway', model: 'google/gemini-2.5-flash', dailyCap: 300 },
      { id: 'gemini', model: 'gemini-3.5-flash', dailyCap: 18 },
      { id: 'gemini-lite', model: 'gemini-3.5-flash-lite', dailyCap: 450 },
      { id: 'ollama-cloud', model: 'gemma4:31b', dailyCap: 100 },
    ]);
  });

  it('opsiyonel sağlayıcılar yalnızca model de verilince eklenir', () => {
    expect(availableProviders({ GROQ_API_KEY: 'x' })).toEqual([]);
    expect(availableProviders({ GROQ_API_KEY: 'x', GROQ_MODEL: 'openai/gpt-oss-120b' }).map((spec) => spec.id)).toEqual(['groq']);
    expect(availableProviders({ LLM_MOCK: '1', OLLAMA_LOCAL_MODEL: 'gemma4:26b' }).map((spec) => spec.id)).toEqual(['ollama-local', 'mock']);
  });

  it('fabrika istenen model kimliğiyle model üretir', () => {
    const [gemini] = availableProviders({ GOOGLE_GENERATIVE_AI_API_KEY: 'g' });
    expect((gemini.factory('gemini-3.8-flash') as { modelId: string }).modelId).toBe('gemini-3.8-flash');
  });
});

describe('resolveProviderChain', () => {
  const available = availableProviders(ENV);

  it('tercih sırasını uygular, kapalıları çıkarır, kalanları varsayılan sırayla ekler', () => {
    const chain = resolveProviderChain(
      [
        { id: 'gemini-lite', enabled: true, dailyCap: 100, model: 'gemini-3.1-flash-lite' },
        { id: 'gateway', enabled: false },
      ],
      available,
    );
    expect(chain.map(({ id, model, dailyCap }) => ({ id, model, dailyCap }))).toEqual([
      { id: 'gemini-lite', model: 'gemini-3.1-flash-lite', dailyCap: 100 },
      { id: 'gemini', model: 'gemini-3.5-flash', dailyCap: 18 },
      { id: 'ollama-cloud', model: 'gemma4:31b', dailyCap: 100 },
    ]);
  });

  it('override yalnızca o sağlayıcıyı döner, yapılandırılmamışsa fırlatır', () => {
    expect(resolveProviderChain([], availableProviders({ LLM_MOCK: '1' }), 'mock').map((spec) => spec.id)).toEqual(['mock']);
    expect(() => resolveProviderChain([], available, 'mock')).toThrow('LLM_PROVIDER_OVERRIDE=mock');
  });
});
```

`src/lib/llm/mock-model.test.ts`:
```ts
import { generateObject } from 'ai';
import { describe, expect, it } from 'vitest';
import { horoscopeBatchSchema, horoscopeSingleSchema } from '@/lib/content/horoscope-schema';
import { checkHoroscopeBatch, checkSingleSign } from '@/lib/content/quality';
import { createMockModel } from './mock-model';

describe('createMockModel', () => {
  it('paket istemine kalite kapısından geçen 12 burç döner', async () => {
    const { object } = await generateObject({ model: createMockModel(), schema: horoscopeBatchSchema, prompt: 'Her burç için yaz', maxRetries: 0 });
    const check = checkHoroscopeBatch(object, ['#burç']);
    expect(check.entries.size).toBe(12);
    expect(check.postIssues).toEqual([]);
  });

  it('tek burç istemine o burcu döner', async () => {
    const { object } = await generateObject({
      model: createMockModel(),
      schema: horoscopeSingleSchema,
      prompt: 'Yalnızca şu burç için yaz: Aslan (aslan), 23 Temmuz – 22 Ağustos',
      maxRetries: 0,
    });
    expect(checkSingleSign(object, 'aslan').entry?.sign).toBe('aslan');
  });
});
```

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `npx vitest run src/lib/llm`
Expected: FAIL — modüller bulunamaz.

- [ ] **Step 3: Uygulamaları yaz**

```bash
npm install ai@7.0.114 @ai-sdk/gateway@4.0.92 @ai-sdk/google@4.0.80 @ai-sdk/openai-compatible@3.0.57
```

`src/lib/llm/provider-ids.ts`:
```ts
export const PROVIDER_IDS = ['gateway', 'gemini', 'gemini-lite', 'ollama-cloud', 'groq', 'openrouter', 'cerebras', 'ollama-local', 'mock'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];
```

`src/lib/llm/mock-model.ts`:
```ts
import { MockLanguageModelV4 } from 'ai/test';
import { SIGN_SLUGS, type SignSlug } from '@/lib/zodiac/signs';
import { mockHoroscopeBatch, mockHoroscopeEntry } from './mock-content';

const SINGLE_SIGN = /Yalnızca şu burç için yaz: [^()"]*\(([a-z]+)\)/;

export function createMockModel(): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    provider: 'mock',
    modelId: 'mock',
    doGenerate: async ({ prompt }) => {
      const slug = JSON.stringify(prompt).match(SINGLE_SIGN)?.[1];
      const payload =
        slug && (SIGN_SLUGS as readonly string[]).includes(slug)
          ? { burc: mockHoroscopeEntry(slug as SignSlug) }
          : mockHoroscopeBatch();
      return {
        content: [{ type: 'text', text: JSON.stringify(payload) }],
        finishReason: { unified: 'stop', raw: undefined },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 0, text: 0, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
}
```

`src/lib/llm/providers.ts`:
```ts
import { createGateway } from '@ai-sdk/gateway';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { createMockModel } from './mock-model';
import type { ProviderId } from './provider-ids';

export type ProviderSpec = {
  id: ProviderId;
  label: string;
  model: string;
  dailyCap: number;
  factory: (modelId: string) => LanguageModel;
};
export type ProviderPreference = { id: ProviderId; enabled: boolean; dailyCap?: number; model?: string };
type Env = Record<string, string | undefined>;

function openAICompatible(name: string, baseURL: string, apiKey: string | undefined) {
  // JSON şema desteği bu uçlarda belgelenmemiş: JSON modu + prompt içindeki biçim tarifi kullanılır.
  const provider = createOpenAICompatible({ name, baseURL, apiKey, supportsStructuredOutputs: false });
  return (modelId: string) => provider(modelId);
}

export function availableProviders(env: Env): ProviderSpec[] {
  const specs: ProviderSpec[] = [];
  if (env.VERCEL === '1' || env.AI_GATEWAY_API_KEY) {
    const gateway = createGateway({ apiKey: env.AI_GATEWAY_API_KEY });
    specs.push({ id: 'gateway', label: 'Vercel AI Gateway', model: env.AI_GATEWAY_MODEL ?? 'google/gemini-2.5-flash', dailyCap: 300, factory: (id) => gateway(id) });
  }
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const google = createGoogle({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });
    specs.push({ id: 'gemini', label: 'Gemini API', model: env.GEMINI_MODEL ?? 'gemini-3.5-flash', dailyCap: 18, factory: (id) => google(id) });
    specs.push({ id: 'gemini-lite', label: 'Gemini API (Lite)', model: env.GEMINI_LITE_MODEL ?? 'gemini-3.5-flash-lite', dailyCap: 450, factory: (id) => google(id) });
  }
  if (env.OLLAMA_API_KEY) {
    specs.push({ id: 'ollama-cloud', label: 'Ollama Cloud', model: env.OLLAMA_CLOUD_MODEL ?? 'gemma4:31b', dailyCap: 100, factory: openAICompatible('ollama-cloud', 'https://ollama.com/v1', env.OLLAMA_API_KEY) });
  }
  if (env.GROQ_API_KEY && env.GROQ_MODEL) {
    specs.push({ id: 'groq', label: 'Groq', model: env.GROQ_MODEL, dailyCap: 500, factory: openAICompatible('groq', 'https://api.groq.com/openai/v1', env.GROQ_API_KEY) });
  }
  if (env.OPENROUTER_API_KEY && env.OPENROUTER_MODEL) {
    specs.push({ id: 'openrouter', label: 'OpenRouter', model: env.OPENROUTER_MODEL, dailyCap: 45, factory: openAICompatible('openrouter', 'https://openrouter.ai/api/v1', env.OPENROUTER_API_KEY) });
  }
  if (env.CEREBRAS_API_KEY && env.CEREBRAS_MODEL) {
    specs.push({ id: 'cerebras', label: 'Cerebras', model: env.CEREBRAS_MODEL, dailyCap: 500, factory: openAICompatible('cerebras', 'https://api.cerebras.ai/v1', env.CEREBRAS_API_KEY) });
  }
  if (env.OLLAMA_LOCAL_MODEL) {
    specs.push({ id: 'ollama-local', label: 'Yerel Ollama', model: env.OLLAMA_LOCAL_MODEL, dailyCap: 10_000, factory: openAICompatible('ollama-local', env.OLLAMA_LOCAL_URL ?? 'http://localhost:11434/v1', 'ollama') });
  }
  if (env.LLM_MOCK === '1') {
    specs.push({ id: 'mock', label: 'Sahte model', model: 'mock', dailyCap: 10_000, factory: () => createMockModel() });
  }
  return specs;
}

export function resolveProviderChain(
  preferences: readonly ProviderPreference[],
  available: readonly ProviderSpec[],
  override?: string,
): ProviderSpec[] {
  if (override) {
    const spec = available.find((candidate) => candidate.id === override);
    if (!spec) throw new Error(`LLM_PROVIDER_OVERRIDE=${override} için yapılandırılmış sağlayıcı yok`);
    return [spec];
  }
  const remaining = new Map(available.map((spec) => [spec.id, spec]));
  const chain: ProviderSpec[] = [];
  for (const preference of preferences) {
    const spec = remaining.get(preference.id);
    if (!spec) continue;
    remaining.delete(preference.id);
    if (preference.enabled) {
      chain.push({ ...spec, model: preference.model ?? spec.model, dailyCap: preference.dailyCap ?? spec.dailyCap });
    }
  }
  return [...chain, ...remaining.values()];
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npx vitest run src/lib/llm && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/llm
git commit -m "feat: LLM sağlayıcı kataloğu, zincir çözümleme ve sahte model" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Yedeklemeli LLM yönlendirici

**Files:**
- Create: `src/lib/llm/router.ts`
- Test: `src/lib/llm/router.test.ts`

**Interfaces:**
- Consumes: `ProviderSpec`, `ProviderId` (Task 6); `QualityIssue` (Task 4)
- Produces:
```ts
export type AttemptStatus = 'ok' | 'rate_limited' | 'auth_error' | 'client_error' | 'server_error' | 'timeout' | 'invalid_output' | 'skipped_cap' | 'skipped_cooldown';
export type AttemptLog = { providerId: ProviderId; model: string; status: AttemptStatus; httpStatus: number | null; error: string | null; inputTokens: number | null; outputTokens: number | null; latencyMs: number };
export type ProviderUsage = { callsToday: number; lastRateLimitedAt: Date | null };
export type RouterDeps = { chain: readonly ProviderSpec[]; usage: (id: ProviderId) => Promise<ProviderUsage>; onAttempt: (log: AttemptLog) => Promise<void>; now?: () => Date; timeoutMs?: number };
export type StructuredRequest<T> = { schema: z.ZodType<T>; instructions: string; prompt: string; validate: (value: T) => QualityIssue[] };
export type RouterResult<T> = { value: T; providerId: ProviderId; model: string };
export const RATE_LIMIT_COOLDOWN_MS: number; // 60 dk
export class NoProvidersConfiguredError extends Error {}
export class AllProvidersFailedError extends Error { readonly attempts: AttemptLog[] }
export async function generateWithFailover<T>(deps: RouterDeps, request: StructuredRequest<T>): Promise<RouterResult<T>>;
```

- [ ] **Step 1: Başarısız testi yaz**

`src/lib/llm/router.test.ts`:
```ts
import { APICallError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ProviderId } from './provider-ids';
import type { ProviderSpec } from './providers';
import { AllProvidersFailedError, NoProvidersConfiguredError, generateWithFailover, type AttemptLog, type ProviderUsage } from './router';

const HANG = Symbol('hang');
type Behaviour = { n: number } | string | Error | typeof HANG;

const usage = {
  inputTokens: { total: 11, noCache: 11, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 22, text: 22, reasoning: undefined },
};

function apiError(statusCode: number) {
  return new APICallError({ message: `HTTP ${statusCode}`, url: 'https://example.test', requestBodyValues: {}, statusCode, isRetryable: statusCode >= 500 });
}

function provider(id: ProviderId, behaviours: Behaviour[], dailyCap = 100) {
  let calls = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async ({ abortSignal }) => {
      const behaviour = behaviours[Math.min(calls, behaviours.length - 1)];
      calls++;
      if (behaviour === HANG) {
        return new Promise<never>((_, reject) => abortSignal?.addEventListener('abort', () => reject(abortSignal.reason)));
      }
      if (behaviour instanceof Error) throw behaviour;
      const text = typeof behaviour === 'string' ? behaviour : JSON.stringify(behaviour);
      return { content: [{ type: 'text', text }], finishReason: { unified: 'stop', raw: undefined }, usage, warnings: [] };
    },
  });
  const spec: ProviderSpec = { id, label: id, model: `${id}-model`, dailyCap, factory: () => model };
  return { spec, calls: () => calls };
}

const request = {
  schema: z.object({ n: z.number() }),
  instructions: 'talimat',
  prompt: 'istem',
  validate: (value: { n: number }) => (value.n > 0 ? [] : [{ field: 'n', message: 'pozitif olmalı' }]),
};

function deps(chain: ProviderSpec[], usageById: Partial<Record<ProviderId, ProviderUsage>> = {}) {
  const logs: AttemptLog[] = [];
  return {
    logs,
    value: {
      chain,
      usage: async (id: ProviderId) => usageById[id] ?? { callsToday: 0, lastRateLimitedAt: null },
      onAttempt: async (log: AttemptLog) => {
        logs.push(log);
      },
      now: () => new Date('2026-09-26T10:00:00Z'),
      timeoutMs: 50,
    },
  };
}

describe('generateWithFailover', () => {
  it('ilk sağlayıcı başarılıysa onu kullanır ve kullanımı kaydeder', async () => {
    const a = provider('gateway', [{ n: 1 }]);
    const d = deps([a.spec]);
    await expect(generateWithFailover(d.value, request)).resolves.toEqual({ value: { n: 1 }, providerId: 'gateway', model: 'gateway-model' });
    expect(d.logs).toMatchObject([{ providerId: 'gateway', status: 'ok', inputTokens: 11, outputTokens: 22, httpStatus: null }]);
  });

  it('429 alınca tekrar denemeden sıradakine geçer', async () => {
    const a = provider('gateway', [apiError(429)]);
    const b = provider('gemini', [{ n: 2 }]);
    const d = deps([a.spec, b.spec]);
    expect((await generateWithFailover(d.value, request)).providerId).toBe('gemini');
    expect(a.calls()).toBe(1);
    expect(d.logs.map((log) => [log.providerId, log.status, log.httpStatus])).toEqual([
      ['gateway', 'rate_limited', 429],
      ['gemini', 'ok', null],
    ]);
  });

  it('401 ve 404 hatalarında da hemen sıradakine geçer', async () => {
    const a = provider('gateway', [apiError(401)]);
    const b = provider('gemini', [apiError(404)]);
    const c = provider('gemini-lite', [{ n: 3 }]);
    const d = deps([a.spec, b.spec, c.spec]);
    expect((await generateWithFailover(d.value, request)).providerId).toBe('gemini-lite');
    expect(d.logs.map((log) => log.status)).toEqual(['auth_error', 'client_error', 'ok']);
  });

  it('5xx sonrasında aynı sağlayıcıyı bir kez daha dener', async () => {
    const a = provider('gateway', [apiError(503), { n: 4 }]);
    const d = deps([a.spec]);
    expect((await generateWithFailover(d.value, request)).value).toEqual({ n: 4 });
    expect(d.logs.map((log) => log.status)).toEqual(['server_error', 'ok']);
  });

  it('kaliteyi iki kez geçemeyen sağlayıcıdan sonrakine geçer', async () => {
    const a = provider('gateway', [{ n: -1 }]);
    const b = provider('gemini', ['bozuk json', { n: 5 }]);
    const d = deps([a.spec, b.spec]);
    expect((await generateWithFailover(d.value, request)).value).toEqual({ n: 5 });
    expect(d.logs.map((log) => [log.providerId, log.status])).toEqual([
      ['gateway', 'invalid_output'],
      ['gateway', 'invalid_output'],
      ['gemini', 'invalid_output'],
      ['gemini', 'ok'],
    ]);
    expect(d.logs[0].error).toBe('n: pozitif olmalı');
  });

  it('zaman aşımını bir kez tekrar dener, sonra sıradakine geçer', async () => {
    const a = provider('gateway', [HANG]);
    const b = provider('gemini', [{ n: 6 }]);
    const d = deps([a.spec, b.spec]);
    expect((await generateWithFailover(d.value, request)).providerId).toBe('gemini');
    expect(d.logs.map((log) => log.status)).toEqual(['timeout', 'timeout', 'ok']);
  });

  it('günlük tavanı dolan ve son bir saatte 429 alan sağlayıcıyı çağırmadan atlar', async () => {
    const a = provider('gateway', [{ n: 1 }], 5);
    const b = provider('gemini', [{ n: 1 }]);
    const c = provider('gemini-lite', [{ n: 7 }]);
    const d = deps([a.spec, b.spec, c.spec], {
      gateway: { callsToday: 5, lastRateLimitedAt: null },
      gemini: { callsToday: 1, lastRateLimitedAt: new Date('2026-09-26T09:30:00Z') },
    });
    expect((await generateWithFailover(d.value, request)).providerId).toBe('gemini-lite');
    expect(a.calls() + b.calls()).toBe(0);
    expect(d.logs.map((log) => log.status)).toEqual(['skipped_cap', 'skipped_cooldown', 'ok']);
  });

  it('bir saatten eski 429 soğuması sağlayıcıyı engellemez', async () => {
    const a = provider('gemini', [{ n: 8 }]);
    const d = deps([a.spec], { gemini: { callsToday: 1, lastRateLimitedAt: new Date('2026-09-26T08:30:00Z') } });
    expect((await generateWithFailover(d.value, request)).providerId).toBe('gemini');
  });

  it('hepsi başarısızsa tüm denemelerle hata fırlatır', async () => {
    const a = provider('gateway', [apiError(500)]);
    const d = deps([a.spec]);
    const error = await generateWithFailover(d.value, request).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AllProvidersFailedError);
    expect((error as AllProvidersFailedError).attempts.map((log) => log.status)).toEqual(['server_error', 'server_error']);
  });

  it('zincir boşsa yapılandırma hatası fırlatır', async () => {
    await expect(generateWithFailover(deps([]).value, request)).rejects.toBeInstanceOf(NoProvidersConfiguredError);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `npx vitest run src/lib/llm/router.test.ts`
Expected: FAIL — `./router` bulunamaz.

- [ ] **Step 3: Yönlendiriciyi yaz**

`src/lib/llm/router.ts`:
```ts
import { NoObjectGeneratedError, generateObject } from 'ai';
import type { z } from 'zod';
import type { QualityIssue } from '@/lib/content/quality';
import type { ProviderId } from './provider-ids';
import type { ProviderSpec } from './providers';

export type AttemptStatus =
  | 'ok'
  | 'rate_limited'
  | 'auth_error'
  | 'client_error'
  | 'server_error'
  | 'timeout'
  | 'invalid_output'
  | 'skipped_cap'
  | 'skipped_cooldown';

export type AttemptLog = {
  providerId: ProviderId;
  model: string;
  status: AttemptStatus;
  httpStatus: number | null;
  error: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
};

export type ProviderUsage = { callsToday: number; lastRateLimitedAt: Date | null };

export type RouterDeps = {
  chain: readonly ProviderSpec[];
  usage: (id: ProviderId) => Promise<ProviderUsage>;
  onAttempt: (log: AttemptLog) => Promise<void>;
  now?: () => Date;
  timeoutMs?: number;
};

export type StructuredRequest<T> = {
  schema: z.ZodType<T>;
  instructions: string;
  prompt: string;
  validate: (value: T) => QualityIssue[];
};

export type RouterResult<T> = { value: T; providerId: ProviderId; model: string };

export const RATE_LIMIT_COOLDOWN_MS = 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 120_000;
const ATTEMPTS_PER_PROVIDER = 2;

export class NoProvidersConfiguredError extends Error {
  constructor() {
    super('Hiçbir LLM sağlayıcısı yapılandırılmamış.');
    this.name = 'NoProvidersConfiguredError';
  }
}

export class AllProvidersFailedError extends Error {
  readonly attempts: AttemptLog[];

  constructor(attempts: AttemptLog[]) {
    super(`Tüm sağlayıcılar başarısız oldu (${attempts.length} deneme).`);
    this.name = 'AllProvidersFailedError';
    this.attempts = attempts;
  }
}

function classify(error: unknown): { status: AttemptStatus; httpStatus: number | null } {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return { status: 'timeout', httpStatus: null };
  if (NoObjectGeneratedError.isInstance(error)) return { status: 'invalid_output', httpStatus: null };
  const statusCode = (error as { statusCode?: unknown } | null)?.statusCode;
  const httpStatus = typeof statusCode === 'number' ? statusCode : null;
  if (httpStatus === 429) return { status: 'rate_limited', httpStatus };
  if (httpStatus === 401 || httpStatus === 403) return { status: 'auth_error', httpStatus };
  if (httpStatus !== null && httpStatus >= 400 && httpStatus < 500) return { status: 'client_error', httpStatus };
  return { status: 'server_error', httpStatus };
}

const MOVE_ON_IMMEDIATELY: AttemptStatus[] = ['rate_limited', 'auth_error', 'client_error'];

function describeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

function describeIssues(issues: QualityIssue[]): string {
  return issues.slice(0, 5).map((issue) => `${issue.field}: ${issue.message}`).join('; ');
}

export async function generateWithFailover<T>(deps: RouterDeps, request: StructuredRequest<T>): Promise<RouterResult<T>> {
  if (deps.chain.length === 0) throw new NoProvidersConfiguredError();
  const now = deps.now ?? (() => new Date());
  const attempts: AttemptLog[] = [];
  const record = async (log: AttemptLog) => {
    attempts.push(log);
    await deps.onAttempt(log);
  };

  for (const spec of deps.chain) {
    const base = { providerId: spec.id, model: spec.model, httpStatus: null, inputTokens: null, outputTokens: null, latencyMs: 0 };
    const usage = await deps.usage(spec.id);
    if (usage.callsToday >= spec.dailyCap) {
      await record({ ...base, status: 'skipped_cap', error: `Günlük tavan dolu (${spec.dailyCap}).` });
      continue;
    }
    if (usage.lastRateLimitedAt && now().getTime() - usage.lastRateLimitedAt.getTime() < RATE_LIMIT_COOLDOWN_MS) {
      await record({ ...base, status: 'skipped_cooldown', error: 'Son bir saatte hız sınırına takıldı.' });
      continue;
    }

    for (let attempt = 1; attempt <= ATTEMPTS_PER_PROVIDER; attempt++) {
      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new DOMException('Zaman aşımı', 'TimeoutError')),
        deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );
      try {
        const result = await generateObject({
          model: spec.factory(spec.model),
          schema: request.schema,
          instructions: request.instructions,
          prompt: request.prompt,
          maxRetries: 0,
          abortSignal: controller.signal,
        });
        const issues = request.validate(result.object);
        const measured = {
          ...base,
          latencyMs: Date.now() - started,
          inputTokens: result.usage.inputTokens ?? null,
          outputTokens: result.usage.outputTokens ?? null,
        };
        if (issues.length === 0) {
          await record({ ...measured, status: 'ok', error: null });
          return { value: result.object, providerId: spec.id, model: spec.model };
        }
        await record({ ...measured, status: 'invalid_output', error: describeIssues(issues) });
      } catch (error) {
        const { status, httpStatus } = classify(error);
        await record({ ...base, status, httpStatus, error: describeError(error), latencyMs: Date.now() - started });
        if (MOVE_ON_IMMEDIATELY.includes(status)) break;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  throw new AllProvidersFailedError(attempts);
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npx vitest run src/lib/llm && npm run typecheck`
Expected: 10 router testi dahil tümü PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/router.ts src/lib/llm/router.test.ts
git commit -m "feat: kota ve hata farkında yedeklemeli LLM yönlendirici" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: İçerik tabloları, sürümleme ve üretim kayıtları

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/errors.ts`, `src/lib/content/repository.ts`, `src/lib/content/runs.ts`
- Generated: `src/db/migrations/0001_content.sql`
- Test: `src/lib/content/repository.test.ts`, `src/lib/content/runs.test.ts`

**Interfaces:**
- Consumes: `Db`, `createTestDb` (Faz 0); `READING_KINDS`, `READING_AUDIENCES`, `RUN_TRIGGERS`, `ReadingKind`, `ReadingAudience`, `RunTrigger`, `RecentHeadline` (Task 3); `LuckyColorId` (Task 3); `SignSlug`, `SIGN_SLUGS` (Task 1); `AttemptLog`, `ProviderUsage` (Task 7); `ProviderId` (Task 6); tarih yardımcıları (Faz 0)
- Produces:
```ts
// src/db/schema.ts (eklenenler)
export type ReadingMeta = { scores: { love: number; money: number; health: number }; luckyColor: LuckyColorId; luckyNumber: number };
export type PostCover = { hook: string };
export type PostFormat = '4x5' | '3x4';
export const readingKindEnum, audienceEnum, postStatusEnum, slideTypeEnum, runStatusEnum, runTriggerEnum;
export const generationRuns, llmCalls, readings, posts, postSlides;
// src/db/errors.ts
export function isUniqueViolation(error: unknown): boolean; // kod 23505 (doğrudan ya da DrizzleQueryError.cause)
// src/lib/content/repository.ts
export type ReadingKey = { date: DateKey; kind: ReadingKind; audience: ReadingAudience };
export type NewReading = { sign: SignSlug; headline: string; body: string; short: string; meta: ReadingMeta; provider: string; model: string; promptVersion: string; runId: string | null };
export type ReadingRow; export type PostRow; export type SlideRow;
export type NewPost = ReadingKey & { templateVersion: string; format: PostFormat; cover: PostCover; caption: string; hashtags: string[]; signReadingIds: readonly string[] };
export async function saveReadings(db: Db, key: ReadingKey, items: readonly NewReading[]): Promise<ReadingRow[]>;
export async function getCurrentReadings(db: Db, key: ReadingKey): Promise<ReadingRow[]>; // burç sırasıyla
export async function getRecentHeadlines(db: Db, key: Omit<ReadingKey, 'date'>, beforeDate: DateKey, days: number): Promise<RecentHeadline[]>;
export async function createPostVersion(db: Db, input: NewPost): Promise<PostRow>; // 0: kapak, 1–12: burçlar, 13: CTA
export async function getCurrentPost(db: Db, key: ReadingKey): Promise<{ post: PostRow; slides: SlideRow[] } | null>;
export async function getCurrentPostsForDate(db: Db, date: DateKey): Promise<PostRow[]>;
// src/lib/content/runs.ts
export const STALE_RUN_MS: number; // 10 dk
export async function startRun(db: Db, key: ReadingKey & { sign?: SignSlug; trigger: RunTrigger }, now?: Date): Promise<{ id: string } | null>; // null = başka üretim sürüyor
export async function finishRun(db: Db, id: string, result: { status: 'succeeded' } | { status: 'failed'; error: string }, now?: Date): Promise<void>;
export async function logLlmCall(db: Db, runId: string | null, log: AttemptLog, now?: Date): Promise<void>;
export async function getProviderUsage(db: Db, providerId: ProviderId, now?: Date): Promise<ProviderUsage>;
export type UsageRow = { date: DateKey; provider: string; ok: number; failed: number };
export async function getUsageSummary(db: Db, days: number, now?: Date): Promise<UsageRow[]>;
```

- [ ] **Step 1: Başarısız testleri yaz**

`src/lib/content/repository.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { readings } from '@/db/schema';
import { isUniqueViolation } from '@/db/errors';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { SIGN_SLUGS, type SignSlug } from '@/lib/zodiac/signs';
import {
  createPostVersion,
  getCurrentPost,
  getCurrentPostsForDate,
  getCurrentReadings,
  getRecentHeadlines,
  saveReadings,
  type NewReading,
} from './repository';

const KEY = { date: '2026-09-26', kind: 'horoscope' as const, audience: 'kadin' as const };

function reading(sign: SignSlug, headline = `${sign} başlık`): NewReading {
  return {
    sign,
    headline,
    body: `${sign} yorum`,
    short: `${sign} kısa`,
    meta: { scores: { love: 4, money: 3, health: 5 }, luckyColor: 'lila', luckyNumber: 7 },
    provider: 'mock',
    model: 'mock',
    promptVersion: 'burc-v1',
    runId: null,
  };
}

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('okuma sürümleri', () => {
  it('yeniden kayıt yeni sürüm açar, yalnızca son sürüm güncel kalır', async () => {
    await saveReadings(db, KEY, SIGN_SLUGS.map((sign) => reading(sign)));
    const [second] = await saveReadings(db, KEY, [reading('koc', 'yeni başlık')]);
    expect(second).toMatchObject({ sign: 'koc', version: 2, isCurrent: true });
    const current = await getCurrentReadings(db, KEY);
    expect(current.map((row) => row.sign)).toEqual([...SIGN_SLUGS]);
    expect(current[0]).toMatchObject({ headline: 'yeni başlık', version: 2 });
    expect(await db.select().from(readings)).toHaveLength(13);
  });

  it('aynı anahtarda ikinci güncel kayıt veritabanı tarafından reddedilir', async () => {
    await saveReadings(db, KEY, [reading('koc')]);
    const error = await db
      .insert(readings)
      .values({ ...KEY, ...reading('koc'), version: 9, isCurrent: true })
      .catch((caught: unknown) => caught);
    expect(isUniqueViolation(error)).toBe(true);
  });

  it('son iki günün yalnızca güncel başlıklarını döner', async () => {
    for (const date of ['2026-09-23', '2026-09-24', '2026-09-25']) {
      await saveReadings(db, { ...KEY, date }, [reading('koc', `başlık ${date}`)]);
    }
    await saveReadings(db, { ...KEY, date: '2026-09-25' }, [reading('koc', 'son başlık')]);
    await saveReadings(db, { ...KEY, audience: 'erkek', date: '2026-09-25' }, [reading('koc', 'erkek başlık')]);
    const recent = await getRecentHeadlines(db, { kind: 'horoscope', audience: 'kadin' }, '2026-09-26', 2);
    expect(recent.map((item) => [item.date, item.headline])).toEqual([
      ['2026-09-24', 'başlık 2026-09-24'],
      ['2026-09-25', 'son başlık'],
    ]);
  });
});

describe('gönderi sürümleri', () => {
  it('14 slaytlık gönderi oluşturur; yeni sürüm eskisini arşivler', async () => {
    const saved = await saveReadings(db, KEY, SIGN_SLUGS.map((sign) => reading(sign)));
    const input = {
      ...KEY,
      templateVersion: 'pastel@1',
      format: '4x5' as const,
      cover: { hook: 'Kanca' },
      caption: 'Caption',
      hashtags: ['#burç'],
      signReadingIds: saved.map((row) => row.id),
    };
    const first = await createPostVersion(db, input);
    const second = await createPostVersion(db, { ...input, caption: 'Yeni caption' });
    expect(first.version).toBe(1);
    expect(second).toMatchObject({ version: 2, isCurrent: true, status: 'taslak', caption: 'Yeni caption' });
    const current = await getCurrentPost(db, KEY);
    expect(current?.post.id).toBe(second.id);
    expect(current?.slides.map((slide) => slide.type)).toEqual(['cover', ...Array(12).fill('sign'), 'cta']);
    expect(current?.slides[1].readingId).toBe(saved[0].id);
    expect((await getCurrentPostsForDate(db, KEY.date)).map((post) => post.id)).toEqual([second.id]);
  });

  it('12 burç kimliği olmadan gönderi oluşturmaz', async () => {
    await expect(
      createPostVersion(db, { ...KEY, templateVersion: 'pastel@1', format: '4x5', cover: { hook: 'x' }, caption: 'x', hashtags: [], signReadingIds: [] }),
    ).rejects.toThrow('12 burç');
  });
});
```

`src/lib/content/runs.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { generationRuns } from '@/db/schema';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import type { AttemptLog } from '@/lib/llm/router';
import { finishRun, getProviderUsage, getUsageSummary, logLlmCall, startRun } from './runs';

const KEY = { date: '2026-09-26', kind: 'horoscope' as const, audience: 'kadin' as const, trigger: 'button' as const };
const T0 = new Date('2026-09-26T07:00:00Z');
const minutes = (value: number) => new Date(T0.getTime() + value * 60_000);

function log(status: AttemptLog['status'], providerId: AttemptLog['providerId'] = 'gemini'): AttemptLog {
  return { providerId, model: 'm', status, httpStatus: status === 'rate_limited' ? 429 : null, error: null, inputTokens: 1, outputTokens: 2, latencyMs: 10 };
}

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('üretim kilidi', () => {
  it('aynı anahtarda ikinci üretim başlatılamaz, bitince başlatılabilir', async () => {
    const first = await startRun(db, KEY, T0);
    expect(first).not.toBeNull();
    expect(await startRun(db, { ...KEY, trigger: 'cron' }, minutes(1))).toBeNull();
    expect(await startRun(db, { ...KEY, audience: 'erkek' }, minutes(1))).not.toBeNull();
    await finishRun(db, first!.id, { status: 'succeeded' }, minutes(2));
    expect(await startRun(db, KEY, minutes(3))).not.toBeNull();
  });

  it('10 dakikadan eski yarım kalmış üretim kilidi bırakır ve başarısız sayılır', async () => {
    const stale = await startRun(db, KEY, T0);
    expect(await startRun(db, KEY, minutes(11))).not.toBeNull();
    const rows = await db.select().from(generationRuns);
    expect(rows.find((row) => row.id === stale!.id)).toMatchObject({ status: 'failed', error: 'Zaman aşımı: çalışma yarıda kaldı.' });
  });
});

describe('sağlayıcı kullanımı', () => {
  it('bugünün gerçek çağrılarını sayar, atlananları ve dünü saymaz, son 429 zamanını döner', async () => {
    await logLlmCall(db, null, log('ok'), new Date('2026-09-25T20:00:00Z'));
    await logLlmCall(db, null, log('ok'), minutes(0));
    await logLlmCall(db, null, log('rate_limited'), minutes(5));
    await logLlmCall(db, null, log('skipped_cooldown'), minutes(6));
    await logLlmCall(db, null, log('ok', 'gateway'), minutes(7));
    expect(await getProviderUsage(db, 'gemini', minutes(10))).toEqual({ callsToday: 2, lastRateLimitedAt: minutes(5) });
  });

  it('son günlerin kullanımını gün ve sağlayıcı bazında özetler', async () => {
    await logLlmCall(db, null, log('ok'), minutes(0));
    await logLlmCall(db, null, log('server_error'), minutes(1));
    await logLlmCall(db, null, log('skipped_cap'), minutes(2));
    await logLlmCall(db, null, log('ok', 'gateway'), new Date('2026-09-25T10:00:00Z'));
    expect(await getUsageSummary(db, 7, minutes(10))).toEqual([
      { date: '2026-09-26', provider: 'gemini', ok: 1, failed: 1 },
      { date: '2026-09-25', provider: 'gateway', ok: 1, failed: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `npx vitest run src/lib/content/repository.test.ts src/lib/content/runs.test.ts`
Expected: FAIL — modüller bulunamaz.

- [ ] **Step 3: Şemayı genişlet**

`src/db/schema.ts` dosyasının başındaki import satırlarını şununla değiştir:
```ts
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { LuckyColorId } from '../lib/content/lucky-colors';
import { READING_AUDIENCES, READING_KINDS, RUN_TRIGGERS } from '../lib/content/types';
import type { SignSlug } from '../lib/zodiac/signs';
```
Dosyanın sonuna ekle:
```ts
export type ReadingMeta = { scores: { love: number; money: number; health: number }; luckyColor: LuckyColorId; luckyNumber: number };
export type PostCover = { hook: string };
export type PostFormat = '4x5' | '3x4';

export const readingKindEnum = pgEnum('reading_kind', READING_KINDS);
export const audienceEnum = pgEnum('audience', READING_AUDIENCES);
export const postStatusEnum = pgEnum('post_status', ['taslak', 'hazir', 'indirildi', 'paylasildi']);
export const slideTypeEnum = pgEnum('slide_type', ['cover', 'sign', 'cta']);
export const runStatusEnum = pgEnum('run_status', ['running', 'succeeded', 'failed']);
export const runTriggerEnum = pgEnum('run_trigger', RUN_TRIGGERS);

export const generationRuns = pgTable(
  'generation_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date', { mode: 'string' }).notNull(),
    kind: readingKindEnum('kind').notNull(),
    audience: audienceEnum('audience').notNull(),
    sign: text('sign').$type<SignSlug>(),
    trigger: runTriggerEnum('trigger').notNull(),
    status: runStatusEnum('status').notNull().default('running'),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('generation_runs_running_uq').on(t.date, t.kind, t.audience).where(sql`${t.status} = 'running'`)],
);

export const llmCalls = pgTable(
  'llm_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id').references(() => generationRuns.id),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    status: text('status').notNull(),
    httpStatus: integer('http_status'),
    error: text('error'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    latencyMs: integer('latency_ms').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('llm_calls_provider_created_idx').on(t.provider, t.createdAt)],
);

export const readings = pgTable(
  'readings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date', { mode: 'string' }).notNull(),
    kind: readingKindEnum('kind').notNull(),
    audience: audienceEnum('audience').notNull(),
    sign: text('sign').$type<SignSlug>().notNull(),
    version: integer('version').notNull(),
    isCurrent: boolean('is_current').notNull().default(true),
    headline: text('headline').notNull(),
    body: text('body').notNull(),
    short: text('short').notNull(),
    meta: jsonb('meta').$type<ReadingMeta>().notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    runId: uuid('run_id').references(() => generationRuns.id),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('readings_current_uq').on(t.date, t.kind, t.audience, t.sign).where(sql`${t.isCurrent}`),
    uniqueIndex('readings_version_uq').on(t.date, t.kind, t.audience, t.sign, t.version),
  ],
);

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date', { mode: 'string' }).notNull(),
    kind: readingKindEnum('kind').notNull(),
    audience: audienceEnum('audience').notNull(),
    version: integer('version').notNull(),
    isCurrent: boolean('is_current').notNull().default(true),
    status: postStatusEnum('status').notNull().default('taslak'),
    templateVersion: text('template_version').notNull(),
    format: text('format').$type<PostFormat>().notNull().default('4x5'),
    cover: jsonb('cover').$type<PostCover>().notNull(),
    caption: text('caption').notNull(),
    hashtags: text('hashtags').array().notNull(),
    downloadedAt: timestamp('downloaded_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('posts_current_uq').on(t.date, t.kind, t.audience).where(sql`${t.isCurrent}`),
    uniqueIndex('posts_version_uq').on(t.date, t.kind, t.audience, t.version),
  ],
);

export const postSlides = pgTable(
  'post_slides',
  {
    postId: uuid('post_id').notNull().references(() => posts.id),
    position: integer('position').notNull(),
    type: slideTypeEnum('type').notNull(),
    readingId: uuid('reading_id').references(() => readings.id),
  },
  (t) => [primaryKey({ columns: [t.postId, t.position] })],
);
```

Run: `npx drizzle-kit generate --name content`
Expected: `src/db/migrations/0001_content.sql` dosyasında 6 enum, 5 tablo ve `WHERE "readings"."is_current"`, `WHERE "posts"."is_current"`, `WHERE "generation_runs"."status" = 'running'` koşullu index'leri bulunur.

- [ ] **Step 4: Hata yardımcısı ve depoları yaz**

`src/db/errors.ts`:
```ts
function codeOf(value: unknown): unknown {
  return typeof value === 'object' && value !== null && 'code' in value ? (value as { code: unknown }).code : undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  const cause = typeof error === 'object' && error !== null && 'cause' in error ? (error as { cause: unknown }).cause : undefined;
  return codeOf(error) === '23505' || codeOf(cause) === '23505';
}
```

`src/lib/content/repository.ts`:
```ts
import { and, asc, eq, gte, lt, max } from 'drizzle-orm';
import { postSlides, posts, readings, type PostCover, type PostFormat, type ReadingMeta } from '@/db/schema';
import type { Db } from '@/db/types';
import { addDays, type DateKey } from '@/lib/date/istanbul';
import { SIGN_SLUGS, type SignSlug } from '@/lib/zodiac/signs';
import type { ReadingAudience, ReadingKind, RecentHeadline } from './types';

export type ReadingKey = { date: DateKey; kind: ReadingKind; audience: ReadingAudience };
export type NewReading = {
  sign: SignSlug;
  headline: string;
  body: string;
  short: string;
  meta: ReadingMeta;
  provider: string;
  model: string;
  promptVersion: string;
  runId: string | null;
};
export type ReadingRow = typeof readings.$inferSelect;
export type PostRow = typeof posts.$inferSelect;
export type SlideRow = typeof postSlides.$inferSelect;
export type NewPost = ReadingKey & {
  templateVersion: string;
  format: PostFormat;
  cover: PostCover;
  caption: string;
  hashtags: string[];
  signReadingIds: readonly string[];
};

function readingWhere(key: ReadingKey, sign: SignSlug) {
  return and(eq(readings.date, key.date), eq(readings.kind, key.kind), eq(readings.audience, key.audience), eq(readings.sign, sign));
}

function postWhere(key: ReadingKey) {
  return and(eq(posts.date, key.date), eq(posts.kind, key.kind), eq(posts.audience, key.audience));
}

export async function saveReadings(db: Db, key: ReadingKey, items: readonly NewReading[]): Promise<ReadingRow[]> {
  return db.transaction(async (tx) => {
    const saved: ReadingRow[] = [];
    for (const item of items) {
      const where = readingWhere(key, item.sign);
      const [{ latest }] = await tx.select({ latest: max(readings.version) }).from(readings).where(where);
      await tx.update(readings).set({ isCurrent: false }).where(and(where, eq(readings.isCurrent, true)));
      const [row] = await tx
        .insert(readings)
        .values({ ...key, ...item, version: (latest ?? 0) + 1, isCurrent: true })
        .returning();
      saved.push(row);
    }
    return saved;
  });
}

export async function getCurrentReadings(db: Db, key: ReadingKey): Promise<ReadingRow[]> {
  const rows = await db
    .select()
    .from(readings)
    .where(and(eq(readings.date, key.date), eq(readings.kind, key.kind), eq(readings.audience, key.audience), eq(readings.isCurrent, true)));
  return rows.sort((a, b) => SIGN_SLUGS.indexOf(a.sign) - SIGN_SLUGS.indexOf(b.sign));
}

export async function getRecentHeadlines(
  db: Db,
  key: Omit<ReadingKey, 'date'>,
  beforeDate: DateKey,
  days: number,
): Promise<RecentHeadline[]> {
  return db
    .select({ date: readings.date, sign: readings.sign, headline: readings.headline, short: readings.short })
    .from(readings)
    .where(
      and(
        eq(readings.kind, key.kind),
        eq(readings.audience, key.audience),
        eq(readings.isCurrent, true),
        gte(readings.date, addDays(beforeDate, -days)),
        lt(readings.date, beforeDate),
      ),
    )
    .orderBy(asc(readings.date), asc(readings.sign));
}

export async function createPostVersion(db: Db, input: NewPost): Promise<PostRow> {
  if (input.signReadingIds.length !== SIGN_SLUGS.length) throw new Error('Gönderi için 12 burç yorumu gerekir');
  return db.transaction(async (tx) => {
    const [{ latest }] = await tx.select({ latest: max(posts.version) }).from(posts).where(postWhere(input));
    await tx.update(posts).set({ isCurrent: false }).where(and(postWhere(input), eq(posts.isCurrent, true)));
    const [post] = await tx
      .insert(posts)
      .values({
        date: input.date,
        kind: input.kind,
        audience: input.audience,
        version: (latest ?? 0) + 1,
        isCurrent: true,
        templateVersion: input.templateVersion,
        format: input.format,
        cover: input.cover,
        caption: input.caption,
        hashtags: input.hashtags,
      })
      .returning();
    await tx.insert(postSlides).values([
      { postId: post.id, position: 0, type: 'cover', readingId: null },
      ...input.signReadingIds.map((readingId, index) => ({ postId: post.id, position: index + 1, type: 'sign' as const, readingId })),
      { postId: post.id, position: input.signReadingIds.length + 1, type: 'cta', readingId: null },
    ]);
    return post;
  });
}

export async function getCurrentPost(db: Db, key: ReadingKey): Promise<{ post: PostRow; slides: SlideRow[] } | null> {
  const [post] = await db.select().from(posts).where(and(postWhere(key), eq(posts.isCurrent, true)));
  if (!post) return null;
  const slides = await db.select().from(postSlides).where(eq(postSlides.postId, post.id)).orderBy(asc(postSlides.position));
  return { post, slides };
}

export async function getCurrentPostsForDate(db: Db, date: DateKey): Promise<PostRow[]> {
  return db.select().from(posts).where(and(eq(posts.date, date), eq(posts.isCurrent, true)));
}
```

`src/lib/content/runs.ts`:
```ts
import { and, count, desc, eq, gte, lt, notLike } from 'drizzle-orm';
import { generationRuns, llmCalls } from '@/db/schema';
import { isUniqueViolation } from '@/db/errors';
import type { Db } from '@/db/types';
import { addDays, istanbulDateKey, istanbulDayStart, type DateKey } from '@/lib/date/istanbul';
import type { ProviderId } from '@/lib/llm/provider-ids';
import type { AttemptLog, ProviderUsage } from '@/lib/llm/router';
import type { SignSlug } from '@/lib/zodiac/signs';
import type { ReadingKey } from './repository';
import type { RunTrigger } from './types';

export const STALE_RUN_MS = 10 * 60 * 1000;
export type UsageRow = { date: DateKey; provider: string; ok: number; failed: number };

export async function startRun(
  db: Db,
  key: ReadingKey & { sign?: SignSlug; trigger: RunTrigger },
  now: Date = new Date(),
): Promise<{ id: string } | null> {
  await db
    .update(generationRuns)
    .set({ status: 'failed', error: 'Zaman aşımı: çalışma yarıda kaldı.', finishedAt: now })
    .where(and(eq(generationRuns.status, 'running'), lt(generationRuns.startedAt, new Date(now.getTime() - STALE_RUN_MS))));
  try {
    const [row] = await db
      .insert(generationRuns)
      .values({ date: key.date, kind: key.kind, audience: key.audience, sign: key.sign ?? null, trigger: key.trigger, status: 'running', startedAt: now })
      .returning({ id: generationRuns.id });
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

export async function finishRun(
  db: Db,
  id: string,
  result: { status: 'succeeded' } | { status: 'failed'; error: string },
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(generationRuns)
    .set({ status: result.status, error: result.status === 'failed' ? result.error : null, finishedAt: now })
    .where(eq(generationRuns.id, id));
}

export async function logLlmCall(db: Db, runId: string | null, log: AttemptLog, now: Date = new Date()): Promise<void> {
  await db.insert(llmCalls).values({
    runId,
    provider: log.providerId,
    model: log.model,
    status: log.status,
    httpStatus: log.httpStatus,
    error: log.error,
    inputTokens: log.inputTokens,
    outputTokens: log.outputTokens,
    latencyMs: log.latencyMs,
    createdAt: now,
  });
}

export async function getProviderUsage(db: Db, providerId: ProviderId, now: Date = new Date()): Promise<ProviderUsage> {
  const since = istanbulDayStart(istanbulDateKey(now));
  const [{ calls }] = await db
    .select({ calls: count() })
    .from(llmCalls)
    .where(and(eq(llmCalls.provider, providerId), gte(llmCalls.createdAt, since), notLike(llmCalls.status, 'skipped%')));
  const [last] = await db
    .select({ at: llmCalls.createdAt })
    .from(llmCalls)
    .where(and(eq(llmCalls.provider, providerId), eq(llmCalls.status, 'rate_limited')))
    .orderBy(desc(llmCalls.createdAt))
    .limit(1);
  return { callsToday: calls, lastRateLimitedAt: last?.at ?? null };
}

export async function getUsageSummary(db: Db, days: number, now: Date = new Date()): Promise<UsageRow[]> {
  const since = istanbulDayStart(addDays(istanbulDateKey(now), -(days - 1)));
  const rows = await db
    .select({ provider: llmCalls.provider, status: llmCalls.status, createdAt: llmCalls.createdAt })
    .from(llmCalls)
    .where(gte(llmCalls.createdAt, since));
  const summary = new Map<string, UsageRow>();
  for (const row of rows) {
    if (row.status.startsWith('skipped')) continue;
    const date = istanbulDateKey(row.createdAt);
    const key = `${date}|${row.provider}`;
    const entry = summary.get(key) ?? { date, provider: row.provider, ok: 0, failed: 0 };
    if (row.status === 'ok') entry.ok++;
    else entry.failed++;
    summary.set(key, entry);
  }
  return [...summary.values()].sort((a, b) => b.date.localeCompare(a.date) || a.provider.localeCompare(b.provider));
}
```

- [ ] **Step 5: Testlerin geçtiğini gör**

Run: `npm test && npm run typecheck`
Expected: tüm testler PASS (Faz 0 testleri dahil).

- [ ] **Step 6: Commit**

```bash
git add src/db src/lib/content/repository.ts src/lib/content/repository.test.ts src/lib/content/runs.ts src/lib/content/runs.test.ts
git commit -m "feat: sürümlü okuma ve gönderi tabloları, üretim kilidi ve LLM kullanım kaydı" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Üretim ayarları (günlük plan, cron, hashtag, sağlayıcı sırası)

**Files:**
- Modify: `src/lib/settings/schema.ts`, `src/lib/settings/schema.test.ts`, `src/lib/settings/repository.test.ts`
- Test: `src/lib/settings/schema.test.ts` (yeni testler)

**Interfaces:**
- Consumes: `PROVIDER_IDS` (Task 6, `provider-ids.ts` — AI SDK içermez, istemci güvenli)
- Produces (Faz 0 şemasına eklenenler):
```ts
export type PlanItem = { kind: 'horoscope'; audience: 'kadin' | 'erkek' };
export const planItemSchema; export const providerPreferenceSchema;
// Settings'e eklenen alanlar:
//   cronEnabled: boolean                       (varsayılan true)
//   dailyPlan: PlanItem[] (en az 1)            (varsayılan [kadın, erkek])
//   baseHashtags: string[] (en fazla 2, '#…')  (varsayılan ['#burç', '#astroloji'])
//   providerChain: ProviderPreference[]        (varsayılan [])
//   spreadLoad: boolean                        (varsayılan false)
// SettingsPatch aynı alanları opsiyonel alır.
```

- [ ] **Step 1: Başarısız testleri yaz ve eski beklentileri güncelle**

`src/lib/settings/schema.test.ts` içindeki `'kayıt yoksa varsayılanlar gelir'` testini şununla değiştir:
```ts
  it('kayıt yoksa varsayılanlar gelir', () => {
    expect(parseStoredSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({
      instagramHandle: null,
      watermark: { enabled: true, position: 'bottom-center', opacity: 0.55 },
      cronEnabled: true,
      dailyPlan: [
        { kind: 'horoscope', audience: 'kadin' },
        { kind: 'horoscope', audience: 'erkek' },
      ],
      baseHashtags: ['#burç', '#astroloji'],
      providerChain: [],
      spreadLoad: false,
    });
  });
```
Aynı dosyanın sonuna ekle:
```ts
describe('üretim ayarları', () => {
  it('Faz 0 kaydı yeni alanların varsayılanlarıyla okunur', () => {
    expect(parseStoredSettings({ instagramHandle: 'burc.studio' }).dailyPlan).toHaveLength(2);
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
});
```
`src/lib/settings/repository.test.ts` içindeki `'kaydedilen ayarlar geri okunur…'` testinin beklentisini şununla değiştir:
```ts
    expect(await getSettings(db)).toEqual({
      ...DEFAULT_SETTINGS,
      instagramHandle: 'burc.studio',
      watermark: { enabled: true, position: 'bottom-center', opacity: 0.8 },
    });
```

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `npx vitest run src/lib/settings`
Expected: FAIL — yeni alanlar `DEFAULT_SETTINGS` içinde yok.

- [ ] **Step 3: Şemayı genişlet**

`src/lib/settings/schema.ts` içinde:
1. En üste `import { PROVIDER_IDS } from '@/lib/llm/provider-ids';` ekle.
2. `settingsSchema` tanımından önce şunları ekle:
```ts
export const planItemSchema = z.object({ kind: z.literal('horoscope'), audience: z.enum(['kadin', 'erkek']) });
export type PlanItem = z.infer<typeof planItemSchema>;

export const providerPreferenceSchema = z.object({
  id: z.enum(PROVIDER_IDS),
  enabled: z.boolean(),
  dailyCap: z.number().int().positive().optional(),
  model: z.string().min(1).optional(),
});
```
3. `settingsSchema` nesnesine `watermark`'tan sonra şu alanları ekle:
```ts
  cronEnabled: z.boolean(),
  dailyPlan: z.array(planItemSchema).min(1),
  baseHashtags: z.array(z.string().regex(/^#[\p{L}\p{N}_]+$/u)).max(2),
  providerChain: z.array(providerPreferenceSchema),
  spreadLoad: z.boolean(),
```
4. `SettingsPatch` tipine ekle:
```ts
  cronEnabled?: boolean;
  dailyPlan?: PlanItem[];
  baseHashtags?: string[];
  providerChain?: Settings['providerChain'];
  spreadLoad?: boolean;
```
5. `DEFAULT_SETTINGS` nesnesine ekle:
```ts
  cronEnabled: true,
  dailyPlan: [
    { kind: 'horoscope', audience: 'kadin' },
    { kind: 'horoscope', audience: 'erkek' },
  ],
  baseHashtags: ['#burç', '#astroloji'],
  providerChain: [],
  spreadLoad: false,
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings
git commit -m "feat: günlük plan, cron, temel hashtag ve sağlayıcı sırası ayarları" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Üretim servisi ve günlük paket

**Files:**
- Create: `src/lib/content/horoscope-service.ts`, `src/lib/content/daily-package.ts`
- Test: `src/lib/content/horoscope-service.test.ts`, `src/lib/content/daily-package.test.ts`

**Interfaces:**
- Consumes: Task 2 (`getSkySnapshot`), Task 4 (şemalar, `checkHoroscopeBatch`, `checkSingleSign`, `batchIssues`, `HoroscopeEntry`), Task 5 (prompt'lar, `HOROSCOPE_PROMPT_VERSION`), Task 6 (`ProviderSpec`, `ProviderId`), Task 7 (`generateWithFailover`, `RouterDeps`, `AllProvidersFailedError`), Task 8 (depo ve çalışma fonksiyonları), Task 9 (`PlanItem`)
- Produces:
```ts
// src/lib/content/horoscope-service.ts
export const TEMPLATE_VERSION = 'pastel@1';
export type GenerationDeps = { db: Db; chain: readonly ProviderSpec[]; baseHashtags: readonly string[]; spreadLoad?: boolean; now?: () => Date; timeoutMs?: number };
export type SetResult = { status: 'created'; postId: string; providers: ProviderId[] } | { status: 'skipped' } | { status: 'busy' };
export function rotateChain<T>(chain: readonly T[], offset: number): T[];
export async function generateHoroscopeSet(deps: GenerationDeps, input: { date: DateKey; audience: Audience; trigger: RunTrigger; skipIfExists: boolean }): Promise<SetResult>;
export async function regenerateSign(deps: GenerationDeps, input: { date: DateKey; audience: Audience; sign: SignSlug }): Promise<SetResult | { status: 'missing' }>;
// src/lib/content/daily-package.ts
export type PackageItemResult = { item: PlanItem; result: SetResult } | { item: PlanItem; error: string };
export function describeGenerationError(error: unknown): string;
export async function generateDailyPackage(deps: GenerationDeps, input: { date: DateKey; items: readonly PlanItem[]; trigger: RunTrigger; skipIfExists: boolean }): Promise<PackageItemResult[]>;
```

- [ ] **Step 1: Başarısız testleri yaz**

`src/lib/content/horoscope-service.test.ts`:
```ts
import { APICallError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { generationRuns, llmCalls, readings } from '@/db/schema';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { mockHoroscopeBatch, mockHoroscopeEntry } from '@/lib/llm/mock-content';
import { createMockModel } from '@/lib/llm/mock-model';
import type { ProviderSpec } from '@/lib/llm/providers';
import { AllProvidersFailedError } from '@/lib/llm/router';
import { getCurrentPost, getCurrentReadings } from './repository';
import { startRun } from './runs';
import { generateHoroscopeSet, regenerateSign, rotateChain } from './horoscope-service';

const DATE = '2026-09-26';
const KEY = { date: DATE, kind: 'horoscope' as const, audience: 'kadin' as const };
const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

function spec(model: MockLanguageModelV4, id: ProviderSpec['id'] = 'mock'): ProviderSpec {
  return { id, label: id, model: 'mock', dailyCap: 1000, factory: () => model };
}

function scripted(respond: (prompt: string) => unknown) {
  return new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => ({
      content: [{ type: 'text', text: JSON.stringify(respond(JSON.stringify(prompt))) }],
      finishReason: { unified: 'stop', raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const deps = (chain: ProviderSpec[]) => ({ db, chain, baseHashtags: ['#burç', '#astroloji'], timeoutMs: 1000 });

describe('generateHoroscopeSet', () => {
  it('12 yorumu ve 14 slaytlık gönderiyi tek çalışmada üretir', async () => {
    const result = await generateHoroscopeSet(deps([spec(createMockModel())]), { date: DATE, audience: 'kadin', trigger: 'button', skipIfExists: false });
    expect(result).toMatchObject({ status: 'created', providers: ['mock'] });
    const current = await getCurrentReadings(db, KEY);
    expect(current).toHaveLength(12);
    expect(current[0]).toMatchObject({ sign: 'koc', provider: 'mock', promptVersion: 'burc-v1', meta: { luckyColor: 'lila', luckyNumber: 7 } });
    const post = await getCurrentPost(db, KEY);
    expect(post?.post).toMatchObject({ templateVersion: 'pastel@1', format: '4x5', hashtags: ['#burç', '#astroloji', '#günlükburç', '#yıldızlar'] });
    expect(post?.slides).toHaveLength(14);
    expect((await db.select().from(generationRuns))[0]).toMatchObject({ status: 'succeeded', trigger: 'button' });
    expect(await db.select().from(llmCalls)).toHaveLength(1);
  });

  it('geçersiz tek burcu ayrıca yeniden ister', async () => {
    const model = scripted((prompt) => {
      if (prompt.includes('Yalnızca şu burç için yaz')) return { burc: mockHoroscopeEntry('koc') };
      const batch = mockHoroscopeBatch();
      batch.burclar[0] = { ...batch.burclar[0], yorum: 'Kısa.' };
      return batch;
    });
    const result = await generateHoroscopeSet(deps([spec(model)]), { date: DATE, audience: 'kadin', trigger: 'button', skipIfExists: false });
    expect(result.status).toBe('created');
    expect((await getCurrentReadings(db, KEY))[0].body).toBe(mockHoroscopeEntry('koc').yorum);
    expect(await db.select().from(llmCalls)).toHaveLength(2);
  });

  it('içerik varsa ve skipIfExists açıksa atlar', async () => {
    await generateHoroscopeSet(deps([spec(createMockModel())]), { date: DATE, audience: 'kadin', trigger: 'cron', skipIfExists: true });
    expect(await generateHoroscopeSet(deps([spec(createMockModel())]), { date: DATE, audience: 'kadin', trigger: 'cron', skipIfExists: true })).toEqual({ status: 'skipped' });
  });

  it('yük dağıtımı açıkken erkek seti ikinci sağlayıcıdan başlar', async () => {
    const chain = [spec(createMockModel(), 'gateway'), spec(createMockModel(), 'gemini')];
    const spread = { ...deps(chain), spreadLoad: true };
    expect(await generateHoroscopeSet(spread, { date: DATE, audience: 'kadin', trigger: 'button', skipIfExists: false })).toMatchObject({ providers: ['gateway'] });
    expect(await generateHoroscopeSet(spread, { date: DATE, audience: 'erkek', trigger: 'button', skipIfExists: false })).toMatchObject({ providers: ['gemini'] });
  });

  it('aynı anahtarda üretim sürerken busy döner', async () => {
    await startRun(db, { ...KEY, trigger: 'cron' });
    expect(await generateHoroscopeSet(deps([spec(createMockModel())]), { date: DATE, audience: 'kadin', trigger: 'button', skipIfExists: false })).toEqual({ status: 'busy' });
  });

  it('zincir tükenirse hiçbir yorum kaydetmez ve çalışmayı failed işaretler', async () => {
    const failing = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new APICallError({ message: 'HTTP 500', url: 'x', requestBodyValues: {}, statusCode: 500, isRetryable: true });
      },
    });
    await expect(
      generateHoroscopeSet(deps([spec(failing)]), { date: DATE, audience: 'kadin', trigger: 'button', skipIfExists: false }),
    ).rejects.toBeInstanceOf(AllProvidersFailedError);
    expect(await db.select().from(readings)).toHaveLength(0);
    expect((await db.select().from(generationRuns))[0]).toMatchObject({ status: 'failed' });
  });
});

describe('rotateChain', () => {
  it('zinciri verilen adım kadar döndürür', () => {
    expect(rotateChain(['a', 'b', 'c'], 1)).toEqual(['b', 'c', 'a']);
    expect(rotateChain(['a', 'b'], 3)).toEqual(['b', 'a']);
    expect(rotateChain([], 1)).toEqual([]);
  });
});

describe('regenerateSign', () => {
  it('tek burcun yeni sürümünü ve yeni gönderi sürümünü oluşturur, eskisi arşivde kalır', async () => {
    await generateHoroscopeSet(deps([spec(createMockModel())]), { date: DATE, audience: 'kadin', trigger: 'button', skipIfExists: false });
    const before = await getCurrentPost(db, KEY);
    const result = await regenerateSign(deps([spec(createMockModel())]), { date: DATE, audience: 'kadin', sign: 'aslan' });
    expect(result.status).toBe('created');
    const current = await getCurrentReadings(db, KEY);
    expect(current.find((row) => row.sign === 'aslan')?.version).toBe(2);
    expect(current.find((row) => row.sign === 'koc')?.version).toBe(1);
    const after = await getCurrentPost(db, KEY);
    expect(after?.post.version).toBe(2);
    expect(after?.slides[5].readingId).toBe(current.find((row) => row.sign === 'aslan')?.id);
    expect(after?.slides[5].readingId).not.toBe(before?.slides[5].readingId);
    expect(after?.post.caption).toBe(before?.post.caption);
  });

  it('o günün yorumları yoksa missing döner', async () => {
    expect(await regenerateSign(deps([spec(createMockModel())]), { date: DATE, audience: 'kadin', sign: 'aslan' })).toEqual({ status: 'missing' });
  });
});
```

`src/lib/content/daily-package.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { createMockModel } from '@/lib/llm/mock-model';
import { AllProvidersFailedError } from '@/lib/llm/router';
import { startRun } from './runs';
import { describeGenerationError, generateDailyPackage } from './daily-package';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('generateDailyPackage', () => {
  it('plandaki her gönderiyi bağımsız üretir; biri meşgulse diğeri yine üretilir', async () => {
    await startRun(db, { date: '2026-09-26', kind: 'horoscope', audience: 'erkek', trigger: 'button' });
    const results = await generateDailyPackage(
      { db, chain: [{ id: 'mock', label: 'mock', model: 'mock', dailyCap: 1000, factory: () => createMockModel() }], baseHashtags: [] },
      {
        date: '2026-09-26',
        items: [
          { kind: 'horoscope', audience: 'kadin' },
          { kind: 'horoscope', audience: 'erkek' },
        ],
        trigger: 'cron',
        skipIfExists: true,
      },
    );
    expect(results.map((entry) => ('result' in entry ? entry.result.status : 'error'))).toEqual(['created', 'busy']);
  });
});

describe('describeGenerationError', () => {
  it('sağlayıcı denemelerini okunur özetler', () => {
    const error = new AllProvidersFailedError([
      { providerId: 'gateway', model: 'm', status: 'rate_limited', httpStatus: 429, error: 'limit', inputTokens: null, outputTokens: null, latencyMs: 1 },
    ]);
    expect(describeGenerationError(error)).toBe('Tüm sağlayıcılar başarısız oldu (1 deneme). gateway: rate_limited');
  });
});
```

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `npx vitest run src/lib/content/horoscope-service.test.ts src/lib/content/daily-package.test.ts`
Expected: FAIL — modüller bulunamaz.

- [ ] **Step 3: Servisi yaz**

`src/lib/content/horoscope-service.ts`:
```ts
import type { Db } from '@/db/types';
import { getSkySnapshot } from '@/lib/astro/sky';
import type { DateKey } from '@/lib/date/istanbul';
import type { ProviderId } from '@/lib/llm/provider-ids';
import type { ProviderSpec } from '@/lib/llm/providers';
import { generateWithFailover, type RouterDeps } from '@/lib/llm/router';
import { SIGN_SLUGS, getSign, type SignSlug } from '@/lib/zodiac/signs';
import { horoscopeBatchSchema, horoscopeSingleSchema } from './horoscope-schema';
import { HOROSCOPE_PROMPT_VERSION, buildHoroscopeBatchPrompt, buildHoroscopeSignPrompt, type HoroscopePromptInput } from './horoscope-prompt';
import { batchIssues, checkHoroscopeBatch, checkSingleSign, type HoroscopeEntry, type QualityIssue } from './quality';
import { createPostVersion, getCurrentPost, getRecentHeadlines, saveReadings, type NewReading } from './repository';
import { finishRun, getProviderUsage, logLlmCall, startRun } from './runs';
import { AUDIENCES, type Audience, type RunTrigger } from './types';

export const TEMPLATE_VERSION = 'pastel@1';

export type GenerationDeps = {
  db: Db;
  chain: readonly ProviderSpec[];
  baseHashtags: readonly string[];
  spreadLoad?: boolean;
  now?: () => Date;
  timeoutMs?: number;
};

export type SetResult = { status: 'created'; postId: string; providers: ProviderId[] } | { status: 'skipped' } | { status: 'busy' };

type Source = { providerId: ProviderId; model: string };

function clock(deps: GenerationDeps): () => Date {
  return deps.now ?? (() => new Date());
}

export function rotateChain<T>(chain: readonly T[], offset: number): T[] {
  if (chain.length === 0) return [];
  const start = offset % chain.length;
  return [...chain.slice(start), ...chain.slice(0, start)];
}

function routerFor(deps: GenerationDeps, runId: string, chain: readonly ProviderSpec[] = deps.chain): RouterDeps {
  const now = clock(deps);
  return {
    chain,
    usage: (id) => getProviderUsage(deps.db, id, now()),
    onAttempt: (log) => logLlmCall(deps.db, runId, log, now()),
    now,
    timeoutMs: deps.timeoutMs,
  };
}

function toNewReading(entry: HoroscopeEntry, source: Source, runId: string): NewReading {
  return {
    sign: entry.sign,
    headline: entry.headline,
    body: entry.body,
    short: entry.short,
    meta: { scores: entry.scores, luckyColor: entry.luckyColor, luckyNumber: entry.luckyNumber },
    provider: source.providerId,
    model: source.model,
    promptVersion: HOROSCOPE_PROMPT_VERSION,
    runId,
  };
}

async function generateSign(router: RouterDeps, promptInput: HoroscopePromptInput, sign: SignSlug, issues: QualityIssue[]) {
  const result = await generateWithFailover(router, {
    schema: horoscopeSingleSchema,
    ...buildHoroscopeSignPrompt({ ...promptInput, sign, issues }),
    validate: (value) => checkSingleSign(value, sign).issues,
  });
  const { entry } = checkSingleSign(result.value, sign);
  if (!entry) throw new Error(`${getSign(sign).name} için kabul edilen yanıt doğrulanamadı`);
  return { entry, source: { providerId: result.providerId, model: result.model } };
}

async function withRun<T>(deps: GenerationDeps, runId: string, work: () => Promise<T>): Promise<T> {
  const now = clock(deps);
  try {
    const value = await work();
    await finishRun(deps.db, runId, { status: 'succeeded' }, now());
    return value;
  } catch (error) {
    await finishRun(deps.db, runId, { status: 'failed', error: error instanceof Error ? error.message : String(error) }, now());
    throw error;
  }
}

export async function generateHoroscopeSet(
  deps: GenerationDeps,
  input: { date: DateKey; audience: Audience; trigger: RunTrigger; skipIfExists: boolean },
): Promise<SetResult> {
  const key = { date: input.date, kind: 'horoscope' as const, audience: input.audience };
  if (input.skipIfExists && (await getCurrentPost(deps.db, key))) return { status: 'skipped' };
  const run = await startRun(deps.db, { ...key, trigger: input.trigger }, clock(deps)());
  if (!run) return { status: 'busy' };

  return withRun(deps, run.id, async () => {
    const chain = deps.spreadLoad ? rotateChain(deps.chain, AUDIENCES.indexOf(input.audience)) : deps.chain;
    const router = routerFor(deps, run.id, chain);
    const promptInput: HoroscopePromptInput = {
      dateKey: input.date,
      audience: input.audience,
      sky: getSkySnapshot(input.date),
      recent: await getRecentHeadlines(deps.db, key, input.date, 2),
    };
    const batch = await generateWithFailover(router, {
      schema: horoscopeBatchSchema,
      ...buildHoroscopeBatchPrompt(promptInput),
      validate: (value) => batchIssues(checkHoroscopeBatch(value, deps.baseHashtags)),
    });
    const check = checkHoroscopeBatch(batch.value, deps.baseHashtags);
    const post = check.post;
    if (!post) throw new Error('Kabul edilen yanıtta gönderi alanları eksik');

    const sources = new Map<SignSlug, Source>();
    for (const sign of check.entries.keys()) sources.set(sign, { providerId: batch.providerId, model: batch.model });
    for (const failed of check.failedSigns) {
      const { entry, source } = await generateSign(router, promptInput, failed.sign, failed.issues);
      check.entries.set(failed.sign, entry);
      sources.set(failed.sign, source);
    }

    const created = await deps.db.transaction(async (tx) => {
      const rows = await saveReadings(
        tx,
        key,
        SIGN_SLUGS.map((sign) => toNewReading(check.entries.get(sign) as HoroscopeEntry, sources.get(sign) as Source, run.id)),
      );
      return createPostVersion(tx, {
        ...key,
        templateVersion: TEMPLATE_VERSION,
        format: '4x5',
        cover: { hook: post.coverHook },
        caption: post.caption,
        hashtags: post.hashtags,
        signReadingIds: rows.map((row) => row.id),
      });
    });
    return {
      status: 'created' as const,
      postId: created.id,
      providers: [...new Set([...sources.values()].map((source) => source.providerId))],
    };
  });
}

export async function regenerateSign(
  deps: GenerationDeps,
  input: { date: DateKey; audience: Audience; sign: SignSlug },
): Promise<SetResult | { status: 'missing' }> {
  const key = { date: input.date, kind: 'horoscope' as const, audience: input.audience };
  const current = await getCurrentPost(deps.db, key);
  if (!current) return { status: 'missing' };
  const run = await startRun(deps.db, { ...key, sign: input.sign, trigger: 'regenerate' }, clock(deps)());
  if (!run) return { status: 'busy' };

  return withRun(deps, run.id, async () => {
    const promptInput: HoroscopePromptInput = {
      dateKey: input.date,
      audience: input.audience,
      sky: getSkySnapshot(input.date),
      recent: await getRecentHeadlines(deps.db, key, input.date, 2),
    };
    const signIndex = SIGN_SLUGS.indexOf(input.sign);
    const signSlides = current.slides.filter((slide) => slide.type === 'sign');
    const { entry, source } = await generateSign(routerFor(deps, run.id), promptInput, input.sign, [
      { field: 'yorum', message: 'Bu burç için daha önce yazılan metinden tamamen farklı bir açı seç.' },
    ]);
    const created = await deps.db.transaction(async (tx) => {
      const [row] = await saveReadings(tx, key, [toNewReading(entry, source, run.id)]);
      const signReadingIds = signSlides.map((slide, index) => (index === signIndex ? row.id : (slide.readingId as string)));
      return createPostVersion(tx, {
        ...key,
        templateVersion: current.post.templateVersion,
        format: current.post.format,
        cover: current.post.cover,
        caption: current.post.caption,
        hashtags: current.post.hashtags,
        signReadingIds,
      });
    });
    return { status: 'created' as const, postId: created.id, providers: [source.providerId] };
  });
}
```

`src/lib/content/daily-package.ts`:
```ts
import type { DateKey } from '@/lib/date/istanbul';
import { AllProvidersFailedError } from '@/lib/llm/router';
import type { PlanItem } from '@/lib/settings/schema';
import { generateHoroscopeSet, type GenerationDeps, type SetResult } from './horoscope-service';
import type { RunTrigger } from './types';

export type PackageItemResult = { item: PlanItem; result: SetResult } | { item: PlanItem; error: string };

export function describeGenerationError(error: unknown): string {
  if (error instanceof AllProvidersFailedError) {
    return `${error.message} ${error.attempts.map((attempt) => `${attempt.providerId}: ${attempt.status}`).join(', ')}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export async function generateDailyPackage(
  deps: GenerationDeps,
  input: { date: DateKey; items: readonly PlanItem[]; trigger: RunTrigger; skipIfExists: boolean },
): Promise<PackageItemResult[]> {
  const settled = await Promise.allSettled(
    input.items.map((item) =>
      generateHoroscopeSet(deps, { date: input.date, audience: item.audience, trigger: input.trigger, skipIfExists: input.skipIfExists }),
    ),
  );
  return settled.map((outcome, index) =>
    outcome.status === 'fulfilled'
      ? { item: input.items[index], result: outcome.value }
      : { item: input.items[index], error: describeGenerationError(outcome.reason) },
  );
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/horoscope-service.ts src/lib/content/horoscope-service.test.ts src/lib/content/daily-package.ts src/lib/content/daily-package.test.ts
git commit -m "feat: günlük burç üretim servisi, tek burç yenileme ve günlük paket" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Üretim API'leri ve cron

**Files:**
- Create: `src/lib/content/dates.ts`, `src/lib/content/http.ts`, `src/lib/content/runtime.ts`, `src/lib/cron/daily.ts`, `src/app/api/generate/route.ts`, `src/app/api/generate/sign/route.ts`
- Modify: `src/app/api/cron/daily/route.ts`
- Delete: `src/app/api/cron/daily/route.test.ts` (yerini `src/lib/cron/daily.test.ts` alır)
- Test: `src/lib/content/http.test.ts`, `src/lib/cron/daily.test.ts`

**Interfaces:**
- Consumes: Task 10 (`generateHoroscopeSet`, `regenerateSign`, `generateDailyPackage`, `GenerationDeps`), Task 7 hataları, Task 9 (`Settings`), Faz 0 (`isAuthorizedCronRequest`, `getSettings`, `getDb`)
- Produces:
```ts
// src/lib/content/dates.ts
export function isAllowedGenerationDate(date: unknown, today: DateKey): date is DateKey; // today-7 … today+1
// src/lib/content/http.ts
export type HttpDeps = GenerationDeps & { today: DateKey };
export async function handleGenerate(request: Request, deps: HttpDeps): Promise<Response>;       // POST {date, audience, force?}
export async function handleRegenerateSign(request: Request, deps: HttpDeps): Promise<Response>; // POST {date, audience, sign}
// src/lib/content/runtime.ts
export async function loadGenerationDeps(db: Db): Promise<GenerationDeps & { settings: Settings }>;
// src/lib/cron/daily.ts
export async function handleDailyCron(request: Request, deps: { secret: string | undefined; today: DateKey; loadDeps: () => Promise<GenerationDeps & { settings: Settings }> }): Promise<Response>;
```
Yanıt sözleşmesi:
- `200 { status: 'created', postId, providers }` ya da `200 { status: 'skipped' }`
- `400 { error: 'Geçersiz istek.' }`
- `404 { error }` (yenilemede o günün yorumu yoksa)
- `409 { error: 'Bu içerik şu anda üretiliyor.' }`
- `502 { error, attempts }`
- `503 { error }` (sağlayıcı yok)

- [ ] **Step 1: Başarısız testleri yaz**

`src/lib/content/http.test.ts`:
```ts
import { APICallError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { createMockModel } from '@/lib/llm/mock-model';
import type { ProviderSpec } from '@/lib/llm/providers';
import { handleGenerate, handleRegenerateSign } from './http';
import { startRun } from './runs';

const TODAY = '2026-09-26';
let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const mock: ProviderSpec = { id: 'mock', label: 'mock', model: 'mock', dailyCap: 1000, factory: () => createMockModel() };
const deps = (chain: ProviderSpec[] = [mock]) => ({ db, chain, baseHashtags: ['#burç'], today: TODAY, timeoutMs: 1000 });
const post = (body: unknown) => new Request('http://localhost/api/generate', { method: 'POST', body: JSON.stringify(body) });

describe('handleGenerate', () => {
  it.each([
    [{ date: '2026-09-26' }],
    [{ date: '2026-09-26', audience: 'cocuk' }],
    [{ date: '2026-09-28', audience: 'kadin' }],
    [{ date: '2026-09-18', audience: 'kadin' }],
  ])('%j → 400', async (body) => {
    expect((await handleGenerate(post(body), deps())).status).toBe(400);
  });

  it('üretir, ikinci istekte atlar, force ile yeniden üretir', async () => {
    const first = await handleGenerate(post({ date: '2026-09-27', audience: 'kadin' }), deps());
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ status: 'created', providers: ['mock'] });
    expect(await (await handleGenerate(post({ date: '2026-09-27', audience: 'kadin' }), deps())).json()).toEqual({ status: 'skipped' });
    expect(await (await handleGenerate(post({ date: '2026-09-27', audience: 'kadin', force: true }), deps())).json()).toMatchObject({ status: 'created' });
  });

  it('üretim sürerken 409 döner', async () => {
    await startRun(db, { date: TODAY, kind: 'horoscope', audience: 'kadin', trigger: 'cron' });
    const res = await handleGenerate(post({ date: TODAY, audience: 'kadin' }), deps());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Bu içerik şu anda üretiliyor.' });
  });

  it('sağlayıcı yoksa 503, hepsi başarısızsa denemelerle 502 döner', async () => {
    expect((await handleGenerate(post({ date: TODAY, audience: 'kadin' }), deps([]))).status).toBe(503);
    const failing = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new APICallError({ message: 'HTTP 429', url: 'x', requestBodyValues: {}, statusCode: 429 });
      },
    });
    const res = await handleGenerate(post({ date: TODAY, audience: 'kadin' }), deps([{ ...mock, factory: () => failing }]));
    expect(res.status).toBe(502);
    expect((await res.json()).attempts).toEqual([{ provider: 'mock', status: 'rate_limited', error: 'HTTP 429' }]);
  });
});

describe('handleRegenerateSign', () => {
  const regen = (body: unknown) => new Request('http://localhost/api/generate/sign', { method: 'POST', body: JSON.stringify(body) });

  it('yorum yoksa 404, varsa 200 döner; bilinmeyen burç 400 alır', async () => {
    expect((await handleRegenerateSign(regen({ date: TODAY, audience: 'kadin', sign: 'aslan' }), deps())).status).toBe(404);
    await handleGenerate(post({ date: TODAY, audience: 'kadin' }), deps());
    const res = await handleRegenerateSign(regen({ date: TODAY, audience: 'kadin', sign: 'aslan' }), deps());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'created' });
    expect((await handleRegenerateSign(regen({ date: TODAY, audience: 'kadin', sign: 'ejderha' }), deps())).status).toBe(400);
  });
});
```

`src/lib/cron/daily.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { createMockModel } from '@/lib/llm/mock-model';
import { DEFAULT_SETTINGS } from '@/lib/settings/schema';
import { handleDailyCron } from './daily';

let db: Db;
let loads = 0;
beforeEach(async () => {
  db = await createTestDb();
  loads = 0;
});

function deps(cronEnabled = true) {
  return {
    secret: 'cron-anahtari',
    today: '2026-09-26',
    loadDeps: async () => {
      loads++;
      return {
        db,
        chain: [{ id: 'mock' as const, label: 'mock', model: 'mock', dailyCap: 1000, factory: () => createMockModel() }],
        baseHashtags: [],
        settings: { ...DEFAULT_SETTINGS, cronEnabled },
      };
    },
  };
}

const request = (authorization?: string) =>
  new Request('http://localhost/api/cron/daily', authorization ? { headers: { authorization } } : undefined);

describe('handleDailyCron', () => {
  it('anahtarsız istek veritabanına dokunmadan 401 alır', async () => {
    expect((await handleDailyCron(request(), deps())).status).toBe(401);
    expect(loads).toBe(0);
  });

  it('cron kapalıysa üretmez', async () => {
    expect(await (await handleDailyCron(request('Bearer cron-anahtari'), deps(false))).json()).toEqual({
      ok: true,
      skipped: 'Otomatik üretim kapalı.',
      generated: [],
    });
  });

  it('plandaki gönderileri üretir, ikinci çalıştırmada atlar', async () => {
    const first = await (await handleDailyCron(request('Bearer cron-anahtari'), deps())).json();
    expect(first.ok).toBe(true);
    expect(first.generated.map((entry: { result: { status: string } }) => entry.result.status)).toEqual(['created', 'created']);
    const second = await (await handleDailyCron(request('Bearer cron-anahtari'), deps())).json();
    expect(second.generated.map((entry: { result: { status: string } }) => entry.result.status)).toEqual(['skipped', 'skipped']);
  });
});
```

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `npx vitest run src/lib/content/http.test.ts src/lib/cron/daily.test.ts`
Expected: FAIL — modüller bulunamaz.

- [ ] **Step 3: Uygulamaları yaz**

`src/lib/content/dates.ts`:
```ts
import { addDays, isDateKey, type DateKey } from '@/lib/date/istanbul';

export function isAllowedGenerationDate(date: unknown, today: DateKey): date is DateKey {
  return isDateKey(date) && date >= addDays(today, -7) && date <= addDays(today, 1);
}
```

`src/lib/content/http.ts`:
```ts
import { z } from 'zod';
import type { DateKey } from '@/lib/date/istanbul';
import { AllProvidersFailedError, NoProvidersConfiguredError } from '@/lib/llm/router';
import { SIGN_SLUGS } from '@/lib/zodiac/signs';
import { isAllowedGenerationDate } from './dates';
import { generateHoroscopeSet, regenerateSign, type GenerationDeps } from './horoscope-service';

export type HttpDeps = GenerationDeps & { today: DateKey };

const audienceSchema = z.enum(['kadin', 'erkek']);
const generateSchema = z.object({ date: z.string(), audience: audienceSchema, force: z.boolean().optional() });
const signSchema = z.object({ date: z.string(), audience: audienceSchema, sign: z.enum(SIGN_SLUGS) });

const BAD_REQUEST = () => Response.json({ error: 'Geçersiz istek.' }, { status: 400 });
const BUSY = () => Response.json({ error: 'Bu içerik şu anda üretiliyor.' }, { status: 409 });

async function readBody<T>(request: Request, schema: z.ZodType<T>, today: DateKey): Promise<T | null> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return null;
  const date = (parsed.data as { date: string }).date;
  return isAllowedGenerationDate(date, today) ? parsed.data : null;
}

function failure(error: unknown): Response {
  if (error instanceof NoProvidersConfiguredError) return Response.json({ error: error.message }, { status: 503 });
  if (error instanceof AllProvidersFailedError) {
    return Response.json(
      {
        error: 'Tüm yapay zekâ sağlayıcıları başarısız oldu. Ayarlar sayfasındaki kullanım tablosuna bak ya da yerel üretimi dene.',
        attempts: error.attempts.map((attempt) => ({ provider: attempt.providerId, status: attempt.status, error: attempt.error })),
      },
      { status: 502 },
    );
  }
  throw error;
}

export async function handleGenerate(request: Request, deps: HttpDeps): Promise<Response> {
  const body = await readBody(request, generateSchema, deps.today);
  if (!body) return BAD_REQUEST();
  try {
    const result = await generateHoroscopeSet(deps, { date: body.date, audience: body.audience, trigger: 'button', skipIfExists: !body.force });
    return result.status === 'busy' ? BUSY() : Response.json(result);
  } catch (error) {
    return failure(error);
  }
}

export async function handleRegenerateSign(request: Request, deps: HttpDeps): Promise<Response> {
  const body = await readBody(request, signSchema, deps.today);
  if (!body) return BAD_REQUEST();
  try {
    const result = await regenerateSign(deps, body);
    if (result.status === 'missing') return Response.json({ error: 'Önce bu günün yorumlarını üret.' }, { status: 404 });
    return result.status === 'busy' ? BUSY() : Response.json(result);
  } catch (error) {
    return failure(error);
  }
}
```

`src/lib/content/runtime.ts`:
```ts
import type { Db } from '@/db/types';
import { availableProviders, resolveProviderChain } from '@/lib/llm/providers';
import { getSettings } from '@/lib/settings/repository';
import type { Settings } from '@/lib/settings/schema';
import type { GenerationDeps } from './horoscope-service';

export async function loadGenerationDeps(db: Db): Promise<GenerationDeps & { settings: Settings }> {
  const settings = await getSettings(db);
  const chain = resolveProviderChain(settings.providerChain, availableProviders(process.env), process.env.LLM_PROVIDER_OVERRIDE);
  return { db, chain, baseHashtags: settings.baseHashtags, spreadLoad: settings.spreadLoad, settings };
}
```

`src/lib/cron/daily.ts`:
```ts
import { generateDailyPackage } from '@/lib/content/daily-package';
import type { GenerationDeps } from '@/lib/content/horoscope-service';
import type { DateKey } from '@/lib/date/istanbul';
import type { Settings } from '@/lib/settings/schema';
import { isAuthorizedCronRequest } from './auth';

export async function handleDailyCron(
  request: Request,
  deps: { secret: string | undefined; today: DateKey; loadDeps: () => Promise<GenerationDeps & { settings: Settings }> },
): Promise<Response> {
  if (!isAuthorizedCronRequest(request.headers, deps.secret)) return Response.json({ error: 'Yetkisiz.' }, { status: 401 });
  const generation = await deps.loadDeps();
  if (!generation.settings.cronEnabled) return Response.json({ ok: true, skipped: 'Otomatik üretim kapalı.', generated: [] });
  const generated = await generateDailyPackage(generation, {
    date: deps.today,
    items: generation.settings.dailyPlan,
    trigger: 'cron',
    skipIfExists: true,
  });
  return Response.json({ ok: generated.every((entry) => 'result' in entry), generated });
}
```

`src/app/api/cron/daily/route.ts` (tamamını değiştir):
```ts
import { getDb } from '@/db/client';
import { loadGenerationDeps } from '@/lib/content/runtime';
import { handleDailyCron } from '@/lib/cron/daily';
import { istanbulDateKey } from '@/lib/date/istanbul';

export const maxDuration = 300;

export async function GET(request: Request) {
  return handleDailyCron(request, {
    secret: process.env.CRON_SECRET,
    today: istanbulDateKey(),
    loadDeps: () => loadGenerationDeps(getDb()),
  });
}
```

`src/app/api/generate/route.ts`:
```ts
import { getDb } from '@/db/client';
import { handleGenerate } from '@/lib/content/http';
import { loadGenerationDeps } from '@/lib/content/runtime';
import { istanbulDateKey } from '@/lib/date/istanbul';

export const maxDuration = 300;

export async function POST(request: Request) {
  return handleGenerate(request, { ...(await loadGenerationDeps(getDb())), today: istanbulDateKey() });
}
```

`src/app/api/generate/sign/route.ts`:
```ts
import { getDb } from '@/db/client';
import { handleRegenerateSign } from '@/lib/content/http';
import { loadGenerationDeps } from '@/lib/content/runtime';
import { istanbulDateKey } from '@/lib/date/istanbul';

export const maxDuration = 300;

export async function POST(request: Request) {
  return handleRegenerateSign(request, { ...(await loadGenerationDeps(getDb())), today: istanbulDateKey() });
}
```

```bash
git rm src/app/api/cron/daily/route.test.ts
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS, build başarılı.

- [ ] **Step 5: Commit**

```bash
git add -A src/lib/content src/lib/cron src/app/api
git commit -m "feat: üretim ve tek burç yenileme API'leri, cron günlük paketi üretir" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Arayüz — Bugün paneli ve Burçlar sayfası

**Files:**
- Run: `shadcn add badge`, Magic UI `animated-list`, `confetti`, `magic-card`, `orbiting-circles`
- Modify: `src/components/app-shell/nav-items.ts`, `src/app/(app)/page.tsx`, `e2e/test-server.ts`
- Create: `src/components/today/sky-summary.tsx`, `src/components/today/daily-package-panel.tsx`, `src/app/(app)/burclar/page.tsx`, `src/components/signs/sign-card.tsx`, `src/components/signs/regenerate-sign-button.tsx`
- Test: `e2e/generate.spec.ts`

**Interfaces:**
- Consumes: `/api/generate`, `/api/generate/sign` (Task 11); `getSkySnapshot`, `skyHeadlineTr` (Task 2); `getCurrentPostsForDate`, `getCurrentReadings`, `ReadingRow` (Task 8); `getSettings` (Faz 0/Task 9); `isAllowedGenerationDate` (Task 11); `SIGNS`, `getSign` (Task 1); `getLuckyColor` (Task 3); `AUDIENCE_LABELS` (Task 3)
- Produces: `/` ve `/burclar?tarih=YYYY-MM-DD&kitle=kadin|erkek` sayfaları. `DailyPackagePanel` bileşeni: `{ date: DateKey; items: { kind: 'horoscope'; audience: Audience; ready: boolean }[] }`.

- [ ] **Step 1: E2E sunucusuna sahte modeli ekle**

`e2e/test-server.ts` içindeki `env` nesnesine ekle:
```ts
    LLM_MOCK: '1',
    LLM_PROVIDER_OVERRIDE: 'mock',
```

- [ ] **Step 2: Başarısız E2E testini yaz**

`e2e/generate.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { E2E_CRON_SECRET } from './constants';
import { login } from './helpers';

test('günün paketi tek tıkla üretilir, burçlar sayfasında 12 yorum görünür', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Günün paketini oluştur' }).click();
  await expect(page.getByText('Paket hazır')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('navigation', { name: 'Ana menü' }).getByRole('link', { name: 'Burçlar' }).click();
  await expect(page.getByRole('article')).toHaveCount(12);
  await expect(page.getByRole('heading', { name: /Koç$/ })).toBeVisible();
  await page.getByRole('link', { name: 'Erkek' }).click();
  await expect(page).toHaveURL(/kitle=erkek/);
  await expect(page.getByRole('article')).toHaveCount(12);
});

test('tek burç yeniden üretilir', async ({ page }) => {
  await login(page, '/burclar');
  await page.getByRole('button', { name: 'Aslan yorumunu yeniden üret' }).click();
  await expect(page.getByText('Aslan yorumu yenilendi.')).toBeVisible({ timeout: 30_000 });
});

test('cron uç noktası anahtarla çalışır ve mevcut paketi atlar', async ({ request }) => {
  const response = await request.get('/api/cron/daily', { headers: { authorization: `Bearer ${E2E_CRON_SECRET}` } });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.generated.map((entry: { result: { status: string } }) => entry.result.status)).toEqual(['skipped', 'skipped']);
});
```

- [ ] **Step 3: E2E testinin başarısız olduğunu gör**

Run: `npm run test:e2e -- e2e/generate.spec.ts`
Expected: FAIL — `Günün paketini oluştur` butonu yok.

- [ ] **Step 4: Bileşenleri kur**

```bash
npx -y shadcn@latest add badge -y
V=~/.agents/skills/magic-ui/vendor/r
npx -y shadcn@latest add $V/animated-list.json $V/confetti.json $V/magic-card.json $V/orbiting-circles.json -y
```

- [ ] **Step 5: Navigasyon ve Bugün sayfası**

`src/components/app-shell/nav-items.ts`:
```ts
import { Settings, Stars, Sun, type LucideIcon } from 'lucide-react';

export const NAV_ITEMS: readonly { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Bugün', icon: Sun },
  { href: '/burclar', label: 'Burçlar', icon: Stars },
  { href: '/ayarlar', label: 'Ayarlar', icon: Settings },
];
```

`src/components/today/sky-summary.tsx`:
```tsx
import { Card, CardContent } from '@/components/ui/card';
import { OrbitingCircles } from '@/components/ui/orbiting-circles';
import { skyHeadlineTr, type SkySnapshot } from '@/lib/astro/sky';
import { SIGNS, getSign } from '@/lib/zodiac/signs';

export function SkySummary({ sky }: { sky: SkySnapshot }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 sm:flex-row">
        <div aria-hidden className="relative flex size-40 shrink-0 items-center justify-center">
          <OrbitingCircles radius={64} iconSize={22} duration={60}>
            {SIGNS.map((sign) => (
              <span key={sign.slug} className="text-sm text-primary">
                {sign.glyph}
              </span>
            ))}
          </OrbitingCircles>
          <span className="font-heading text-3xl text-primary">{getSign(sky.sunSign).glyph}</span>
        </div>
        <div className="space-y-1 text-center sm:text-left">
          <h2 className="font-heading text-2xl">Günün gökyüzü</h2>
          <p className="text-sm text-muted-foreground">{skyHeadlineTr(sky)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
```

`src/components/today/daily-package-panel.tsx`:
```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedListItem } from '@/components/ui/animated-list';
import { Confetti, type ConfettiRef } from '@/components/ui/confetti';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { AUDIENCE_LABELS, type Audience } from '@/lib/content/types';
import type { DateKey } from '@/lib/date/istanbul';

type Item = { kind: 'horoscope'; audience: Audience; ready: boolean };
type LogEntry = { id: number; text: string; tone: 'info' | 'success' | 'error' };

const label = (audience: Audience) => `${AUDIENCE_LABELS[audience]} burç yorumları`;

export function DailyPackagePanel({ date, items }: { date: DateKey; items: Item[] }) {
  const router = useRouter();
  const confetti = useRef<ConfettiRef>(null);
  const nextId = useRef(0);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const allReady = items.every((item) => item.ready);

  const append = (text: string, tone: LogEntry['tone']) => setLog((previous) => [...previous, { id: nextId.current++, text, tone }]);

  async function generate(force: boolean) {
    if (force && !window.confirm('Günün tüm yorumları yeniden üretilecek. Eski sürümler arşivde kalır. Devam edilsin mi?')) return;
    setRunning(true);
    setLog([]);
    const targets = force ? items : items.filter((item) => !item.ready);
    const outcomes = await Promise.all(
      targets.map(async (item) => {
        append(`${label(item.audience)} hazırlanıyor…`, 'info');
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ date, audience: item.audience, force }),
        });
        const data = (await response.json().catch(() => ({}))) as { status?: string; providers?: string[]; error?: string };
        if (response.ok) {
          append(`✓ ${label(item.audience)} hazır${data.providers ? ` (${data.providers.join(', ')})` : ''}`, 'success');
          return true;
        }
        append(`✗ ${label(item.audience)}: ${data.error ?? 'Bilinmeyen hata'}`, 'error');
        return false;
      }),
    );
    setRunning(false);
    if (outcomes.every(Boolean)) {
      append('Paket hazır 🎉', 'success');
      void confetti.current?.fire({});
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Günün paketi</CardTitle>
        <CardDescription>Plandaki gönderiler tek tıkla üretilir; eksik olanlar tamamlanır.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.audience} className="flex items-center justify-between rounded-xl border px-4 py-3">
              <span className="text-sm font-medium">{label(item.audience)}</span>
              <Badge variant={item.ready ? 'secondary' : 'outline'}>{item.ready ? 'Hazır' : 'Bekliyor'}</Badge>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <ShimmerButton type="button" background="#7a5aa6" disabled={running || allReady} onClick={() => void generate(false)}>
            {running ? 'Üretiliyor…' : 'Günün paketini oluştur'}
          </ShimmerButton>
          <Button type="button" variant="ghost" disabled={running} onClick={() => void generate(true)}>
            Tümünü yeniden üret
          </Button>
        </div>
        {log.length > 0 && (
          <div aria-live="polite" className="space-y-2">
            {log.map((entry) => (
              <AnimatedListItem key={entry.id}>
                <p
                  className={
                    entry.tone === 'error' ? 'text-sm text-destructive' : entry.tone === 'success' ? 'text-sm text-primary' : 'text-sm text-muted-foreground'
                  }
                >
                  {entry.text}
                </p>
              </AnimatedListItem>
            ))}
          </div>
        )}
        <Confetti ref={confetti} manualstart className="pointer-events-none fixed inset-0 z-50 size-full" />
      </CardContent>
    </Card>
  );
}
```

`src/app/(app)/page.tsx` (tamamını değiştir):
```tsx
import Link from 'next/link';
import { connection } from 'next/server';
import { DailyPackagePanel } from '@/components/today/daily-package-panel';
import { SkySummary } from '@/components/today/sky-summary';
import { BlurFade } from '@/components/ui/blur-fade';
import { getDb } from '@/db/client';
import { getSkySnapshot } from '@/lib/astro/sky';
import { getCurrentPostsForDate } from '@/lib/content/repository';
import { addDays, formatDateLongTr, istanbulDateKey } from '@/lib/date/istanbul';
import { getSettings } from '@/lib/settings/repository';
import { cn } from '@/lib/utils';

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { gun } = await searchParams;
  const today = istanbulDateKey();
  const tomorrow = gun === 'yarin';
  const date = tomorrow ? addDays(today, 1) : today;
  const db = getDb();
  const [settings, posts] = await Promise.all([getSettings(db), getCurrentPostsForDate(db, date)]);
  const items = settings.dailyPlan.map((item) => ({
    ...item,
    ready: posts.some((post) => post.kind === item.kind && post.audience === item.audience),
  }));

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <BlurFade>
        <p className="text-sm text-muted-foreground">{formatDateLongTr(date)}</p>
        <h1 className="font-heading text-4xl">{tomorrow ? 'Yarın' : 'Bugün'}</h1>
        <nav aria-label="Gün seçimi" className="mt-3 flex gap-2 text-sm">
          <Link href="/" className={cn('rounded-full px-3 py-1', !tomorrow && 'bg-secondary font-semibold')}>
            Bugün
          </Link>
          <Link href="/?gun=yarin" className={cn('rounded-full px-3 py-1', tomorrow && 'bg-secondary font-semibold')}>
            Yarın
          </Link>
        </nav>
      </BlurFade>
      <BlurFade delay={0.1}>
        <SkySummary sky={getSkySnapshot(date)} />
      </BlurFade>
      <BlurFade delay={0.2}>
        <DailyPackagePanel date={date} items={items} />
      </BlurFade>
    </section>
  );
}
```

- [ ] **Step 6: Burçlar sayfası**

`src/components/signs/regenerate-sign-button.tsx`:
```tsx
'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { Audience } from '@/lib/content/types';
import type { DateKey } from '@/lib/date/istanbul';
import { cn } from '@/lib/utils';
import type { SignSlug } from '@/lib/zodiac/signs';

export function RegenerateSignButton({ date, audience, sign, name }: { date: DateKey; audience: Audience; sign: SignSlug; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={`${name} yorumunu yeniden üret`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const response = await fetch('/api/generate/sign', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ date, audience, sign }),
          });
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          if (response.ok) {
            toast.success(`${name} yorumu yenilendi.`);
            router.refresh();
          } else {
            toast.error(data.error ?? 'Yeniden üretilemedi.');
          }
        })
      }
    >
      <RefreshCw className={cn('size-4', pending && 'animate-spin')} aria-hidden />
      Yeniden üret
    </Button>
  );
}
```

`src/components/signs/sign-card.tsx`:
```tsx
import { Badge } from '@/components/ui/badge';
import { MagicCard } from '@/components/ui/magic-card';
import { getLuckyColor } from '@/lib/content/lucky-colors';
import type { ReadingRow } from '@/lib/content/repository';
import type { Audience } from '@/lib/content/types';
import { getSign } from '@/lib/zodiac/signs';
import { RegenerateSignButton } from './regenerate-sign-button';

function Stars({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd aria-label={`${label} ${value}/5`} className="text-sm tracking-widest text-primary">
        {'★'.repeat(value)}
        <span className="text-muted">{'★'.repeat(5 - value)}</span>
      </dd>
    </div>
  );
}

export function SignCard({ reading, audience }: { reading: ReadingRow; audience: Audience }) {
  const sign = getSign(reading.sign);
  const color = getLuckyColor(reading.meta.luckyColor);
  return (
    <MagicCard className="rounded-2xl" gradientFrom="#c8b6e2" gradientTo="#f4c2c2">
      <article aria-labelledby={`burc-${sign.slug}`} className="flex h-full flex-col gap-3 p-5">
        <header className="flex items-baseline justify-between gap-2">
          <h2 id={`burc-${sign.slug}`} className="font-heading text-2xl">
            <span aria-hidden className="mr-2 text-primary">
              {sign.glyph}
            </span>
            {sign.name}
          </h2>
          <span className="text-xs text-muted-foreground">{sign.dateRange}</span>
        </header>
        <h3 className="font-semibold">{reading.headline}</h3>
        <p className="text-sm leading-relaxed">{reading.body}</p>
        <p className="text-sm text-muted-foreground italic">{reading.short}</p>
        <dl className="grid gap-1">
          <Stars label="Aşk" value={reading.meta.scores.love} />
          <Stars label="Para" value={reading.meta.scores.money} />
          <Stars label="Sağlık" value={reading.meta.scores.health} />
        </dl>
        <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
          <span className="flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-full border" style={{ backgroundColor: color.hex }} />
            {color.name} · Şanslı sayı {reading.meta.luckyNumber}
          </span>
          <Badge variant="outline">{reading.provider}</Badge>
          <RegenerateSignButton date={reading.date} audience={audience} sign={sign.slug} name={sign.name} />
        </footer>
      </article>
    </MagicCard>
  );
}
```

`src/app/(app)/burclar/page.tsx`:
```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { SignCard } from '@/components/signs/sign-card';
import { buttonVariants } from '@/components/ui/button';
import { getDb } from '@/db/client';
import { isAllowedGenerationDate } from '@/lib/content/dates';
import { getCurrentReadings } from '@/lib/content/repository';
import { AUDIENCE_LABELS, type Audience } from '@/lib/content/types';
import { addDays, formatDateLongTr, istanbulDateKey } from '@/lib/date/istanbul';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Burçlar' };

export default async function SignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const today = istanbulDateKey();
  const date = isAllowedGenerationDate(params.tarih, today) ? params.tarih : today;
  const audience: Audience = params.kitle === 'erkek' ? 'erkek' : 'kadin';
  const readings = await getCurrentReadings(getDb(), { date, kind: 'horoscope', audience });
  const href = (nextDate: string, nextAudience: Audience) => `/burclar?tarih=${nextDate}&kitle=${nextAudience}`;
  const previous = addDays(date, -1);
  const next = addDays(date, 1);

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">{formatDateLongTr(date)}</p>
        <h1 className="font-heading text-4xl">Günlük burç yorumları</h1>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Okur kitlesi" className="flex gap-2">
            {(['kadin', 'erkek'] as const).map((value) => (
              <Link
                key={value}
                href={href(date, value)}
                aria-current={audience === value ? 'page' : undefined}
                className={cn('rounded-full px-4 py-1.5 text-sm', audience === value ? 'bg-primary text-primary-foreground' : 'bg-secondary')}
              >
                {AUDIENCE_LABELS[value]}
              </Link>
            ))}
          </nav>
          <nav aria-label="Gün" className="ml-auto flex gap-2">
            {isAllowedGenerationDate(previous, today) && (
              <Link href={href(previous, audience)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                ← Önceki gün
              </Link>
            )}
            {isAllowedGenerationDate(next, today) && (
              <Link href={href(next, audience)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Sonraki gün →
              </Link>
            )}
          </nav>
        </div>
      </header>
      {readings.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
          Bu gün için {AUDIENCE_LABELS[audience].toLocaleLowerCase('tr-TR')} yorumları henüz üretilmedi. Bugün sayfasından paketi oluşturabilirsin.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {readings.map((reading) => (
            <SignCard key={reading.id} reading={reading} audience={audience} />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 7: E2E ve tüm kontroller**

Run: `npm run test:e2e && npm test && npm run lint && npm run typecheck && npm run build`
Expected: auth, settings ve generate E2E testleri ile birim testleri PASS, build başarılı.

- [ ] **Step 8: Görsel kontrol**

`npm run test:e2e -- e2e/generate.spec.ts --trace on` ile üretilen trace'i aç ya da Chrome DevTools MCP ile şunları doğrula:
- Masaüstünde (1280 px) Bugün sayfası: burç çarkı döner, konfeti bir kez patlar.
- Mobilde (390 px) Burçlar sayfası: kartlar tek sütun olur, alt menü içeriği örtmez.

Sorun varsa düzelt ve bulguları rapora yaz.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: Bugün paneli ile günün paketi, burç kartları ve tek burç yenileme" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Ayarlar — üretim ayarları ve kullanım tablosu

**Files:**
- Create: `src/lib/settings/generation-form.ts`, `src/app/(app)/ayarlar/generation-actions.ts`, `src/app/(app)/ayarlar/generation-form.tsx`, `src/app/(app)/ayarlar/usage-table.tsx`
- Modify: `src/app/(app)/ayarlar/page.tsx`, `e2e/settings.spec.ts`
- Test: `src/lib/settings/generation-form.test.ts`, `e2e/settings.spec.ts` (yeni test)

**Interfaces:**
- Consumes: `normalizeHashtag` (Task 3), `providerPreferenceSchema`, `PlanItem`, `SettingsPatch` (Task 9), `availableProviders` (Task 6), `getUsageSummary`, `UsageRow` (Task 8), `requireSession` (Faz 0)
- Produces:
```ts
// src/lib/settings/generation-form.ts
export type GenerationFormErrors = Partial<Record<'dailyPlan' | 'baseHashtags' | 'providerChain', string>>;
export function parseGenerationForm(formData: FormData): { ok: true; patch: SettingsPatch } | { ok: false; errors: GenerationFormErrors };
// src/app/(app)/ayarlar/generation-form.tsx
export type ProviderOption = { id: ProviderId; label: string; model: string; dailyCap: number };
export function GenerationSettingsForm(props: { initial: Settings; providers: ProviderOption[] }): JSX.Element;
```

- [ ] **Step 1: Ayrıştırıcı için başarısız testi yaz**

`src/lib/settings/generation-form.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseGenerationForm } from './generation-form';

function form(entries: [string, string][]) {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

const valid: [string, string][] = [
  ['cronEnabled', 'false'],
  ['spreadLoad', 'true'],
  ['dailyPlan', 'horoscope:kadin'],
  ['hashtag1', 'Günlük Burç'],
  ['hashtag2', ''],
  ['providerChain', JSON.stringify([{ id: 'gemini', enabled: true, dailyCap: 10 }])],
];

describe('parseGenerationForm', () => {
  it('geçerli formu yamaya çevirir', () => {
    expect(parseGenerationForm(form(valid))).toEqual({
      ok: true,
      patch: {
        cronEnabled: false,
        spreadLoad: true,
        dailyPlan: [{ kind: 'horoscope', audience: 'kadin' }],
        baseHashtags: ['#günlükburç'],
        providerChain: [{ id: 'gemini', enabled: true, dailyCap: 10 }],
      },
    });
  });

  it('boş plan, geçersiz hashtag ve bozuk sağlayıcı listesi hatası döner', () => {
    const result = parseGenerationForm(
      form([
        ['cronEnabled', 'true'],
        ['hashtag1', '###'],
        ['providerChain', '{bozuk'],
      ]),
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        dailyPlan: 'En az bir gönderi türü seçmelisin.',
        baseHashtags: 'Hashtag yalnızca harf, rakam ve alt çizgi içerebilir.',
        providerChain: 'Sağlayıcı sırası okunamadı.',
      },
    });
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `npx vitest run src/lib/settings/generation-form.test.ts`
Expected: FAIL — `./generation-form` bulunamaz.

- [ ] **Step 3: Ayrıştırıcıyı yaz**

`src/lib/settings/generation-form.ts`:
```ts
import { z } from 'zod';
import { normalizeHashtag } from '@/lib/content/hashtags';
import { providerPreferenceSchema, type PlanItem, type SettingsPatch } from './schema';

export type GenerationFormErrors = Partial<Record<'dailyPlan' | 'baseHashtags' | 'providerChain', string>>;

const PLAN_VALUES: Record<string, PlanItem> = {
  'horoscope:kadin': { kind: 'horoscope', audience: 'kadin' },
  'horoscope:erkek': { kind: 'horoscope', audience: 'erkek' },
};

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function parseGenerationForm(
  formData: FormData,
): { ok: true; patch: SettingsPatch } | { ok: false; errors: GenerationFormErrors } {
  const errors: GenerationFormErrors = {};

  const dailyPlan = formData.getAll('dailyPlan').flatMap((value) => {
    const item = PLAN_VALUES[String(value)];
    return item ? [item] : [];
  });
  if (dailyPlan.length === 0) errors.dailyPlan = 'En az bir gönderi türü seçmelisin.';

  const tags = ['hashtag1', 'hashtag2']
    .map((name) => String(formData.get(name) ?? '').trim())
    .filter(Boolean)
    .map(normalizeHashtag);
  if (tags.some((tag) => tag === null)) errors.baseHashtags = 'Hashtag yalnızca harf, rakam ve alt çizgi içerebilir.';

  const chain = z.array(providerPreferenceSchema).safeParse(parseJson(String(formData.get('providerChain') ?? '[]')));
  if (!chain.success) errors.providerChain = 'Sağlayıcı sırası okunamadı.';

  if (Object.keys(errors).length > 0 || !chain.success) return { ok: false, errors };
  return {
    ok: true,
    patch: {
      cronEnabled: formData.get('cronEnabled') === 'true',
      spreadLoad: formData.get('spreadLoad') === 'true',
      dailyPlan,
      baseHashtags: tags.filter((tag): tag is string => tag !== null),
      providerChain: chain.data,
    },
  };
}
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `npx vitest run src/lib/settings`
Expected: PASS.

- [ ] **Step 5: Başarısız E2E testini ekle**

`e2e/settings.spec.ts` sonuna ekle:
```ts
test('otomatik üretim kapatılır ve temel hashtag kaydedilir', async ({ page }) => {
  await login(page, '/ayarlar');
  await page.getByRole('switch', { name: 'Her sabah otomatik üret' }).click();
  await page.getByLabel('1. temel hashtag').fill('Günlük Burç');
  await page.getByRole('button', { name: 'Üretim ayarlarını kaydet' }).click();
  await expect(page.getByText('Üretim ayarları kaydedildi.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Her sabah otomatik üret' })).not.toBeChecked();
  await expect(page.getByLabel('1. temel hashtag')).toHaveValue('#günlükburç');
  await expect(page.getByRole('table', { name: 'Son 7 günün sağlayıcı kullanımı' })).toBeVisible();
});
```

Run: `npm run test:e2e -- e2e/settings.spec.ts`
Expected: FAIL — `Her sabah otomatik üret` anahtarı yok.

- [ ] **Step 6: Server action, form, tablo ve sayfa**

`src/app/(app)/ayarlar/generation-actions.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireSession } from '@/lib/auth/require-session';
import { parseGenerationForm, type GenerationFormErrors } from '@/lib/settings/generation-form';
import { saveSettings } from '@/lib/settings/repository';

export type GenerationFormState =
  | { status: 'idle' }
  | { status: 'saved'; savedAt: number }
  | { status: 'error'; errors: GenerationFormErrors };

export async function saveGenerationSettingsAction(_prev: GenerationFormState, formData: FormData): Promise<GenerationFormState> {
  await requireSession();
  const parsed = parseGenerationForm(formData);
  if (!parsed.ok) return { status: 'error', errors: parsed.errors };
  await saveSettings(getDb(), parsed.patch);
  revalidatePath('/ayarlar');
  return { status: 'saved', savedAt: Date.now() };
}
```

`src/app/(app)/ayarlar/generation-form.tsx`:
```tsx
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
```

`src/app/(app)/ayarlar/usage-table.tsx`:
```tsx
import type { UsageRow } from '@/lib/content/runs';
import { formatDateShortTr } from '@/lib/date/istanbul';

export function UsageTable({ rows }: { rows: UsageRow[] }) {
  return (
    <table aria-label="Son 7 günün sağlayıcı kullanımı" className="w-full text-left text-sm">
      <thead className="text-muted-foreground">
        <tr>
          <th className="py-2 font-medium">Gün</th>
          <th className="py-2 font-medium">Sağlayıcı</th>
          <th className="py-2 font-medium">Başarılı</th>
          <th className="py-2 font-medium">Başarısız</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={4} className="py-3 text-muted-foreground">
              Henüz çağrı yok.
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={`${row.date}-${row.provider}`} className="border-t">
              <td className="py-2">{formatDateShortTr(row.date)}</td>
              <td className="py-2">{row.provider}</td>
              <td className="py-2">{row.ok}</td>
              <td className="py-2">{row.failed}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
```

`src/app/(app)/ayarlar/page.tsx` (tamamını değiştir):
```tsx
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
```

- [ ] **Step 7: E2E ve tüm kontroller**

Run: `npm run test:e2e && npm test && npm run lint && npm run typecheck && npm run build`
Expected: tüm testler PASS, build başarılı.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: üretim ayarları, sağlayıcı sırası düzenleyici ve kullanım tablosu" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Yerel Ollama ile acil durum üretimi

**Files:**
- Create: `scripts/generate-local.ts`
- Modify: `package.json` (`generate:local`)

**Interfaces:**
- Consumes: `getDb`, `closeDb` (Faz 0); `getSettings` (Task 9); `availableProviders`, `resolveProviderChain` (Task 6); `generateDailyPackage` (Task 10); tarih yardımcıları
- Produces: `npm run generate:local -- [YYYY-MM-DD]`. Yerel Ollama ile günün planını üretir ve `.env.production.local`'daki veritabanına yazar.

- [ ] **Step 1: Script'i yaz**

`scripts/generate-local.ts`:
```ts
import { closeDb, getDb } from '../src/db/client';
import { generateDailyPackage } from '../src/lib/content/daily-package';
import { isDateKey, istanbulDateKey } from '../src/lib/date/istanbul';
import { availableProviders, resolveProviderChain } from '../src/lib/llm/providers';
import { getSettings } from '../src/lib/settings/repository';

async function main() {
  const date = process.argv[2] ?? istanbulDateKey();
  if (!isDateKey(date)) throw new Error(`Geçersiz tarih: ${date}`);
  const db = getDb();
  const settings = await getSettings(db);
  const env = { ...process.env, OLLAMA_LOCAL_MODEL: process.env.OLLAMA_LOCAL_MODEL ?? 'gemma4:26b' };
  const chain = resolveProviderChain([], availableProviders(env), 'ollama-local');
  console.log(`${date} için yerel üretim başlıyor (${chain[0].model})…`);
  const results = await generateDailyPackage(
    { db, chain, baseHashtags: settings.baseHashtags, timeoutMs: 600_000 },
    { date, items: settings.dailyPlan, trigger: 'local', skipIfExists: true },
  );
  for (const entry of results) {
    console.log(`${entry.item.audience}: ${'result' in entry ? entry.result.status : `HATA — ${entry.error}`}`);
  }
  if (results.some((entry) => 'error' in entry)) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
```

`package.json` → `scripts` içine ekle:
```json
    "generate:local": "node --env-file=.env.production.local --import tsx scripts/generate-local.ts",
```

- [ ] **Step 2: Yerel veritabanında elle doğrula (üretim verisine dokunmadan)**

```bash
ollama list | grep gemma4
LOCAL_DB_PORT=55498 LOCAL_DB_DIR=memory:// npx tsx scripts/local-db.ts & LOCAL_DB_PID=$!
sleep 4
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55498/postgres node --import tsx scripts/generate-local.ts 2026-09-27
kill $LOCAL_DB_PID
```
Expected:
- Çıktı `kadin: created` ve `erkek: created` satırlarını içerir. Model yerel olduğu için birkaç dakika sürebilir.
- `created` yerine hata gelirse gerçek hata çıktısını rapora ekle. Örneğin `gemma4:26b` JSON biçimine uymadıysa `invalid_output` görünür. Bu durumda `OLLAMA_LOCAL_MODEL=qwen3.8` ile bir kez daha dene ve iki sonucu da raporla.

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-local.ts package.json
git commit -m "feat: yerel Ollama ile acil durum üretim komutu" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Canlı doğrulama (kontrolcü + kullanıcı)

> Anahtar girişi ve hesap işlemleri gerektirdiği için **kontrolcü tarafından, kullanıcıyla birlikte** yürütülür.

**Files:** yok (yalnızca Vercel yapılandırması ve doğrulama)

**Interfaces:**
- Consumes: tüm Faz 1 çıktıları, Faz 0'da kurulan Vercel projesi ve Neon
- Produces: production'da çalışan günlük burç üretimi ve doğrulama raporu

- [ ] **Step 1: Sağlayıcı anahtarları (kullanıcı)**

Kullanıcıdan iste:
1. Google AI Studio'da ücretsiz bir API anahtarı oluştursun ve `! vercel env add GOOGLE_GENERATIVE_AI_API_KEY production,preview` ile eklesin.
2. `ollama.com/settings/keys` adresinde bir anahtar oluştursun ve `! vercel env add OLLAMA_API_KEY production,preview` ile eklesin.

Anahtarlar sohbete yazılmaz. AI Gateway, Vercel'de OIDC ile anahtarsız çalışır.
Run: `vercel env ls`
Expected: iki anahtar production ve preview ortamlarında listelenir.

- [ ] **Step 2: Migration ve önizleme**

```bash
vercel env pull .env.production.local --environment=production
npm run db:migrate:prod
git push -u origin faz-1-gunluk-burc
```
Expected: `0001_content` migration'ı uygulanır. Push önizleme deploy'unu tetikler.

- [ ] **Step 3: Gerçek sağlayıcılarla üretim (kullanıcı + kontrolcü)**

Kullanıcı önizleme URL'sinde Bugün sayfasında **Yarın**'a geçer ve "Günün paketini oluştur"a basar. Kontrolcü şunları doğrular:
- İki gönderi de "Hazır" olur.
- Log satırında hangi sağlayıcının kullanıldığı yazar (beklenen: `gateway`).
- Burçlar sayfasında 12 kadın ve 12 erkek yorumu görünür.
- Metinler Türkçe, samimi ve esprili; puanlar ile şanslı renk dolu.
- Ayarlar'daki kullanım tablosunda `gateway` satırı vardır.

- [ ] **Step 4: Yedekleme gösterimi**

Ayarlar → Sağlayıcı sırası'nda "Vercel AI Gateway" modelini geçici olarak `google/olmayan-model` yap ve kaydet. Burçlar sayfasında (Yarın, Kadın) bir burcu "Yeniden üret". Beklenen:
- Toast "…yorumu yenilendi." der.
- Kullanım tablosunda `gateway` için başarısız, `gemini` için başarılı çağrı görünür.

Ardından modeli `google/gemini-2.5-flash` olarak geri al ve kaydet.

- [ ] **Step 5: Birleştir ve cron'u production'da doğrula**

`superpowers:finishing-a-development-branch` ile birleştir, production deploy'unu bekle. Ardından:
```bash
vercel crons run /api/cron/daily
vercel logs --environment production --since 10m | grep -E "api/cron/daily|error" | head -20
```
Expected: Cron çalışır. Bugünün paketi ya üretilir ya da zaten varsa `skipped` döner. Loglarda hata yoktur.

Yarın sabah 06:00–06:59 TSİ arasında cron'un kendiliğinden çalıştığını Bugün sayfasından kontrol etmek kullanıcıya bırakılır. Raporda bunu doğrulanmamış madde olarak belirt.

- [ ] **Step 6: Rapor**

Kullanıcıya şunları raporla:
- neyin nasıl doğrulandığı,
- hangi sağlayıcıların çalıştığı,
- örnek bir burç metni,
- doğrulanamayanlar (sabah cron'u, Ollama Cloud'un gerçek yükte davranışı, Gemini'nin günlük limitlerinin gerçek değerleri).
