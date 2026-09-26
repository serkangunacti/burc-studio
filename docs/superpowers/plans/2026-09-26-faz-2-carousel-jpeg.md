# Faz 2: Carousel ve JPEG — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Günün burç gönderilerini Instagram'a hazır 14 slaytlık carousel olarak (kapak + 12 burç + kapanış) tarayıcıda 1080×1350 JPEG'e çevirmek; gönderi sayfasında önizleme, metin düzenleme, ZIP indirme, telefonda paylaşma ve caption kopyalama; arşivden eski sürümleri birebir yeniden üretmek.

**Architecture:** Slayt görünümü, Remotion kompozisyonu olarak yazılmış sürümlü bir şablondur (`pastel@1`). Sunucu, gönderi sürümünün `post_slides → readings` bağlarından kendi kendine yeten `SlideProps` verisi üretir. İstemci aynı veriyi `@remotion/player` `Thumbnail` ile önizler ve `@remotion/web-renderer` `renderStillOnWeb` ile JPEG'e çevirir; `fflate` ile ZIP'ler ya da Web Share ile paylaşır. Düzenlemeler hiçbir satırı değiştirmez: yeni yorum sürümü ve yeni gönderi sürümü açar. Böylece arşivdeki her sürüm aynı şablon ve aynı metinlerle aynı pikselleri verir.

**Tech Stack:** Faz 0–1 yığını + Remotion 4.0.529 (`remotion`, `@remotion/player`, `@remotion/web-renderer`, `@remotion/google-fonts`, geliştirme için `@remotion/cli`), `fflate` 0.8.3, shadcn `textarea`, Magic UI `animated-circular-progress-bar`.

**Spec:** `docs/superpowers/specs/2026-09-25-burc-studio-design.md` (Faz 2 satırı ve §2, §3, §4, §5)

## Global Constraints

- Faz 0 ve Faz 1'in tüm Global Constraints maddeleri geçerli (Node 24.x, npm, Next 16 `proxy.ts`, Türkçe arayüz, `connection()`, `src/components/ui/**` vendor, commit biçimi, `src/db/schema.ts` göreli import).
- Çalışma dalı `faz-2-carousel`. Başlangıç noktası `main` (98a788d).
- Remotion paketlerinin hepsi aynı sürümde ve `--save-exact` ile kurulur: `4.0.529`.
- Kompozisyon kuralları (tarayıcıda render yalnızca bir CSS alt kümesini destekler):
  - Yalnızca satır içi `style` ve şablon token'ları kullanılır. Tailwind sınıfı yoktur.
  - `z-index`, `backdrop-filter`, `mix-blend-mode`, `perspective`, radyal gradyan ve CSS `filter` kullanılmaz (Safari'de filtre çalışmaz). Katman sırası DOM sırasıdır.
  - `text-transform` kullanılmaz. Büyük harfli Türkçe metinler önceden `toLocaleUpperCase('tr-TR')` ile hazırlanır.
  - Burç, yıldız ve ışıltı çizimleri satır içi SVG path'tir.
  - Animasyon yoktur. Slayt 1 kare, 30 fps'tir.
- Fontlar `@remotion/google-fonts` ile yüklenir: Fraunces (500, 600) ve Nunito (400, 600, 700), alt kümeler `['latin', 'latin-ext']`. Render'dan önce `waitForFonts()` beklenir.
- Ölçüler: `4x5` → 1080×1350, `3x4` → 1080×1440. JPEG kalitesi `0.92`.
- Slayt sırası: 0 kapak, 1–12 burçlar (Koç → Balık), 13 kapanış (CTA).
- Dosya adları:
  - Slayt: `YYYY-MM-DD_<kitle>-burc_NN-<kapak|burç-slug|kapanis>.jpg`, örneğin `2026-09-26_kadin-burc_06-aslan.jpg`.
  - ZIP: `YYYY-MM-DD_<kitle>-burc.zip`. ZIP'in içinde 14 JPEG ve `caption.txt` bulunur.
  - `caption.txt` = caption + boş satır + boşlukla ayrılmış hashtagler.
- Şablon verisi kendi kendine yeter: `SlideProps` sunucuda gönderi sürümünün bağlı yorum sürümlerinden üretilir. Şablon yalnızca bu veriyi ve fontları okur. Şablon `post.templateVersion` ile `getTemplate()` üzerinden seçilir.
- Düzenleme hiçbir satırı değiştirmez:
  - Değişen her burç için yeni yorum sürümü açılır (`edited_at` dolu, sağlayıcı ve model bilgisi korunur) ve yeni gönderi sürümü oluşturulur.
  - Yalnızca güncel sürüm düzenlenebilir. Eski sürümler salt okunurdur ama indirilebilir.
- Elle düzenleme sınırları (grafem sayısı, boş olamaz):

  | Alan | En fazla | Ek kural |
  |---|---|---|
  | kapak cümlesi | 60 | |
  | caption | 700 | `#` içermez |
  | başlık | 40 | |
  | yorum | 420 | |
  | kısa metin | 140 | |
  | hashtag | 5 adet | `normalizeHashtag` ile normalize edilir, tekrarlar atılır |

- Filigran yalnızca `watermark.enabled` açıkken ve kullanıcı adı doluyken görünür.
  - Kapanış slaytında filigran yoktur. Orada kullanıcı adı büyük yazılır.
  - Marka bilgisi render anındaki ayarlardan gelir. Gönderiye dondurulmaz. Birebir yeniden üretim, ayarlar değişmediği sürece geçerlidir.
- Durum kuralları:
  - ZIP indirilince ya da paylaşım tamamlanınca durum `indirildi` olur. `paylasildi` durumu korunur.
  - "Paylaşıldı" durumunu kullanıcı açıp kapatır.
  - `hazir` durumu Faz 2'de kullanılmaz.
- Tarayıcıda render desteği: Chrome 94+, Safari 26+, Firefox 130+. Render sırasında sekme ön planda tutulmalı. Remotion her render'da telemetri gönderir (bireysel kullanım ücretsiz).

## Review Focus

1. **En uzun metin:** 420 grafemlik, uzun Türkçe kelimeli ve 2 emojili yorum ile 40 karakterlik başlık 4:5'te de 3:4'te de kartına kırpılmadan sığmalı. → Task 8 E2E (`[data-slot="body"]` için `scrollHeight <= clientHeight`, iki formatta).
2. **Türkçe glifler:** ğ ş ı İ ö ü ç, yedek sistem fontuyla değil, yüklenen Fraunces ve Nunito `latin-ext` alt kümesiyle çizilmeli. → Task 8 E2E (`document.fonts` içinde `U+0100` aralıklı ve yüklenmiş yüz).
3. **Eski sürümü düzenleme girişimi:** Eski sürüm düzenlenmeye çalışılırsa 409 dönmeli ve güncel sürümün kimliği verilmeli. Eski temelden yeni sürüm açılmamalı. → Task 7 birim testleri.
4. **Kullanıcının yazdığı hashtagler:** 5'ten fazla, `#`'siz, tekrarlı ya da `İkizler` gibi büyük harfli girişler normalize edilmeli, tekrarlar atılmalı, 5 sınırı hata vermeli. Hashtag içeren caption reddedilmeli. → Task 7 birim testleri.
5. **Birebir yeniden üretim:** Arşivden açılan eski sürüm, ilk indirmedeki JPEG'lerle bayt bayt aynı dosyaları vermeli. Sonradan açılan yeni sürüm eski sürümün görsellerini değiştirmemeli. → Task 9 E2E (SHA-256 karşılaştırması).

## Dosya yapısı

```
src/remotion/
  slide-types.ts            SlideProps, FORMAT_SIZES (istemci+sunucu, yalnızca tip ve sabit)
  fixtures.ts               Studio, birim ve E2E testleri için örnek veriler
  index.ts, Root.tsx        Remotion Studio girişi
  templates/index.ts        getTemplate(sürüm) kaydı
  templates/pastel-v1/      tokens, fonts, zodiac, ornaments, watermark, cover/sign/cta slaytları, slide
src/lib/render/             file-names, caption, zip (saf) · render-images, deliver (tarayıcı)
src/lib/posts/              repository, slide-props, draft, edit-schema, edit, summary, http
src/components/post/        slide-thumbnail, slide-strip, char-field, slide-editor, export-panel, post-workspace
src/app/(app)/gonderi/[id]/page.tsx · src/app/(app)/arsiv/page.tsx
src/app/api/posts/[id]/route.ts · src/app/api/posts/[id]/status/route.ts
src/test/posts.ts           gönderi fixture'ı
e2e/jpeg.ts, e2e/post.spec.ts, e2e/archive.spec.ts
remotion.config.ts
```

---

### Task 1: Remotion bağımlılıkları, slayt veri tipleri ve dışa aktarım yardımcıları

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/remotion/slide-types.ts`, `src/remotion/fixtures.ts`, `src/lib/render/file-names.ts`, `src/lib/render/caption.ts`, `src/lib/render/zip.ts`
- Test: `src/remotion/fixtures.test.ts`, `src/lib/render/file-names.test.ts`, `src/lib/render/caption.test.ts`, `src/lib/render/zip.test.ts`

**Interfaces:**
- Consumes: `PostFormat` (`src/db/schema.ts`), `Audience`, `ReadingKind`, `ReadingAudience` (`src/lib/content/types.ts`), `WatermarkPosition` (`src/lib/settings/schema.ts`), `SignSlug`, `Element`, `getSign` (`src/lib/zodiac/signs.ts`), `getLuckyColor` (`src/lib/content/lucky-colors.ts`), `DateKey`
- Produces:
```ts
// src/remotion/slide-types.ts
export type { PostFormat };
export const FORMAT_SIZES: Record<PostFormat, { width: number; height: number }>;
export const SLIDE_FPS = 30;
export type BrandProps = { handle: string | null; enabled: boolean; position: WatermarkPosition; opacity: number };
export type CoverSlideData = { type: 'cover'; audience: Audience; dateLabel: string; hook: string };
export type SignSlideData = { type: 'sign'; audience: Audience; dateLabel: string; sign: SignSlug; signName: string; dateRange: string; element: Element; headline: string; body: string; scores: { love: number; money: number; health: number }; luckyColor: { name: string; hex: string }; luckyNumber: number };
export type CtaSlideData = { type: 'cta'; audience: Audience };
export type SlideData = CoverSlideData | SignSlideData | CtaSlideData;
export type SlideProps = { slide: SlideData; brand: BrandProps; format: PostFormat };
// src/remotion/fixtures.ts
export const SAMPLE_BRAND: BrandProps; export const SAMPLE_BODY: string; export const LONGEST_BODY: string;
export const SAMPLE_COVER: CoverSlideData; export const SAMPLE_CTA: CtaSlideData;
export function sampleSign(slug?: SignSlug, audience?: Audience): SignSlideData;
export function sampleProps(slide: SlideData, overrides?: Partial<Omit<SlideProps, 'slide'>>): SlideProps;
// src/lib/render/file-names.ts
export const CAPTION_FILE_NAME = 'caption.txt';
export function postBaseName(post: { date: DateKey; kind: ReadingKind; audience: ReadingAudience }): string;
export function slideFileName(baseName: string, index: number, slide: SlideData): string;
export function zipFileName(baseName: string): string;
// src/lib/render/caption.ts
export function formatCaption(caption: string, hashtags: readonly string[]): string;
// src/lib/render/zip.ts
export type ZipEntry = { name: string; data: Uint8Array };
export function buildZip(entries: readonly ZipEntry[]): Uint8Array;
```

- [ ] **Step 1: Paketleri kur**

```bash
npm install --save-exact remotion@4.0.529 @remotion/player@4.0.529 @remotion/web-renderer@4.0.529 @remotion/google-fonts@4.0.529 fflate@0.8.3
npm install --save-exact --save-dev @remotion/cli@4.0.529
```
Expected: `package.json` içinde beş bağımlılık ve bir geliştirme bağımlılığı `^` olmadan yer alır.

- [ ] **Step 2: Başarısız testleri yaz**

`src/remotion/fixtures.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { countEmoji, graphemeLength } from '@/lib/text/turkish';
import { LONGEST_BODY, SAMPLE_BODY, SAMPLE_COVER, sampleProps, sampleSign } from './fixtures';

describe('örnek slayt verileri', () => {
  it('metin uzunlukları tasarımın sınır durumlarını kapsar', () => {
    expect(graphemeLength(SAMPLE_BODY)).toBe(310);
    expect(graphemeLength(LONGEST_BODY)).toBe(420);
    expect(countEmoji(LONGEST_BODY)).toBe(2);
    expect(graphemeLength(SAMPLE_COVER.hook)).toBeLessThanOrEqual(60);
  });

  it('burç örneği burç verisinden, varsayılan props 4:5 formattan gelir', () => {
    expect(sampleSign('oglak', 'erkek')).toMatchObject({ signName: 'Oğlak', dateRange: '22 Aralık – 19 Ocak', element: 'toprak', audience: 'erkek' });
    expect(sampleProps(SAMPLE_COVER)).toMatchObject({ format: '4x5', brand: { handle: 'burc.studio', enabled: true } });
    expect(sampleProps(SAMPLE_COVER, { format: '3x4' }).format).toBe('3x4');
  });
});
```

`src/lib/render/file-names.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SAMPLE_COVER, SAMPLE_CTA, sampleSign } from '@/remotion/fixtures';
import { CAPTION_FILE_NAME, postBaseName, slideFileName, zipFileName } from './file-names';

describe('dosya adları', () => {
  const base = postBaseName({ date: '2026-09-26', kind: 'horoscope', audience: 'kadin' });

  it('gönderi, slayt ve ZIP adlarını tarih, kitle ve sıra numarasıyla üretir', () => {
    expect(base).toBe('2026-09-26_kadin-burc');
    expect(slideFileName(base, 0, SAMPLE_COVER)).toBe('2026-09-26_kadin-burc_01-kapak.jpg');
    expect(slideFileName(base, 5, sampleSign('aslan'))).toBe('2026-09-26_kadin-burc_06-aslan.jpg');
    expect(slideFileName(base, 13, SAMPLE_CTA)).toBe('2026-09-26_kadin-burc_14-kapanis.jpg');
    expect(zipFileName(base)).toBe('2026-09-26_kadin-burc.zip');
    expect(CAPTION_FILE_NAME).toBe('caption.txt');
  });

  it('özel ve tarot türleri kendi ekini alır', () => {
    expect(postBaseName({ date: '2026-10-01', kind: 'tarot', audience: 'erkek' })).toBe('2026-10-01_erkek-tarot');
    expect(postBaseName({ date: '2026-10-01', kind: 'special', audience: 'genel' })).toBe('2026-10-01_genel-ozel');
  });
});
```

`src/lib/render/caption.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatCaption } from './caption';

describe('formatCaption', () => {
  it('caption ile hashtagleri boş satırla ayırır', () => {
    expect(formatCaption('  Günün yorumları hazır!  ', ['#burç', '#astroloji'])).toBe('Günün yorumları hazır!\n\n#burç #astroloji');
  });

  it('hashtag yoksa yalnızca caption döner', () => {
    expect(formatCaption('Sadece metin', [])).toBe('Sadece metin');
  });
});
```

`src/lib/render/zip.test.ts`:
```ts
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildZip } from './zip';

describe('buildZip', () => {
  it('dosyaları adlarıyla ve içerikleriyle paketler', () => {
    const files = unzipSync(
      buildZip([
        { name: 'a.jpg', data: new Uint8Array([1, 2, 3]) },
        { name: 'caption.txt', data: new TextEncoder().encode('Merhaba ğüşıöç') },
      ]),
    );
    expect(Object.keys(files)).toEqual(['a.jpg', 'caption.txt']);
    expect([...files['a.jpg']]).toEqual([1, 2, 3]);
    expect(new TextDecoder().decode(files['caption.txt'])).toBe('Merhaba ğüşıöç');
  });

  it('aynı adlı iki dosyayı reddeder', () => {
    const entry = { name: 'a.jpg', data: new Uint8Array([1]) };
    expect(() => buildZip([entry, entry])).toThrow('Aynı adlı iki dosya: a.jpg');
  });
});
```

- [ ] **Step 3: Testlerin başarısız olduğunu gör**

Run: `npx vitest run src/remotion src/lib/render`
Expected: FAIL. `./fixtures`, `./file-names`, `./caption` ve `./zip` bulunamaz.

- [ ] **Step 4: Uygulamayı yaz**

`src/remotion/slide-types.ts`:
```ts
import type { PostFormat } from '@/db/schema';
import type { Audience } from '@/lib/content/types';
import type { WatermarkPosition } from '@/lib/settings/schema';
import type { Element, SignSlug } from '@/lib/zodiac/signs';

export type { PostFormat };

export const FORMAT_SIZES: Record<PostFormat, { width: number; height: number }> = {
  '4x5': { width: 1080, height: 1350 },
  '3x4': { width: 1080, height: 1440 },
};

export const SLIDE_FPS = 30;

export type BrandProps = { handle: string | null; enabled: boolean; position: WatermarkPosition; opacity: number };

export type CoverSlideData = { type: 'cover'; audience: Audience; dateLabel: string; hook: string };

export type SignSlideData = {
  type: 'sign';
  audience: Audience;
  dateLabel: string;
  sign: SignSlug;
  signName: string;
  dateRange: string;
  element: Element;
  headline: string;
  body: string;
  scores: { love: number; money: number; health: number };
  luckyColor: { name: string; hex: string };
  luckyNumber: number;
};

export type CtaSlideData = { type: 'cta'; audience: Audience };

export type SlideData = CoverSlideData | SignSlideData | CtaSlideData;

export type SlideProps = { slide: SlideData; brand: BrandProps; format: PostFormat };
```

`src/remotion/fixtures.ts`:
```ts
import { getLuckyColor } from '@/lib/content/lucky-colors';
import type { Audience } from '@/lib/content/types';
import { getSign, type SignSlug } from '@/lib/zodiac/signs';
import type { BrandProps, CoverSlideData, CtaSlideData, SignSlideData, SlideData, SlideProps } from './slide-types';

const graphemes = new Intl.Segmenter('tr', { granularity: 'grapheme' });

function cutGraphemes(text: string, count: number): string {
  return [...graphemes.segment(text)]
    .slice(0, count)
    .map((part) => part.segment)
    .join('');
}

export const SAMPLE_BRAND: BrandProps = { handle: 'burc.studio', enabled: true, position: 'bottom-center', opacity: 0.55 };

export const SAMPLE_BODY =
  'Bugün içindeki cesur ses her zamankinden daha net konuşuyor. Uzun süredir ertelediğin o küçük adımı atmak için gökyüzü sana göz kırpıyor; bir arkadaşının önerisi aklına yepyeni bir fikir düşürebilir. Akşamüstü kendine sakin bir yürüyüş hediye et ve günün yorgunluğunu şehrin ışıklarıyla birlikte geride bırak ✨';

export const LONGEST_BODY = `${cutGraphemes(
  `🌕 ${'Çağırılmayacaklarımızdanmışsınız gibi davranmak yerine içindeki güçlü sesi dinle ve cesaretini göster; '.repeat(6)}`,
  418,
).trimEnd()} ✨`;

export const SAMPLE_COVER: CoverSlideData = {
  type: 'cover',
  audience: 'kadin',
  dateLabel: '26 EYLÜL 2026 CUMARTESİ',
  hook: 'Koç dolunayı geldi, sen hazır mısın? 🌕',
};

export const SAMPLE_CTA: CtaSlideData = { type: 'cta', audience: 'kadin' };

export function sampleSign(slug: SignSlug = 'koc', audience: Audience = 'kadin'): SignSlideData {
  const sign = getSign(slug);
  const color = getLuckyColor('lila');
  return {
    type: 'sign',
    audience,
    dateLabel: '26 EYLÜL',
    sign: slug,
    signName: sign.name,
    dateRange: sign.dateRange,
    element: sign.element,
    headline: 'Işıltılı ve cesur bir gün',
    body: SAMPLE_BODY,
    scores: { love: 4, money: 3, health: 5 },
    luckyColor: { name: color.name, hex: color.hex },
    luckyNumber: 7,
  };
}

export function sampleProps(slide: SlideData, overrides: Partial<Omit<SlideProps, 'slide'>> = {}): SlideProps {
  return { slide, brand: SAMPLE_BRAND, format: '4x5', ...overrides };
}
```

`src/lib/render/file-names.ts`:
```ts
import type { ReadingAudience, ReadingKind } from '@/lib/content/types';
import type { DateKey } from '@/lib/date/istanbul';
import type { SlideData } from '@/remotion/slide-types';

const KIND_SLUGS: Record<ReadingKind, string> = { horoscope: 'burc', tarot: 'tarot', special: 'ozel' };

export const CAPTION_FILE_NAME = 'caption.txt';

export function postBaseName(post: { date: DateKey; kind: ReadingKind; audience: ReadingAudience }): string {
  return `${post.date}_${post.audience}-${KIND_SLUGS[post.kind]}`;
}

function slideSuffix(slide: SlideData): string {
  if (slide.type === 'cover') return 'kapak';
  if (slide.type === 'cta') return 'kapanis';
  return slide.sign;
}

export function slideFileName(baseName: string, index: number, slide: SlideData): string {
  return `${baseName}_${String(index + 1).padStart(2, '0')}-${slideSuffix(slide)}.jpg`;
}

export function zipFileName(baseName: string): string {
  return `${baseName}.zip`;
}
```

`src/lib/render/caption.ts`:
```ts
export function formatCaption(caption: string, hashtags: readonly string[]): string {
  const text = caption.trim();
  return hashtags.length > 0 ? `${text}\n\n${hashtags.join(' ')}` : text;
}
```

`src/lib/render/zip.ts`:
```ts
import { zipSync, type Zippable } from 'fflate';

export type ZipEntry = { name: string; data: Uint8Array };

export function buildZip(entries: readonly ZipEntry[]): Uint8Array {
  const tree: Zippable = {};
  for (const entry of entries) {
    if (entry.name in tree) throw new Error(`Aynı adlı iki dosya: ${entry.name}`);
    // JPEG zaten sıkıştırılmış; tekrar sıkıştırmak yalnızca süre harcar.
    tree[entry.name] = [entry.data, { level: 0 }];
  }
  return zipSync(tree);
}
```

- [ ] **Step 5: Testlerin geçtiğini gör**

Run: `npx vitest run src/remotion src/lib/render && npm run typecheck && npm run lint`
Expected: PASS (4 dosya, 8 test).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/remotion src/lib/render
git commit -m "feat: Remotion paketleri, slayt veri tipleri ve dışa aktarım yardımcıları" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Gönderi deposu — ayrıntı, sürümler, arşiv ve durum

**Files:**
- Modify: `src/lib/content/repository.ts` (`NewReading` içine `editedAt?`), `src/lib/content/repository.test.ts`
- Create: `src/test/posts.ts`, `src/lib/posts/repository.ts`
- Test: `src/lib/posts/repository.test.ts`

**Interfaces:**
- Consumes: `saveReadings`, `createPostVersion`, `NewReading`, `PostRow`, `ReadingRow`, `SlideRow`, `ReadingKey` (Faz 1 `src/lib/content/repository.ts`); `posts`, `postSlides`, `readings` (`src/db/schema.ts`); `createTestDb`
- Produces:
```ts
// src/lib/content/repository.ts
export type NewReading = { ...; editedAt?: Date };
// src/test/posts.ts
export function sampleReading(sign: SignSlug): NewReading;
export async function seedPost(db: Db, key: ReadingKey, overrides?: { caption?: string; hook?: string }): Promise<PostRow>;
// src/lib/posts/repository.ts
export type PostStatus = PostRow['status'];
export type SlideWithReading = SlideRow & { reading: ReadingRow | null };
export type PostDetail = { post: PostRow; slides: SlideWithReading[] };
export type PostVersion = Pick<PostRow, 'id' | 'version' | 'isCurrent' | 'status' | 'createdAt'>;
export type ArchiveFilter = { kind?: ReadingKind; audience?: ReadingAudience; status?: PostStatus; before?: DateKey; limit: number };
export function isPostId(value: string): boolean;
export async function getPostDetail(db: Db, id: string): Promise<PostDetail | null>;
export async function getPostVersions(db: Db, key: ReadingKey): Promise<PostVersion[]>; // sürüm azalan
export async function listArchivePosts(db: Db, filter: ArchiveFilter): Promise<PostRow[]>; // yalnızca güncel, tarih azalan, kitle artan
export async function markPostDownloaded(db: Db, id: string, now?: Date): Promise<PostRow | null>;
export async function setPostPublished(db: Db, id: string, published: boolean, now?: Date): Promise<PostRow | null>;
```

- [ ] **Step 1: Başarısız testleri yaz**

`src/test/posts.ts`:
```ts
import type { Db } from '@/db/types';
import { createPostVersion, saveReadings, type NewReading, type PostRow, type ReadingKey } from '@/lib/content/repository';
import { SIGN_SLUGS, type SignSlug } from '@/lib/zodiac/signs';

export function sampleReading(sign: SignSlug): NewReading {
  return {
    sign,
    headline: `${sign} başlık`,
    body: `${sign} yorum`,
    short: `${sign} kısa`,
    meta: { scores: { love: 4, money: 3, health: 5 }, luckyColor: 'lila', luckyNumber: 7 },
    provider: 'mock',
    model: 'mock',
    promptVersion: 'burc-v1',
    runId: null,
  };
}

export async function seedPost(db: Db, key: ReadingKey, overrides: { caption?: string; hook?: string } = {}): Promise<PostRow> {
  const saved = await saveReadings(db, key, SIGN_SLUGS.map(sampleReading));
  return createPostVersion(db, {
    ...key,
    templateVersion: 'pastel@1',
    format: '4x5',
    cover: { hook: overrides.hook ?? 'Kanca' },
    caption: overrides.caption ?? 'Caption',
    hashtags: ['#burç'],
    signReadingIds: saved.map((row) => row.id),
  });
}
```

`src/lib/content/repository.test.ts` içindeki `describe('okuma sürümleri', …)` bloğunun sonuna ekle:
```ts
  it('elle düzenleme zamanını saklar', async () => {
    const editedAt = new Date('2026-09-26T08:00:00Z');
    const [row] = await saveReadings(db, KEY, [{ ...reading('koc'), editedAt }]);
    expect(row.editedAt).toEqual(editedAt);
  });
```

`src/lib/posts/repository.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { getPostDetail, getPostVersions, isPostId, listArchivePosts, markPostDownloaded, setPostPublished } from './repository';

const KEY = { date: '2026-09-26', kind: 'horoscope' as const, audience: 'kadin' as const };
const T1 = new Date('2026-09-26T09:00:00Z');
const T2 = new Date('2026-09-26T10:00:00Z');

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('getPostDetail', () => {
  it('slaytları sırayla ve bağlı yorum sürümleriyle döner', async () => {
    const post = await seedPost(db, KEY);
    const detail = await getPostDetail(db, post.id);
    expect(detail?.post.id).toBe(post.id);
    expect(detail?.slides.map((slide) => slide.position)).toEqual([...Array(14).keys()]);
    expect(detail?.slides[0].reading).toBeNull();
    expect(detail?.slides[13].reading).toBeNull();
    expect(detail?.slides[1].reading).toMatchObject({ sign: 'koc', headline: 'koc başlık', version: 1 });
    expect(detail?.slides[12].reading?.sign).toBe('balik');
  });

  it('bilinmeyen ya da biçimsiz kimlikte null döner', async () => {
    expect(isPostId('abc')).toBe(false);
    expect(await getPostDetail(db, 'abc')).toBeNull();
    expect(await getPostDetail(db, '00000000-0000-4000-8000-000000000000')).toBeNull();
  });
});

describe('getPostVersions', () => {
  it('bir gönderinin tüm sürümlerini yeniden eskiye döner', async () => {
    const first = await seedPost(db, KEY);
    const second = await seedPost(db, KEY);
    expect((await getPostVersions(db, KEY)).map(({ id, version, isCurrent }) => ({ id, version, isCurrent }))).toEqual([
      { id: second.id, version: 2, isCurrent: true },
      { id: first.id, version: 1, isCurrent: false },
    ]);
  });
});

describe('listArchivePosts', () => {
  it('yalnızca güncel sürümleri tarih ve kitleye göre sıralar, süzer ve sınırlar', async () => {
    const older = await seedPost(db, { ...KEY, date: '2026-09-25' });
    await seedPost(db, KEY);
    const current = await seedPost(db, KEY);
    const erkek = await seedPost(db, { ...KEY, audience: 'erkek' });
    // audience bir Postgres enum'u; sıralama tanım sırasına göredir (kadin, erkek, genel).
    expect((await listArchivePosts(db, { limit: 10 })).map((post) => post.id)).toEqual([current.id, erkek.id, older.id]);
    expect((await listArchivePosts(db, { audience: 'kadin', limit: 10 })).map((post) => post.id)).toEqual([current.id, older.id]);
    expect((await listArchivePosts(db, { before: '2026-09-26', limit: 10 })).map((post) => post.id)).toEqual([older.id]);
    expect(await listArchivePosts(db, { limit: 1 })).toHaveLength(1);
    await markPostDownloaded(db, older.id, T1);
    expect((await listArchivePosts(db, { status: 'indirildi', kind: 'horoscope', limit: 10 })).map((post) => post.id)).toEqual([older.id]);
  });
});

describe('gönderi durumu', () => {
  it('indirme ve paylaşım işaretlerini yönetir, paylaşılmış gönderiyi indirme geri almaz', async () => {
    const post = await seedPost(db, KEY);
    expect(await markPostDownloaded(db, post.id, T1)).toMatchObject({ status: 'indirildi', downloadedAt: T1 });
    expect(await setPostPublished(db, post.id, true, T2)).toMatchObject({ status: 'paylasildi', publishedAt: T2 });
    expect(await markPostDownloaded(db, post.id, T2)).toMatchObject({ status: 'paylasildi', downloadedAt: T2 });
    expect(await setPostPublished(db, post.id, false, T2)).toMatchObject({ status: 'indirildi', publishedAt: null });
  });

  it('hiç indirilmemiş gönderide paylaşım geri alınınca taslağa döner; bilinmeyen kimlikte null', async () => {
    const post = await seedPost(db, KEY);
    await setPostPublished(db, post.id, true, T1);
    expect(await setPostPublished(db, post.id, false, T2)).toMatchObject({ status: 'taslak', publishedAt: null });
    expect(await markPostDownloaded(db, '00000000-0000-4000-8000-000000000000')).toBeNull();
    expect(await setPostPublished(db, 'abc', true)).toBeNull();
  });
});
```

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `npx vitest run src/lib/posts && npm run typecheck`
Expected:
- vitest FAIL: `./repository` bulunamaz.
- typecheck FAIL: `repository.test.ts` içindeki `editedAt`, `NewReading` tipinde yok (fazla özellik hatası). Çalışma zamanında satır zaten yazılabildiği için bu testin kırmızısı tip kontrolüdür.

- [ ] **Step 3: Uygulamayı yaz**

`src/lib/content/repository.ts` içindeki `NewReading` tipine son alan olarak ekle:
```ts
  editedAt?: Date;
```

`src/lib/posts/repository.ts`:
```ts
import { and, asc, desc, eq, lt, type SQL } from 'drizzle-orm';
import { postSlides, posts, readings } from '@/db/schema';
import type { Db } from '@/db/types';
import type { PostRow, ReadingKey, ReadingRow, SlideRow } from '@/lib/content/repository';
import type { ReadingAudience, ReadingKind } from '@/lib/content/types';
import type { DateKey } from '@/lib/date/istanbul';

export type PostStatus = PostRow['status'];
export type SlideWithReading = SlideRow & { reading: ReadingRow | null };
export type PostDetail = { post: PostRow; slides: SlideWithReading[] };
export type PostVersion = Pick<PostRow, 'id' | 'version' | 'isCurrent' | 'status' | 'createdAt'>;
export type ArchiveFilter = {
  kind?: ReadingKind;
  audience?: ReadingAudience;
  status?: PostStatus;
  before?: DateKey;
  limit: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// URL'den gelen kimlik uuid değilse Postgres sorguyu 22P02 ile düşürür; önce biçim denetlenir.
export function isPostId(value: string): boolean {
  return UUID.test(value);
}

async function findPost(db: Db, id: string): Promise<PostRow | null> {
  if (!isPostId(id)) return null;
  const [post] = await db.select().from(posts).where(eq(posts.id, id));
  return post ?? null;
}

export async function getPostDetail(db: Db, id: string): Promise<PostDetail | null> {
  const post = await findPost(db, id);
  if (!post) return null;
  const rows = await db
    .select({ slide: postSlides, reading: readings })
    .from(postSlides)
    .leftJoin(readings, eq(postSlides.readingId, readings.id))
    .where(eq(postSlides.postId, id))
    .orderBy(asc(postSlides.position));
  return { post, slides: rows.map(({ slide, reading }) => ({ ...slide, reading })) };
}

export async function getPostVersions(db: Db, key: ReadingKey): Promise<PostVersion[]> {
  return db
    .select({ id: posts.id, version: posts.version, isCurrent: posts.isCurrent, status: posts.status, createdAt: posts.createdAt })
    .from(posts)
    .where(and(eq(posts.date, key.date), eq(posts.kind, key.kind), eq(posts.audience, key.audience)))
    .orderBy(desc(posts.version));
}

export async function listArchivePosts(db: Db, filter: ArchiveFilter): Promise<PostRow[]> {
  const conditions: SQL[] = [eq(posts.isCurrent, true)];
  if (filter.kind) conditions.push(eq(posts.kind, filter.kind));
  if (filter.audience) conditions.push(eq(posts.audience, filter.audience));
  if (filter.status) conditions.push(eq(posts.status, filter.status));
  if (filter.before) conditions.push(lt(posts.date, filter.before));
  return db
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.date), asc(posts.audience))
    .limit(filter.limit);
}

export async function markPostDownloaded(db: Db, id: string, now: Date = new Date()): Promise<PostRow | null> {
  const post = await findPost(db, id);
  if (!post) return null;
  const [updated] = await db
    .update(posts)
    .set({ downloadedAt: now, status: post.status === 'paylasildi' ? 'paylasildi' : 'indirildi' })
    .where(eq(posts.id, id))
    .returning();
  return updated;
}

export async function setPostPublished(db: Db, id: string, published: boolean, now: Date = new Date()): Promise<PostRow | null> {
  const post = await findPost(db, id);
  if (!post) return null;
  const [updated] = await db
    .update(posts)
    .set(
      published
        ? { status: 'paylasildi', publishedAt: now }
        : { status: post.downloadedAt ? 'indirildi' : 'taslak', publishedAt: null },
    )
    .where(eq(posts.id, id))
    .returning();
  return updated;
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npx vitest run src/lib/posts src/lib/content/repository.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/test/posts.ts src/lib/posts src/lib/content/repository.ts src/lib/content/repository.test.ts
git commit -m "feat: gönderi ayrıntısı, sürüm listesi, arşiv sorgusu ve indirme/paylaşım durumu" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Slayt verisi, düzenleme taslağı ve istemci özetleri

**Files:**
- Create: `src/lib/posts/slide-props.ts`, `src/lib/posts/edit-schema.ts`, `src/lib/posts/draft.ts`, `src/lib/posts/summary.ts`
- Test: `src/lib/posts/slide-props.test.ts`, `src/lib/posts/draft.test.ts`, `src/lib/posts/summary.test.ts`

**Interfaces:**
- Consumes: Task 1 (`SlideProps`, `BrandProps`, fixtures); Task 2 (`PostDetail`, `PostVersion`, `PostStatus`, `seedPost`, `getPostDetail`); `Settings`, `DEFAULT_SETTINGS`; `getSign`, `getLuckyColor`, `formatDateLongTr`, `formatDateShortTr`
- Produces:
```ts
// src/lib/posts/slide-props.ts (istemci güvenli: veritabanı importu yok)
export function audienceOf(post: Pick<PostRow, 'audience'>): Audience;
export function brandFromSettings(settings: Settings): BrandProps;
export function buildCoverProps(post: PostRow, brand: BrandProps): SlideProps;
export function buildSlideProps(detail: PostDetail, brand: BrandProps): SlideProps[];
// src/lib/posts/edit-schema.ts
export const EDIT_LIMITS: { coverHook: 60; caption: 700; headline: 40; body: 420; short: 140 };
export const postEditSchema; export type PostEdit = { format?: PostFormat; coverHook?: string; caption?: string; hashtags?: string[]; signs?: { sign: SignSlug; headline: string; body: string; short: string }[] };
// src/lib/posts/draft.ts
export type SignText = { headline: string; body: string; short: string };
export type DraftSource = { format: PostFormat; hook: string; caption: string; hashtags: string[]; signs: ({ sign: SignSlug } & SignText)[] };
export type PostDraft = { format: PostFormat; hook: string; caption: string; hashtags: string; signs: Partial<Record<SignSlug, SignText>> };
export function createDraft(source: DraftSource): PostDraft;
export function parseHashtagInput(text: string): string[];
export function draftToEdit(source: DraftSource, draft: PostDraft): PostEdit;
export function isEmptyEdit(edit: PostEdit): boolean;
export function applyDraft(slides: readonly SlideProps[], draft: PostDraft): SlideProps[];
// src/lib/posts/summary.ts
export type PostSummary = { id: string; date: DateKey; kind: ReadingKind; audience: Audience; version: number; isCurrent: boolean; status: PostStatus; templateVersion: string; format: PostFormat; caption: string; hashtags: string[]; downloadedAt: string | null; publishedAt: string | null };
export type VersionSummary = { id: string; version: number; isCurrent: boolean; status: PostStatus; createdAt: string };
export const STATUS_LABELS: Record<PostStatus, string>;
export function toPostSummary(post: PostRow): PostSummary;
export function toVersionSummary(version: PostVersion): VersionSummary;
export function toDraftSource(detail: PostDetail): DraftSource;
```

- [ ] **Step 1: Başarısız testleri yaz**

`src/lib/posts/slide-props.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { DEFAULT_SETTINGS } from '@/lib/settings/schema';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { getPostDetail } from './repository';
import { audienceOf, brandFromSettings, buildCoverProps, buildSlideProps } from './slide-props';

const KEY = { date: '2026-09-26', kind: 'horoscope' as const, audience: 'kadin' as const };
const BRAND = brandFromSettings({ ...DEFAULT_SETTINGS, instagramHandle: 'burc.studio' });

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('buildSlideProps', () => {
  it('gönderi sürümünden 14 slaytlık, kendi kendine yeten veri üretir', async () => {
    const post = await seedPost(db, KEY);
    const props = buildSlideProps((await getPostDetail(db, post.id))!, BRAND);
    expect(props).toHaveLength(14);
    expect(props[0]).toEqual({
      format: '4x5',
      brand: { handle: 'burc.studio', enabled: true, position: 'bottom-center', opacity: 0.55 },
      slide: { type: 'cover', audience: 'kadin', dateLabel: '26 EYLÜL 2026 CUMARTESİ', hook: 'Kanca' },
    });
    expect(props[1].slide).toEqual({
      type: 'sign',
      audience: 'kadin',
      dateLabel: '26 EYLÜL',
      sign: 'koc',
      signName: 'Koç',
      dateRange: '21 Mart – 19 Nisan',
      element: 'ates',
      headline: 'koc başlık',
      body: 'koc yorum',
      scores: { love: 4, money: 3, health: 5 },
      luckyColor: { name: 'Lila', hex: '#C8B6E2' },
      luckyNumber: 7,
    });
    expect(props[13].slide).toEqual({ type: 'cta', audience: 'kadin' });
    expect(buildCoverProps(post, BRAND)).toEqual(props[0]);
  });

  it('yorumu eksik burç slaytında ve genel kitlede hata verir', async () => {
    const post = await seedPost(db, KEY);
    const detail = (await getPostDetail(db, post.id))!;
    detail.slides[3] = { ...detail.slides[3], reading: null };
    expect(() => buildSlideProps(detail, BRAND)).toThrow('Slayt 3 için yorum bulunamadı');
    expect(() => audienceOf({ audience: 'genel' })).toThrow('Genel kitleli gönderiler');
  });
});
```

`src/lib/posts/draft.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SAMPLE_COVER, SAMPLE_CTA, sampleProps, sampleSign } from '@/remotion/fixtures';
import { applyDraft, createDraft, draftToEdit, isEmptyEdit, parseHashtagInput, type DraftSource } from './draft';

const source: DraftSource = {
  format: '4x5',
  hook: 'Kanca',
  caption: 'Açıklama',
  hashtags: ['#burç', '#astroloji'],
  signs: [
    { sign: 'koc', headline: 'Koç başlık', body: 'Koç gövde', short: 'Koç kısa' },
    { sign: 'boga', headline: 'Boğa başlık', body: 'Boğa gövde', short: 'Boğa kısa' },
  ],
};

describe('düzenleme taslağı', () => {
  it('dokunulmamış taslak boş düzenleme üretir', () => {
    expect(isEmptyEdit(draftToEdit(source, createDraft(source)))).toBe(true);
  });

  it('yalnızca değişen alanları gönderir', () => {
    const draft = createDraft(source);
    const next = {
      ...draft,
      hook: 'Yeni kanca',
      format: '3x4' as const,
      hashtags: '#burç   İkizler,#yeni',
      signs: { ...draft.signs, boga: { ...draft.signs.boga!, body: 'Yeni gövde' } },
    };
    expect(draftToEdit(source, next)).toEqual({
      format: '3x4',
      coverHook: 'Yeni kanca',
      hashtags: ['#burç', 'İkizler', '#yeni'],
      signs: [{ sign: 'boga', headline: 'Boğa başlık', body: 'Yeni gövde', short: 'Boğa kısa' }],
    });
  });

  it('hashtag girişini boşluk ve virgülden böler', () => {
    expect(parseHashtagInput(' #a, b  #c ')).toEqual(['#a', 'b', '#c']);
    expect(parseHashtagInput('   ')).toEqual([]);
  });

  it('taslağı önizleme slaytlarına uygular', () => {
    const slides = [sampleProps(SAMPLE_COVER), sampleProps(sampleSign('koc')), sampleProps(SAMPLE_CTA)];
    const draft = {
      ...createDraft(source),
      hook: 'Önizleme kancası',
      format: '3x4' as const,
      signs: { koc: { headline: 'Taslak başlık', body: 'Taslak gövde', short: 'x' } },
    };
    const preview = applyDraft(slides, draft);
    expect(preview.map((props) => props.format)).toEqual(['3x4', '3x4', '3x4']);
    expect(preview[0].slide).toMatchObject({ hook: 'Önizleme kancası' });
    expect(preview[1].slide).toMatchObject({ headline: 'Taslak başlık', body: 'Taslak gövde' });
    expect(preview[2].slide).toEqual(SAMPLE_CTA);
  });
});
```

`src/lib/posts/summary.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { getPostDetail, getPostVersions } from './repository';
import { STATUS_LABELS, toDraftSource, toPostSummary, toVersionSummary } from './summary';

const KEY = { date: '2026-09-26', kind: 'horoscope' as const, audience: 'kadin' as const };

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('istemci özetleri', () => {
  it('gönderiyi JSON uyumlu özete çevirir', async () => {
    const post = await seedPost(db, KEY);
    expect(toPostSummary(post)).toEqual({
      id: post.id,
      date: '2026-09-26',
      kind: 'horoscope',
      audience: 'kadin',
      version: 1,
      isCurrent: true,
      status: 'taslak',
      templateVersion: 'pastel@1',
      format: '4x5',
      caption: 'Caption',
      hashtags: ['#burç'],
      downloadedAt: null,
      publishedAt: null,
    });
    const [version] = await getPostVersions(db, KEY);
    expect(toVersionSummary(version)).toEqual({ id: post.id, version: 1, isCurrent: true, status: 'taslak', createdAt: version.createdAt.toISOString() });
    expect(STATUS_LABELS.paylasildi).toBe('Paylaşıldı');
  });

  it('taslak kaynağını 12 burcun metinleriyle üretir', async () => {
    const post = await seedPost(db, KEY, { hook: 'Özel kanca' });
    const draft = toDraftSource((await getPostDetail(db, post.id))!);
    expect(draft).toMatchObject({ format: '4x5', hook: 'Özel kanca', caption: 'Caption', hashtags: ['#burç'] });
    expect(draft.signs).toHaveLength(12);
    expect(draft.signs[0]).toEqual({ sign: 'koc', headline: 'koc başlık', body: 'koc yorum', short: 'koc kısa' });
  });
});
```

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `npx vitest run src/lib/posts`
Expected: FAIL. `./slide-props`, `./draft` ve `./summary` bulunamaz.

- [ ] **Step 3: Uygulamayı yaz**

`src/lib/posts/slide-props.ts`:
```ts
import type { PostRow } from '@/lib/content/repository';
import { getLuckyColor } from '@/lib/content/lucky-colors';
import type { Audience } from '@/lib/content/types';
import { formatDateLongTr, formatDateShortTr } from '@/lib/date/istanbul';
import type { Settings } from '@/lib/settings/schema';
import { getSign } from '@/lib/zodiac/signs';
import type { BrandProps, SlideProps } from '@/remotion/slide-types';
import type { PostDetail } from './repository';

const upper = (text: string) => text.toLocaleUpperCase('tr-TR');

export function audienceOf(post: Pick<PostRow, 'audience'>): Audience {
  if (post.audience === 'genel') throw new Error('Genel kitleli gönderiler bu şablonda desteklenmiyor');
  return post.audience;
}

export function brandFromSettings(settings: Settings): BrandProps {
  return { handle: settings.instagramHandle, ...settings.watermark };
}

export function buildCoverProps(post: PostRow, brand: BrandProps): SlideProps {
  return {
    format: post.format,
    brand,
    slide: { type: 'cover', audience: audienceOf(post), dateLabel: upper(formatDateLongTr(post.date)), hook: post.cover.hook },
  };
}

export function buildSlideProps(detail: PostDetail, brand: BrandProps): SlideProps[] {
  const { post } = detail;
  const audience = audienceOf(post);
  return detail.slides.map((slide): SlideProps => {
    if (slide.type === 'cover') return buildCoverProps(post, brand);
    if (slide.type === 'cta') return { format: post.format, brand, slide: { type: 'cta', audience } };
    const { reading } = slide;
    if (!reading) throw new Error(`Slayt ${slide.position} için yorum bulunamadı`);
    const sign = getSign(reading.sign);
    const color = getLuckyColor(reading.meta.luckyColor);
    return {
      format: post.format,
      brand,
      slide: {
        type: 'sign',
        audience,
        dateLabel: upper(formatDateShortTr(post.date)),
        sign: sign.slug,
        signName: sign.name,
        dateRange: sign.dateRange,
        element: sign.element,
        headline: reading.headline,
        body: reading.body,
        scores: reading.meta.scores,
        luckyColor: { name: color.name, hex: color.hex },
        luckyNumber: reading.meta.luckyNumber,
      },
    };
  });
}
```

`src/lib/posts/edit-schema.ts`:
```ts
import { z } from 'zod';
import { SIGN_SLUGS } from '@/lib/zodiac/signs';

export const EDIT_LIMITS = { coverHook: 60, caption: 700, headline: 40, body: 420, short: 140 } as const;

export const postEditSchema = z.object({
  format: z.enum(['4x5', '3x4']).optional(),
  coverHook: z.string().optional(),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).max(20).optional(),
  signs: z
    .array(z.object({ sign: z.enum(SIGN_SLUGS), headline: z.string(), body: z.string(), short: z.string() }))
    .max(12)
    .optional(),
});

export type PostEdit = z.infer<typeof postEditSchema>;
```

`src/lib/posts/draft.ts`:
```ts
import type { SignSlug } from '@/lib/zodiac/signs';
import type { PostFormat, SlideProps } from '@/remotion/slide-types';
import type { PostEdit } from './edit-schema';

export type SignText = { headline: string; body: string; short: string };
export type DraftSource = { format: PostFormat; hook: string; caption: string; hashtags: string[]; signs: ({ sign: SignSlug } & SignText)[] };
export type PostDraft = { format: PostFormat; hook: string; caption: string; hashtags: string; signs: Partial<Record<SignSlug, SignText>> };

export function createDraft(source: DraftSource): PostDraft {
  return {
    format: source.format,
    hook: source.hook,
    caption: source.caption,
    hashtags: source.hashtags.join(' '),
    signs: Object.fromEntries(source.signs.map(({ sign, ...text }) => [sign, text])),
  };
}

export function parseHashtagInput(text: string): string[] {
  return text.split(/[\s,]+/).filter(Boolean);
}

export function draftToEdit(source: DraftSource, draft: PostDraft): PostEdit {
  const edit: PostEdit = {};
  if (draft.format !== source.format) edit.format = draft.format;
  if (draft.hook !== source.hook) edit.coverHook = draft.hook;
  if (draft.caption !== source.caption) edit.caption = draft.caption;
  const hashtags = parseHashtagInput(draft.hashtags);
  if (hashtags.join(' ') !== source.hashtags.join(' ')) edit.hashtags = hashtags;
  const signs = source.signs.flatMap(({ sign, ...original }) => {
    const text = draft.signs[sign] ?? original;
    const changed = text.headline !== original.headline || text.body !== original.body || text.short !== original.short;
    return changed ? [{ sign, ...text }] : [];
  });
  if (signs.length > 0) edit.signs = signs;
  return edit;
}

export function isEmptyEdit(edit: PostEdit): boolean {
  return Object.keys(edit).length === 0;
}

export function applyDraft(slides: readonly SlideProps[], draft: PostDraft): SlideProps[] {
  return slides.map((props) => {
    const { slide } = props;
    if (slide.type === 'cover') return { ...props, format: draft.format, slide: { ...slide, hook: draft.hook } };
    if (slide.type === 'sign') {
      const text = draft.signs[slide.sign];
      return { ...props, format: draft.format, slide: { ...slide, headline: text?.headline ?? slide.headline, body: text?.body ?? slide.body } };
    }
    return { ...props, format: draft.format };
  });
}
```

`src/lib/posts/summary.ts`:
```ts
import type { PostRow } from '@/lib/content/repository';
import type { Audience, ReadingKind } from '@/lib/content/types';
import type { DateKey } from '@/lib/date/istanbul';
import type { PostFormat } from '@/remotion/slide-types';
import type { DraftSource } from './draft';
import type { PostDetail, PostStatus, PostVersion } from './repository';
import { audienceOf } from './slide-props';

export type PostSummary = {
  id: string;
  date: DateKey;
  kind: ReadingKind;
  audience: Audience;
  version: number;
  isCurrent: boolean;
  status: PostStatus;
  templateVersion: string;
  format: PostFormat;
  caption: string;
  hashtags: string[];
  downloadedAt: string | null;
  publishedAt: string | null;
};

export type VersionSummary = { id: string; version: number; isCurrent: boolean; status: PostStatus; createdAt: string };

export const STATUS_LABELS: Record<PostStatus, string> = {
  taslak: 'Taslak',
  hazir: 'Hazır',
  indirildi: 'İndirildi',
  paylasildi: 'Paylaşıldı',
};

export function toPostSummary(post: PostRow): PostSummary {
  return {
    id: post.id,
    date: post.date,
    kind: post.kind,
    audience: audienceOf(post),
    version: post.version,
    isCurrent: post.isCurrent,
    status: post.status,
    templateVersion: post.templateVersion,
    format: post.format,
    caption: post.caption,
    hashtags: post.hashtags,
    downloadedAt: post.downloadedAt?.toISOString() ?? null,
    publishedAt: post.publishedAt?.toISOString() ?? null,
  };
}

export function toVersionSummary(version: PostVersion): VersionSummary {
  return { ...version, createdAt: version.createdAt.toISOString() };
}

export function toDraftSource(detail: PostDetail): DraftSource {
  return {
    format: detail.post.format,
    hook: detail.post.cover.hook,
    caption: detail.post.caption,
    hashtags: detail.post.hashtags,
    signs: detail.slides.flatMap((slide) =>
      slide.type === 'sign' && slide.reading
        ? [{ sign: slide.reading.sign, headline: slide.reading.headline, body: slide.reading.body, short: slide.reading.short }]
        : [],
    ),
  };
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npx vitest run src/lib/posts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/posts
git commit -m "feat: gönderi sürümünden slayt verisi, düzenleme taslağı ve istemci özetleri" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `pastel@1` şablonu

**Files:**
- Create: `src/remotion/templates/pastel-v1/tokens.ts`, `fonts.ts`, `zodiac.tsx`, `ornaments.tsx`, `watermark.tsx`, `cover-slide.tsx`, `sign-slide.tsx`, `cta-slide.tsx`, `slide.tsx`, `index.ts`; `src/remotion/templates/index.ts`
- Test: `src/remotion/templates/pastel-v1/slide.test.ts`

**Interfaces:**
- Consumes: Task 1 (`SlideProps` ve alt tipleri, `FORMAT_SIZES`, fixtures); `graphemeLength`; `SIGN_SLUGS`, `SignSlug`, `Element`; `Audience`
- Produces:
```ts
// src/remotion/templates/pastel-v1/index.ts
export { PastelSlide } from './slide'; // (props: SlideProps) => JSX.Element
export { waitForFonts as waitForPastelFonts } from './fonts';
// src/remotion/templates/pastel-v1/zodiac.tsx
export const ZODIAC_PATHS: Record<SignSlug, string>;
export function ZodiacGlyph(props: { sign: SignSlug; size: number; color: string; strokeWidth: number }): JSX.Element;
// src/remotion/templates/index.ts
export type SlideTemplate = { Slide: ComponentType<SlideProps>; waitForFonts: () => Promise<unknown> };
export function getTemplate(version: string): SlideTemplate; // bilinmeyende 'Bilinmeyen şablon: <sürüm>' fırlatır
```
Test için DOM işaretleri:
- `data-sign` her burç SVG'sinde bulunur.
- `data-star="full|empty"` her puan yıldızında bulunur.
- `data-slot="watermark|headline|body|handle"` ilgili metin kutularında bulunur.

- [ ] **Step 1: Başarısız testi yaz**

`src/remotion/templates/pastel-v1/slide.test.ts`:
```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SIGN_SLUGS } from '@/lib/zodiac/signs';
import { LONGEST_BODY, SAMPLE_BRAND, SAMPLE_COVER, SAMPLE_CTA, sampleProps, sampleSign } from '@/remotion/fixtures';
import type { SlideProps } from '@/remotion/slide-types';
import { getTemplate } from '@/remotion/templates';
import { PastelSlide } from './slide';
import { ZODIAC_PATHS } from './zodiac';

const html = (props: SlideProps) => renderToStaticMarkup(createElement(PastelSlide, props));
const count = (text: string, needle: string) => text.split(needle).length - 1;

describe('pastel@1', () => {
  it('kapak tarih, kitle, kanca ve 12 burç sembolünü içerir', () => {
    const out = html(sampleProps(SAMPLE_COVER));
    expect(out).toContain('26 EYLÜL 2026 CUMARTESİ');
    expect(out).toContain('KADIN');
    expect(out).toContain(SAMPLE_COVER.hook);
    expect(count(out, 'data-sign=')).toBe(12);
  });

  it('burç slaytı adı, tarihleri, metinleri, puanları ve şansları gösterir', () => {
    const out = html(sampleProps(sampleSign('koc')));
    for (const text of ['GÜNLÜK BURÇ · KADIN', '26 EYLÜL', 'Koç', '21 Mart – 19 Nisan', 'Işıltılı ve cesur bir gün', 'Lila', 'Şanslı sayı']) {
      expect(out).toContain(text);
    }
    expect(count(out, 'data-sign=')).toBe(1);
    expect(count(out, 'data-star="full"')).toBe(12);
    expect(count(out, 'data-star="empty"')).toBe(3);
    expect(html(sampleProps(sampleSign('oglak', 'erkek')))).toContain('GÜNLÜK BURÇ · ERKEK');
  });

  it('filigran yalnızca açık ve kullanıcı adı varken görünür; kapanışta kullanıcı adı bir kez yazılır', () => {
    expect(html(sampleProps(sampleSign()))).toContain('@burc.studio');
    expect(html(sampleProps(sampleSign(), { brand: { ...SAMPLE_BRAND, enabled: false } }))).not.toContain('@burc.studio');
    expect(html(sampleProps(sampleSign(), { brand: { ...SAMPLE_BRAND, handle: null } }))).not.toContain('data-slot="watermark"');
    expect(count(html(sampleProps(SAMPLE_CTA)), '@burc.studio')).toBe(1);
    expect(html(sampleProps(SAMPLE_CTA, { brand: { ...SAMPLE_BRAND, handle: null } }))).toContain('Yarın yeni yorumlarla buradayız');
  });

  it('yorum uzadıkça yazı küçülür; 3:4 formatta yükseklik 1440 olur', () => {
    expect(html(sampleProps(sampleSign()))).toContain('font-size:35px');
    expect(html(sampleProps({ ...sampleSign('yay'), body: LONGEST_BODY }))).toContain('font-size:32px');
    expect(html(sampleProps({ ...sampleSign(), body: 'Kısa ve net bir gün.' }))).toContain('font-size:38px');
    expect(html(sampleProps(sampleSign(), { format: '3x4' }))).toContain('height:1440px');
  });

  it('12 burcun çizimi var; şablon kaydı sürümle çözülür', () => {
    expect(Object.keys(ZODIAC_PATHS).sort()).toEqual([...SIGN_SLUGS].sort());
    expect(getTemplate('pastel@1').Slide).toBe(PastelSlide);
    expect(() => getTemplate('yok@9')).toThrow('Bilinmeyen şablon: yok@9');
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `npx vitest run src/remotion/templates`
Expected: FAIL. `./slide`, `./zodiac` ve `@/remotion/templates` bulunamaz.

- [ ] **Step 3: Token, font ve çizimleri yaz**

`src/remotion/templates/pastel-v1/tokens.ts`:
```ts
import type { Audience } from '@/lib/content/types';
import type { Element } from '@/lib/zodiac/signs';

export const PALETTE = {
  cream: '#FBF7F2',
  plum: '#3D2C3E',
  plumSoft: '#6E5E70',
  gold: '#C9A96E',
  goldSoft: '#E8D8B8',
  white: '#FFFFFF',
  card: 'rgba(255, 255, 255, 0.78)',
} as const;

export const AUDIENCE_ACCENTS: Record<Audience, { from: string; to: string; ink: string }> = {
  kadin: { from: '#F4C2C2', to: '#C8B6E2', ink: '#7A5AA6' },
  erkek: { from: '#BFD7ED', to: '#B7C9A8', ink: '#3F6477' },
};

export const AUDIENCE_TITLES: Record<Audience, string> = { kadin: 'KADIN', erkek: 'ERKEK' };

export const ELEMENT_TINTS: Record<Element, string> = {
  ates: '#FFE6D9',
  toprak: '#EEF2E3',
  hava: '#E8F1FA',
  su: '#ECE7F8',
};

export const CARD_SHADOW = '0 18px 48px rgba(61, 44, 62, 0.08)';
```

`src/remotion/templates/pastel-v1/fonts.ts`:
```ts
import { loadFont as loadFraunces } from '@remotion/google-fonts/Fraunces';
import { loadFont as loadNunito } from '@remotion/google-fonts/Nunito';

const heading = loadFraunces('normal', { weights: ['500', '600'], subsets: ['latin', 'latin-ext'] });
const body = loadNunito('normal', { weights: ['400', '600', '700'], subsets: ['latin', 'latin-ext'] });

export const HEADING_FONT = heading.fontFamily;
export const BODY_FONT = body.fontFamily;

export function waitForFonts(): Promise<unknown> {
  return Promise.all([heading.waitUntilDone(), body.waitUntilDone()]);
}
```

`src/remotion/templates/pastel-v1/zodiac.tsx`:
```tsx
import type { SignSlug } from '@/lib/zodiac/signs';

// 100×100 kutuda tek çizgi (stroke) burç sembolleri.
export const ZODIAC_PATHS: Record<SignSlug, string> = {
  koc: 'M50 88 V42 M50 42 C50 22 38 12 27 14 C16 16 12 28 16 36 C19 43 26 44 30 40 M50 42 C50 22 62 12 73 14 C84 16 88 28 84 36 C81 43 74 44 70 40',
  boga: 'M28 64 A22 22 0 1 0 72 64 A22 22 0 1 0 28 64 M16 18 C20 36 34 42 50 42 C66 42 80 36 84 18',
  ikizler: 'M20 16 C36 23 64 23 80 16 M20 84 C36 77 64 77 80 84 M38 20 V80 M62 20 V80',
  yengec: 'M84 34 C72 18 42 16 22 32 M22 40 A10 10 0 1 0 42 40 A10 10 0 1 0 22 40 M16 66 C28 82 58 84 78 68 M58 60 A10 10 0 1 0 78 60 A10 10 0 1 0 58 60',
  aslan: 'M17 62 A13 13 0 1 0 43 62 A13 13 0 1 0 17 62 M40 52 C34 36 38 16 56 14 C74 12 80 30 72 46 C64 62 62 76 70 84 C76 90 84 86 86 80',
  basak: 'M12 30 C16 22 24 22 24 34 V78 M24 36 C24 22 42 22 42 34 V78 M42 36 C42 22 60 22 60 34 V66 C60 82 72 88 82 78 M60 56 C68 42 86 46 84 60 C82 72 68 78 56 88',
  terazi: 'M14 80 H86 M14 64 H34 C26 56 26 36 38 28 C46 22 54 22 62 28 C74 36 74 56 66 64 H86',
  akrep: 'M10 30 C14 22 22 22 22 34 V76 M22 36 C22 22 40 22 40 34 V76 M40 36 C40 22 58 22 58 34 V70 C58 82 66 86 78 84 L90 80 M82 72 L90 80 L82 88',
  yay: 'M18 84 L84 18 M56 18 H84 V46 M30 50 L52 72',
  oglak: 'M12 28 L26 70 L38 28 C42 18 56 18 58 34 V64 C58 80 70 86 80 80 C90 74 88 58 78 56 C68 54 62 64 60 74 C58 84 50 90 42 88',
  kova: 'M10 42 L23 32 L36 42 L49 32 L62 42 L75 32 L90 42 M10 68 L23 58 L36 68 L49 58 L62 68 L75 58 L90 68',
  balik: 'M24 14 C44 34 44 66 24 86 M76 14 C56 34 56 66 76 86 M26 50 H74',
};

export function ZodiacGlyph({ sign, size, color, strokeWidth }: { sign: SignSlug; size: number; color: string; strokeWidth: number }) {
  return (
    <svg
      data-sign={sign}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ZODIAC_PATHS[sign]} />
    </svg>
  );
}
```

`src/remotion/templates/pastel-v1/ornaments.tsx`:
```tsx
const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';
const SPARKLE_PATH = 'M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z';

export function StarIcon({ filled, size, color }: { filled: boolean; size: number; color: string }) {
  return (
    <svg data-star={filled ? 'full' : 'empty'} width={size} height={size} viewBox="0 0 24 24">
      <path
        d={STAR_PATH}
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        opacity={filled ? 1 : 0.4}
      />
    </svg>
  );
}

export function Sparkle({ x, y, size, color, opacity }: { x: number; y: number; size: number; color: string; opacity: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`, opacity }}>
      <path d={SPARKLE_PATH} fill={color} />
    </svg>
  );
}
```

- [ ] **Step 4: Slaytları yaz**

`src/remotion/templates/pastel-v1/watermark.tsx`:
```tsx
import type { BrandProps } from '@/remotion/slide-types';
import { BODY_FONT } from './fonts';
import { PALETTE } from './tokens';

export function Watermark({ brand }: { brand: BrandProps }) {
  if (!brand.enabled || !brand.handle) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 56,
        right: 56,
        bottom: 34,
        display: 'flex',
        justifyContent: brand.position === 'bottom-center' ? 'center' : 'flex-end',
      }}
    >
      <span
        data-slot="watermark"
        style={{ fontFamily: BODY_FONT, fontSize: 22, fontWeight: 600, letterSpacing: 1, color: PALETTE.plum, opacity: brand.opacity }}
      >
        @{brand.handle}
      </span>
    </div>
  );
}
```

`src/remotion/templates/pastel-v1/cover-slide.tsx`:
```tsx
import { AbsoluteFill } from 'remotion';
import { SIGN_SLUGS } from '@/lib/zodiac/signs';
import type { CoverSlideData } from '@/remotion/slide-types';
import { HEADING_FONT } from './fonts';
import { AUDIENCE_ACCENTS, AUDIENCE_TITLES, PALETTE } from './tokens';
import { ZodiacGlyph } from './zodiac';

const RING_RADIUS = 270;
const GLYPH_SIZE = 60;
const RING_BOX = RING_RADIUS * 2 + GLYPH_SIZE * 2;

export function CoverSlide({ slide }: { slide: CoverSlideData }) {
  const accent = AUDIENCE_ACCENTS[slide.audience];
  return (
    <AbsoluteFill style={{ padding: '96px 88px 110px', alignItems: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 6, color: PALETTE.plumSoft }}>{slide.dateLabel}</div>
      <div style={{ marginTop: 28, fontFamily: HEADING_FONT, fontSize: 64, fontWeight: 500, color: accent.ink }}>Günlük</div>
      <div style={{ fontFamily: HEADING_FONT, fontSize: 104, fontWeight: 600, lineHeight: 1.02 }}>Burç Yorumları</div>
      <div
        style={{
          marginTop: 28,
          padding: '12px 40px',
          borderRadius: 999,
          backgroundImage: `linear-gradient(90deg, ${accent.from}, ${accent.to})`,
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: 4,
        }}
      >
        {AUDIENCE_TITLES[slide.audience]}
      </div>
      <div
        style={{
          position: 'relative',
          marginTop: 'auto',
          marginBottom: 'auto',
          width: RING_BOX,
          height: RING_BOX,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {SIGN_SLUGS.map((sign, index) => {
          const angle = (index / SIGN_SLUGS.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <div
              key={sign}
              style={{
                position: 'absolute',
                left: RING_BOX / 2 + Math.cos(angle) * RING_RADIUS - GLYPH_SIZE / 2,
                top: RING_BOX / 2 + Math.sin(angle) * RING_RADIUS - GLYPH_SIZE / 2,
                width: GLYPH_SIZE,
                height: GLYPH_SIZE,
              }}
            >
              <ZodiacGlyph sign={sign} size={GLYPH_SIZE} color={accent.ink} strokeWidth={5} />
            </div>
          );
        })}
        <div style={{ width: RING_RADIUS * 2 - 150, textAlign: 'center', fontFamily: HEADING_FONT, fontSize: 52, fontWeight: 500, lineHeight: 1.2 }}>
          {slide.hook}
        </div>
      </div>
      <div style={{ fontSize: 30, fontWeight: 600, color: PALETTE.plumSoft }}>Burcunu bulmak için kaydır →</div>
    </AbsoluteFill>
  );
}
```

`src/remotion/templates/pastel-v1/sign-slide.tsx`:
```tsx
import { AbsoluteFill } from 'remotion';
import { graphemeLength } from '@/lib/text/turkish';
import type { SignSlideData } from '@/remotion/slide-types';
import { HEADING_FONT } from './fonts';
import { StarIcon } from './ornaments';
import { AUDIENCE_ACCENTS, AUDIENCE_TITLES, CARD_SHADOW, PALETTE } from './tokens';
import { ZodiacGlyph } from './zodiac';

// Kalite kapısı yorumu 420 grafemle sınırlar; en uzun metin 32px'te kartın gövdesine sığar.
export function bodyFontSize(body: string): number {
  const length = graphemeLength(body);
  if (length <= 300) return 38;
  if (length <= 360) return 35;
  return 32;
}

function ScoreRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{ width: 100, fontSize: 26, fontWeight: 700, color: PALETTE.plumSoft }}>{label}</span>
      <span style={{ display: 'flex', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((step) => (
          <StarIcon key={step} filled={step <= value} size={30} color={color} />
        ))}
      </span>
    </div>
  );
}

export function SignSlide({ slide }: { slide: SignSlideData }) {
  const accent = AUDIENCE_ACCENTS[slide.audience];
  return (
    <AbsoluteFill style={{ padding: '72px 72px 100px', gap: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, fontWeight: 700, letterSpacing: 5, color: PALETTE.plumSoft }}>
        <span>{`GÜNLÜK BURÇ · ${AUDIENCE_TITLES[slide.audience]}`}</span>
        <span>{slide.dateLabel}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
        <div
          style={{
            width: 168,
            height: 168,
            borderRadius: 84,
            border: `3px solid ${PALETTE.white}`,
            backgroundImage: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ZodiacGlyph sign={slide.sign} size={104} color={PALETTE.plum} strokeWidth={5.5} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontFamily: HEADING_FONT, fontSize: 96, fontWeight: 600, lineHeight: 1 }}>{slide.signName}</div>
          <div style={{ fontSize: 30, color: PALETTE.plumSoft }}>{slide.dateRange}</div>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 26,
          padding: '44px 48px',
          borderRadius: 48,
          border: `2px solid ${PALETTE.goldSoft}`,
          backgroundColor: PALETTE.card,
          boxShadow: CARD_SHADOW,
        }}
      >
        <div data-slot="headline" style={{ fontFamily: HEADING_FONT, fontSize: 50, fontWeight: 500, lineHeight: 1.15, color: accent.ink }}>
          {slide.headline}
        </div>
        <div data-slot="body" style={{ flex: 1, minHeight: 0, overflow: 'hidden', fontSize: bodyFontSize(slide.body), lineHeight: 1.45 }}>
          {slide.body}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ScoreRow label="Aşk" value={slide.scores.love} color={accent.ink} />
            <ScoreRow label="Para" value={slide.scores.money} color={accent.ink} />
            <ScoreRow label="Sağlık" value={slide.scores.health} color={accent.ink} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, fontSize: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  border: `2px solid ${PALETTE.white}`,
                  backgroundColor: slide.luckyColor.hex,
                  boxShadow: '0 2px 6px rgba(61, 44, 62, 0.15)',
                }}
              />
              <span>{slide.luckyColor.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ color: PALETTE.plumSoft }}>Şanslı sayı</span>
              <span style={{ fontFamily: HEADING_FONT, fontSize: 40, fontWeight: 600 }}>{slide.luckyNumber}</span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
```

`src/remotion/templates/pastel-v1/cta-slide.tsx`:
```tsx
import { AbsoluteFill } from 'remotion';
import type { BrandProps, CtaSlideData } from '@/remotion/slide-types';
import { HEADING_FONT } from './fonts';
import { AUDIENCE_ACCENTS, CARD_SHADOW, PALETTE } from './tokens';

const ACTIONS = [
  { emoji: '🔖', title: 'Kaydet', hint: 'Yarın yeniden bakmak için' },
  { emoji: '💌', title: 'Arkadaşını etiketle', hint: 'Burcunu bilen biri mutlaka vardır' },
  { emoji: '✨', title: 'Takip et', hint: 'Her sabah yeni yorumlar' },
] as const;

export function CtaSlide({ slide, brand }: { slide: CtaSlideData; brand: BrandProps }) {
  const accent = AUDIENCE_ACCENTS[slide.audience];
  return (
    <AbsoluteFill style={{ padding: '120px 88px', alignItems: 'center', justifyContent: 'center', gap: 36 }}>
      <div style={{ fontFamily: HEADING_FONT, fontSize: 92, fontWeight: 600 }}>Beğendin mi?</div>
      {ACTIONS.map((action) => (
        <div
          key={action.title}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            padding: '30px 40px',
            borderRadius: 40,
            border: `2px solid ${PALETTE.goldSoft}`,
            backgroundColor: PALETTE.card,
            boxShadow: CARD_SHADOW,
          }}
        >
          <span style={{ fontSize: 56 }}>{action.emoji}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: HEADING_FONT, fontSize: 46, fontWeight: 600, color: accent.ink }}>{action.title}</span>
            <span style={{ fontSize: 28, color: PALETTE.plumSoft }}>{action.hint}</span>
          </div>
        </div>
      ))}
      <div data-slot="handle" style={{ marginTop: 24, fontSize: 40, fontWeight: 700 }}>
        {brand.handle ? `@${brand.handle}` : 'Yarın yeni yorumlarla buradayız'}
      </div>
    </AbsoluteFill>
  );
}
```

`src/remotion/templates/pastel-v1/slide.tsx`:
```tsx
import { AbsoluteFill } from 'remotion';
import type { Audience } from '@/lib/content/types';
import type { Element } from '@/lib/zodiac/signs';
import { FORMAT_SIZES, type SlideProps } from '@/remotion/slide-types';
import { CoverSlide } from './cover-slide';
import { CtaSlide } from './cta-slide';
import { BODY_FONT } from './fonts';
import { Sparkle } from './ornaments';
import { SignSlide } from './sign-slide';
import { AUDIENCE_ACCENTS, ELEMENT_TINTS, PALETTE } from './tokens';
import { Watermark } from './watermark';

const SPARKLES = [
  { x: 0.08, y: 0.06, size: 34, opacity: 0.7 },
  { x: 0.9, y: 0.1, size: 24, opacity: 0.6 },
  { x: 0.87, y: 0.52, size: 18, opacity: 0.5 },
  { x: 0.05, y: 0.74, size: 22, opacity: 0.5 },
  { x: 0.92, y: 0.9, size: 30, opacity: 0.6 },
];

function Backdrop({ audience, element }: { audience: Audience; element: Element | null }) {
  const accent = AUDIENCE_ACCENTS[audience];
  const tint = element ? ELEMENT_TINTS[element] : PALETTE.cream;
  return (
    <AbsoluteFill style={{ backgroundImage: `linear-gradient(165deg, ${accent.from} 0%, ${tint} 38%, ${PALETTE.cream} 62%, ${accent.to} 100%)` }}>
      {SPARKLES.map((sparkle) => (
        <Sparkle key={`${sparkle.x}-${sparkle.y}`} {...sparkle} color={PALETTE.gold} />
      ))}
    </AbsoluteFill>
  );
}

export function PastelSlide({ slide, brand, format }: SlideProps) {
  const { width, height } = FORMAT_SIZES[format];
  return (
    <AbsoluteFill lang="tr" style={{ width, height, overflow: 'hidden', backgroundColor: PALETTE.cream, color: PALETTE.plum, fontFamily: BODY_FONT }}>
      <Backdrop audience={slide.audience} element={slide.type === 'sign' ? slide.element : null} />
      {slide.type === 'cover' && <CoverSlide slide={slide} />}
      {slide.type === 'sign' && <SignSlide slide={slide} />}
      {slide.type === 'cta' && <CtaSlide slide={slide} brand={brand} />}
      {slide.type !== 'cta' && <Watermark brand={brand} />}
    </AbsoluteFill>
  );
}
```

`src/remotion/templates/pastel-v1/index.ts`:
```ts
export { waitForFonts as waitForPastelFonts } from './fonts';
export { PastelSlide } from './slide';
```

`src/remotion/templates/index.ts`:
```ts
import type { ComponentType } from 'react';
import type { SlideProps } from '../slide-types';
import { PastelSlide, waitForPastelFonts } from './pastel-v1';

export type SlideTemplate = { Slide: ComponentType<SlideProps>; waitForFonts: () => Promise<unknown> };

// Bir sürüm bir gönderide kullanıldıktan sonra değişmez; yeni görünüm yeni anahtarla (pastel@2) eklenir.
const TEMPLATES: Record<string, SlideTemplate> = {
  'pastel@1': { Slide: PastelSlide, waitForFonts: waitForPastelFonts },
};

export function getTemplate(version: string): SlideTemplate {
  const template = TEMPLATES[version];
  if (!template) throw new Error(`Bilinmeyen şablon: ${version}`);
  return template;
}
```

- [ ] **Step 5: Testin geçtiğini gör**

Run: `npx vitest run src/remotion && npm run typecheck && npm run lint`
Expected: PASS. Görsel doğrulama Task 8 (E2E: sığma ve font) ile Task 10'da (kullanıcı onayı) yapılır.

- [ ] **Step 6: Commit**

```bash
git add src/remotion/templates
git commit -m "feat: pastel@1 carousel şablonu (kapak, burç, kapanış, filigran)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Remotion Studio

**Files:**
- Create: `remotion.config.ts`, `src/remotion/Root.tsx`, `src/remotion/index.ts`
- Modify: `package.json` (`studio` betiği)

**Interfaces:**
- Consumes: Task 1 (fixtures, `FORMAT_SIZES`, `SLIDE_FPS`), Task 4 (`PastelSlide`)
- Produces: `npm run studio`, örnek verilerle altı kompozisyon açar (`Kapak`, `Burc-Koc`, `Burc-Erkek-Oglak`, `Burc-EnUzun`, `Kapanis`, `Burc-3x4`). Uygulama bu dosyaları import etmez. Yalnızca şablon geliştirirken kullanılır.

Bu görevin otomatik testi yoktur, çünkü çıktısı bir geliştirme aracıdır. Doğrulama, Studio sunucusunun paketleme hatası olmadan açılmasıdır (Step 3).

- [ ] **Step 1: Studio dosyalarını yaz**

`remotion.config.ts`:
```ts
import path from 'node:path';
import { Config } from '@remotion/cli/config';

// Studio'nun webpack paketleyicisi tsconfig "paths" ayarını okumaz; uygulamadaki @/ takma adı burada tanımlanır.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: { ...(config.resolve?.alias as Record<string, string> | undefined), '@': path.join(process.cwd(), 'src') },
  },
}));
```

`src/remotion/Root.tsx`:
```tsx
import { Composition } from 'remotion';
import { LONGEST_BODY, SAMPLE_COVER, SAMPLE_CTA, sampleProps, sampleSign } from './fixtures';
import { FORMAT_SIZES, SLIDE_FPS, type SlideProps } from './slide-types';
import { PastelSlide } from './templates/pastel-v1';

const SAMPLES: { id: string; props: SlideProps }[] = [
  { id: 'Kapak', props: sampleProps(SAMPLE_COVER) },
  { id: 'Burc-Koc', props: sampleProps(sampleSign('koc')) },
  { id: 'Burc-Erkek-Oglak', props: sampleProps(sampleSign('oglak', 'erkek')) },
  { id: 'Burc-EnUzun', props: sampleProps({ ...sampleSign('yay'), body: LONGEST_BODY }) },
  { id: 'Kapanis', props: sampleProps(SAMPLE_CTA) },
  { id: 'Burc-3x4', props: sampleProps(sampleSign('balik'), { format: '3x4' }) },
];

export function RemotionRoot() {
  return (
    <>
      {SAMPLES.map(({ id, props }) => (
        <Composition
          key={id}
          id={id}
          component={PastelSlide}
          durationInFrames={1}
          fps={SLIDE_FPS}
          width={FORMAT_SIZES[props.format].width}
          height={FORMAT_SIZES[props.format].height}
          defaultProps={props}
        />
      ))}
    </>
  );
}
```

`src/remotion/index.ts`:
```ts
import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);
```

`package.json` → `scripts` içine (alfabetik sırada `lint`'ten sonra) ekle:
```json
    "studio": "remotion studio src/remotion/index.ts",
```

- [ ] **Step 2: Tip ve lint kontrolü**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Studio'nun paketleme hatası olmadan açıldığını doğrula**

```bash
npx remotion studio src/remotion/index.ts --no-open --port=3900 > .superpowers/studio.log 2>&1 &
STUDIO_PID=$!
for i in $(seq 1 60); do curl -s -o /dev/null -w "%{http_code}" http://localhost:3900 | grep -q 200 && break; sleep 2; done
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3900
grep -iE "error|cannot resolve|module not found" .superpowers/studio.log | head
kill $STUDIO_PID
```
Expected:
- `200` yazar.
- Logda `Module not found`, `Cannot resolve` ya da `error` satırı olmaz.
- Takma ad hatası çıkarsa `remotion.config.ts` içindeki alias düzeltilir.

- [ ] **Step 4: Commit**

```bash
git add remotion.config.ts src/remotion/Root.tsx src/remotion/index.ts package.json
git commit -m "chore: pastel@1 örnekleri için Remotion Studio" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Varsayılan gönderi formatı ayarı

**Files:**
- Modify: `src/lib/settings/schema.ts`, `src/lib/settings/schema.test.ts`, `src/lib/settings/generation-form.ts`, `src/lib/settings/generation-form.test.ts`, `src/app/(app)/ayarlar/generation-form.tsx`, `src/lib/content/horoscope-service.ts`, `src/lib/content/horoscope-service.test.ts`, `src/lib/content/runtime.ts`, `e2e/settings.spec.ts`

**Interfaces:**
- Consumes: `PostFormat` (`src/db/schema.ts`), Faz 1 ayar ve üretim kodu
- Produces:
  - `Settings.defaultFormat: PostFormat`, varsayılanı `'4x5'`.
  - `SettingsPatch.defaultFormat?`.
  - `GenerationDeps.format?: PostFormat`. Verilmezse `'4x5'` kullanılır.
  - `parseGenerationForm`, `defaultFormat` alanını okur.
  - Ayarlar formunda "Varsayılan gönderi formatı" radyo grubu bulunur. Seçenek etiketleri `4:5 dikey (1080×1350)` ve `3:4 dikey (1080×1440)`.

- [ ] **Step 1: Başarısız testleri yaz**

`src/lib/settings/schema.test.ts` içindeki `'kayıt yoksa varsayılanlar gelir'` testinin beklenen nesnesine `spreadLoad: false,` satırından sonra ekle:
```ts
      defaultFormat: '4x5',
```
Aynı dosyadaki `describe('üretim ayarları', …)` bloğunun sonuna ekle:
```ts
  it('varsayılan format yalnızca 4x5 ya da 3x4 olabilir', () => {
    expect(mergeSettings(DEFAULT_SETTINGS, { defaultFormat: '3x4' }).defaultFormat).toBe('3x4');
    expect(() => mergeSettings(DEFAULT_SETTINGS, { defaultFormat: '5x5' as never })).toThrow();
  });
```

`src/lib/settings/generation-form.test.ts` içindeki `valid` dizisine `['spreadLoad', 'true'],` satırından sonra ekle:
```ts
  ['defaultFormat', '3x4'],
```
Aynı dosyadaki `'geçerli formu yamaya çevirir'` beklentisinin `patch` nesnesine `spreadLoad: true,` satırından sonra ekle:
```ts
        defaultFormat: '3x4',
```

`src/lib/content/horoscope-service.test.ts` içindeki `describe('generateHoroscopeSet', …)` bloğunun sonuna ekle:
```ts
  it('ayarlardaki varsayılan formatla gönderi açar', async () => {
    await generateHoroscopeSet({ ...deps([spec(createMockModel())]), format: '3x4' }, { date: DATE, audience: 'kadin', trigger: 'button', skipIfExists: false });
    expect((await getCurrentPost(db, KEY))?.post.format).toBe('3x4');
  });
```

`e2e/settings.spec.ts` sonuna ekle:
```ts
test('varsayılan gönderi formatı kaydedilir', async ({ page }) => {
  await login(page, '/ayarlar');
  await page.getByLabel('3:4 dikey (1080×1440)').check();
  await page.getByRole('button', { name: 'Üretim ayarlarını kaydet' }).click();
  await expect(page.getByText('Üretim ayarları kaydedildi.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('3:4 dikey (1080×1440)')).toBeChecked();
  await page.getByLabel('4:5 dikey (1080×1350)').check();
  await page.getByRole('button', { name: 'Üretim ayarlarını kaydet' }).click();
  await expect(page.getByText('Üretim ayarları kaydedildi.').first()).toBeVisible();
});
```
(Test sonunda 4:5'e geri dönülür. Böylece aynı çalıştırmadaki diğer E2E testleri 4:5 gönderi bekleyebilir.)

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `npx vitest run src/lib/settings src/lib/content/horoscope-service.test.ts; npm run test:e2e -- e2e/settings.spec.ts`
Expected:
- Birim testlerinde varsayılan nesne, form yaması ve format testi FAIL olur.
- E2E'de `3:4 dikey (1080×1440)` etiketi bulunamaz.

- [ ] **Step 3: Uygulamayı yaz**

`src/lib/settings/schema.ts`:
1. İmportların altına ekle: `import type { PostFormat } from '@/db/schema';`
2. `settingsSchema` içinde `spreadLoad: z.boolean(),` satırından sonra ekle:
```ts
  defaultFormat: z.enum(['4x5', '3x4']),
```
3. `SettingsPatch` içinde `spreadLoad?: boolean;` satırından sonra ekle:
```ts
  defaultFormat?: PostFormat;
```
4. `DEFAULT_SETTINGS` içinde `spreadLoad: false,` satırından sonra ekle:
```ts
  defaultFormat: '4x5',
```

`src/lib/settings/generation-form.ts` içinde, dönen `patch` nesnesinde `spreadLoad` satırından sonra ekle:
```ts
      defaultFormat: formData.get('defaultFormat') === '3x4' ? '3x4' : '4x5',
```

`src/lib/content/horoscope-service.ts`:
1. İmportlara ekle: `import type { PostFormat } from '@/db/schema';`
2. `GenerationDeps` tipine `budgetMs?: number;` satırından sonra ekle: `format?: PostFormat;`
3. `generateHoroscopeSet` içindeki `createPostVersion` çağrısında `format: '4x5',` satırını şununla değiştir:
```ts
        format: deps.format ?? '4x5',
```

`src/lib/content/runtime.ts` içinde dönen nesneye `spreadLoad: settings.spreadLoad,` alanından sonra ekle:
```ts
format: settings.defaultFormat,
```

`src/app/(app)/ayarlar/generation-form.tsx` içinde "Günlük plan" `</fieldset>` kapanışından hemen sonra ekle:
```tsx
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Varsayılan gönderi formatı</legend>
        {[
          ['4x5', '4:5 dikey (1080×1350)'],
          ['3x4', '3:4 dikey (1080×1440)'],
        ].map(([value, text]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input type="radio" name="defaultFormat" value={value} defaultChecked={initial.defaultFormat === value} className="size-4 accent-primary" />
            {text}
          </label>
        ))}
      </fieldset>
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npm test && npm run typecheck && npm run lint && npm run test:e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings src/lib/content src/app/\(app\)/ayarlar/generation-form.tsx e2e/settings.spec.ts
git commit -m "feat: ayarlarda varsayılan gönderi formatı (4:5 / 3:4)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Gönderi düzenleme ve durum API'leri

**Files:**
- Create: `src/lib/posts/edit.ts`, `src/lib/posts/http.ts`, `src/app/api/posts/[id]/route.ts`, `src/app/api/posts/[id]/status/route.ts`
- Test: `src/lib/posts/edit.test.ts`, `src/lib/posts/http.test.ts`

**Interfaces:**
- Consumes: Task 2 (`getPostDetail`, `markPostDownloaded`, `setPostPublished`, `seedPost`), Task 3 (`postEditSchema`, `PostEdit`, `EDIT_LIMITS`); Faz 1 (`saveReadings`, `createPostVersion`, `getCurrentPost`, `getCurrentReadings`, `normalizeHashtag`, `MAX_HASHTAGS`, `graphemeLength`, `isUniqueViolation`)
- Produces:
```ts
// src/lib/posts/edit.ts
export type EditErrors = Record<string, string>; // anahtarlar: coverHook, caption, hashtags, '<burç>.headline|body|short'
export type EditResult = { status: 'created'; postId: string } | { status: 'unchanged'; postId: string } | { status: 'not-found' } | { status: 'stale'; currentId: string | null } | { status: 'invalid'; errors: EditErrors };
export function validatePostEdit(edit: PostEdit): { ok: true; value: PostEdit } | { ok: false; errors: EditErrors };
export async function editPost(db: Db, postId: string, edit: PostEdit, now?: Date): Promise<EditResult>;
// src/lib/posts/http.ts
export async function handleEditPost(request: Request, deps: { db: Db; postId: string; now?: Date }): Promise<Response>;
export async function handlePostStatus(request: Request, deps: { db: Db; postId: string; now?: Date }): Promise<Response>;
```
HTTP sözleşmesi:
- `PATCH /api/posts/[id]` gövdesi `PostEdit`.
  - `200 { status: 'created' | 'unchanged', postId }`
  - `400 { error, errors? }`
  - `404 { error }`
  - `409 { error, currentId? }`
- `POST /api/posts/[id]/status` gövdesi `{ action: 'downloaded' }` ya da `{ action: 'published', value: boolean }`.
  - `200 { status }`
  - `400`
  - `404`

- [ ] **Step 1: Başarısız testleri yaz**

`src/lib/posts/edit.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { getCurrentReadings } from '@/lib/content/repository';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { editPost, validatePostEdit } from './edit';
import { getPostDetail, getPostVersions } from './repository';

const KEY = { date: '2026-09-26', kind: 'horoscope' as const, audience: 'kadin' as const };
const EDITED_AT = new Date('2026-09-26T08:00:00Z');

let db: Db;
let postId: string;
beforeEach(async () => {
  db = await createTestDb();
  postId = (await seedPost(db, KEY)).id;
});

describe('validatePostEdit', () => {
  it('hashtagleri Türkçe kurallarla normalize eder ve tekrarı atar', () => {
    expect(validatePostEdit({ hashtags: ['İkizler', '#ikizler', 'burç', ' '] })).toEqual({ ok: true, value: { hashtags: ['#ikizler', '#burç'] } });
  });

  it('5ten fazla hashtagi, hashtagli caption\'ı, boş ve uzun metinleri reddeder', () => {
    expect(
      validatePostEdit({
        hashtags: ['#a', '#b', '#c', '#d', '#e', '#f'],
        caption: 'Güzel bir gün #burç',
        coverHook: '   ',
        signs: [{ sign: 'koc', headline: 'x'.repeat(41), body: 'Tamam', short: 'Kısa' }],
      }),
    ).toEqual({
      ok: false,
      errors: {
        hashtags: 'En fazla 5 hashtag kullanılabilir.',
        caption: 'Caption hashtag içermemeli; hashtagleri ayrı alana yaz.',
        coverHook: 'Boş bırakılamaz.',
        'koc.headline': 'En fazla 40 karakter olmalı (şu an 41).',
      },
    });
    expect(validatePostEdit({ hashtags: ['###'] })).toEqual({ ok: false, errors: { hashtags: 'Hashtag yalnızca harf, rakam ve alt çizgi içerebilir.' } });
  });
});

describe('editPost', () => {
  it('değişen burç için yeni yorum sürümü ve yeni gönderi sürümü açar; eski sürüm dokunulmadan kalır', async () => {
    const result = await editPost(
      db,
      postId,
      { coverHook: ' Yeni kanca ', format: '3x4', signs: [{ sign: 'aslan', headline: 'Elle yazılan başlık', body: 'Elle düzenlenen gövde.', short: 'Elle kısa' }] },
      EDITED_AT,
    );
    expect(result.status).toBe('created');
    const detail = await getPostDetail(db, (result as { postId: string }).postId);
    expect(detail?.post).toMatchObject({ version: 2, isCurrent: true, format: '3x4', cover: { hook: 'Yeni kanca' }, caption: 'Caption' });
    expect(detail?.slides[5].reading).toMatchObject({ sign: 'aslan', version: 2, headline: 'Elle yazılan başlık', provider: 'mock', editedAt: EDITED_AT });
    expect(detail?.slides[1].reading).toMatchObject({ sign: 'koc', version: 1 });
    expect((await getCurrentReadings(db, KEY)).find((row) => row.sign === 'aslan')?.headline).toBe('Elle yazılan başlık');
    const old = await getPostDetail(db, postId);
    expect(old?.post).toMatchObject({ isCurrent: false, format: '4x5', cover: { hook: 'Kanca' } });
    expect(old?.slides[5].reading).toMatchObject({ version: 1, headline: 'aslan başlık' });
  });

  it('değişiklik yoksa sürüm açmaz', async () => {
    expect(await editPost(db, postId, { caption: 'Caption', format: '4x5', signs: [{ sign: 'koc', headline: 'koc başlık', body: 'koc yorum', short: 'koc kısa' }] })).toEqual({
      status: 'unchanged',
      postId,
    });
    expect(await getPostVersions(db, KEY)).toHaveLength(1);
  });

  it('eski sürüm düzenlenemez; güncel sürümün kimliği döner', async () => {
    const first = await editPost(db, postId, { caption: 'İkinci sürümün açıklaması' });
    expect(await editPost(db, postId, { caption: 'Eski sürümden düzenleme denemesi' })).toEqual({
      status: 'stale',
      currentId: (first as { postId: string }).postId,
    });
    expect(await getPostVersions(db, KEY)).toHaveLength(2);
  });

  it('bilinmeyen gönderide not-found, geçersiz düzenlemede invalid döner', async () => {
    expect(await editPost(db, '00000000-0000-4000-8000-000000000000', { caption: 'x' })).toEqual({ status: 'not-found' });
    expect(await editPost(db, postId, { coverHook: '' })).toEqual({ status: 'invalid', errors: { coverHook: 'Boş bırakılamaz.' } });
  });
});
```

`src/lib/posts/http.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { seedPost } from '@/test/posts';
import { handleEditPost, handlePostStatus } from './http';

const KEY = { date: '2026-09-26', kind: 'horoscope' as const, audience: 'kadin' as const };
const MISSING = '00000000-0000-4000-8000-000000000000';
const body = (value: unknown, method = 'PATCH') =>
  new Request('http://localhost/api/posts/x', { method, body: typeof value === 'string' ? value : JSON.stringify(value) });

let db: Db;
let postId: string;
beforeEach(async () => {
  db = await createTestDb();
  postId = (await seedPost(db, KEY)).id;
});

describe('handleEditPost', () => {
  it('geçersiz alanlarda 400 ve alan hataları, bozuk gövdede 400, geçerli düzenlemede 200 döner', async () => {
    const invalid = await handleEditPost(body({ coverHook: '' }), { db, postId });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: 'Bazı alanlar geçersiz.', errors: { coverHook: 'Boş bırakılamaz.' } });
    expect((await handleEditPost(body('bozuk'), { db, postId })).status).toBe(400);
    expect((await handleEditPost(body({ format: '5x5' }), { db, postId })).status).toBe(400);
    const ok = await handleEditPost(body({ coverHook: 'Yepyeni kanca' }), { db, postId });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ status: 'created' });
  });

  it('eski sürümde 409 ve güncel kimlik, bilinmeyen gönderide 404 döner', async () => {
    const created = await (await handleEditPost(body({ caption: 'Yeni açıklama' }), { db, postId })).json();
    const stale = await handleEditPost(body({ caption: 'Tekrar' }), { db, postId });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ error: 'Bu sürüm artık güncel değil.', currentId: created.postId });
    expect((await handleEditPost(body({ caption: 'x' }), { db, postId: MISSING })).status).toBe(404);
  });
});

describe('handlePostStatus', () => {
  it('indirildi ve paylaşıldı işaretlerini uygular; hatalı istekte 400, bilinmeyen gönderide 404', async () => {
    const status = async (value: unknown, id = postId) => handlePostStatus(body(value, 'POST'), { db, postId: id });
    expect(await (await status({ action: 'downloaded' })).json()).toEqual({ status: 'indirildi' });
    expect(await (await status({ action: 'published', value: true })).json()).toEqual({ status: 'paylasildi' });
    expect(await (await status({ action: 'published', value: false })).json()).toEqual({ status: 'indirildi' });
    expect((await status({ action: 'sil' })).status).toBe(400);
    expect((await status({ action: 'downloaded' }, MISSING)).status).toBe(404);
  });
});
```

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `npx vitest run src/lib/posts/edit.test.ts src/lib/posts/http.test.ts`
Expected: FAIL. `./edit` ve `./http` bulunamaz.

- [ ] **Step 3: Uygulamayı yaz**

`src/lib/posts/edit.ts`:
```ts
import type { Db } from '@/db/types';
import { MAX_HASHTAGS, normalizeHashtag } from '@/lib/content/hashtags';
import { createPostVersion, getCurrentPost, saveReadings, type NewReading } from '@/lib/content/repository';
import { graphemeLength } from '@/lib/text/turkish';
import { EDIT_LIMITS, type PostEdit } from './edit-schema';
import { getPostDetail } from './repository';

export type EditErrors = Record<string, string>;
export type EditResult =
  | { status: 'created'; postId: string }
  | { status: 'unchanged'; postId: string }
  | { status: 'not-found' }
  | { status: 'stale'; currentId: string | null }
  | { status: 'invalid'; errors: EditErrors };

function checkText(errors: EditErrors, field: string, value: string, max: number): void {
  const length = graphemeLength(value.trim());
  if (length === 0) errors[field] = 'Boş bırakılamaz.';
  else if (length > max) errors[field] = `En fazla ${max} karakter olmalı (şu an ${length}).`;
}

export function validatePostEdit(edit: PostEdit): { ok: true; value: PostEdit } | { ok: false; errors: EditErrors } {
  const errors: EditErrors = {};
  if (edit.coverHook !== undefined) checkText(errors, 'coverHook', edit.coverHook, EDIT_LIMITS.coverHook);
  if (edit.caption !== undefined) {
    checkText(errors, 'caption', edit.caption, EDIT_LIMITS.caption);
    if (edit.caption.includes('#')) errors.caption = 'Caption hashtag içermemeli; hashtagleri ayrı alana yaz.';
  }
  let hashtags: string[] | undefined;
  if (edit.hashtags !== undefined) {
    const normalized = edit.hashtags
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map(normalizeHashtag);
    if (normalized.some((tag) => tag === null)) {
      errors.hashtags = 'Hashtag yalnızca harf, rakam ve alt çizgi içerebilir.';
    } else {
      hashtags = [...new Set(normalized as string[])];
      if (hashtags.length > MAX_HASHTAGS) errors.hashtags = `En fazla ${MAX_HASHTAGS} hashtag kullanılabilir.`;
    }
  }
  for (const sign of edit.signs ?? []) {
    checkText(errors, `${sign.sign}.headline`, sign.headline, EDIT_LIMITS.headline);
    checkText(errors, `${sign.sign}.body`, sign.body, EDIT_LIMITS.body);
    checkText(errors, `${sign.sign}.short`, sign.short, EDIT_LIMITS.short);
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      format: edit.format,
      coverHook: edit.coverHook?.trim(),
      caption: edit.caption?.trim(),
      hashtags,
      signs: edit.signs?.map((sign) => ({ sign: sign.sign, headline: sign.headline.trim(), body: sign.body.trim(), short: sign.short.trim() })),
    },
  };
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export async function editPost(db: Db, postId: string, edit: PostEdit, now: Date = new Date()): Promise<EditResult> {
  const checked = validatePostEdit(edit);
  if (!checked.ok) return { status: 'invalid', errors: checked.errors };
  const detail = await getPostDetail(db, postId);
  if (!detail) return { status: 'not-found' };
  const { post } = detail;
  const key = { date: post.date, kind: post.kind, audience: post.audience };
  if (!post.isCurrent) return { status: 'stale', currentId: (await getCurrentPost(db, key))?.post.id ?? null };

  const value = checked.value;
  const readingBySign = new Map(detail.slides.flatMap((slide) => (slide.reading ? [[slide.reading.sign, slide.reading] as const] : [])));
  const changedSigns = (value.signs ?? []).flatMap((edited) => {
    const reading = readingBySign.get(edited.sign);
    if (!reading) return [];
    const changed = reading.headline !== edited.headline || reading.body !== edited.body || reading.short !== edited.short;
    return changed ? [{ edited, reading }] : [];
  });
  const hook = value.coverHook ?? post.cover.hook;
  const caption = value.caption ?? post.caption;
  const hashtags = value.hashtags ?? post.hashtags;
  const format = value.format ?? post.format;
  const postChanged = hook !== post.cover.hook || caption !== post.caption || !sameList(hashtags, post.hashtags) || format !== post.format;
  if (!postChanged && changedSigns.length === 0) return { status: 'unchanged', postId };

  const created = await db.transaction(async (tx) => {
    const saved = await saveReadings(
      tx,
      key,
      changedSigns.map(
        ({ edited, reading }): NewReading => ({
          sign: reading.sign,
          headline: edited.headline,
          body: edited.body,
          short: edited.short,
          meta: reading.meta,
          provider: reading.provider,
          model: reading.model,
          promptVersion: reading.promptVersion,
          runId: reading.runId,
          editedAt: now,
        }),
      ),
    );
    const savedBySign = new Map(saved.map((row) => [row.sign, row.id]));
    const signReadingIds = detail.slides
      .filter((slide) => slide.type === 'sign')
      .map((slide) => savedBySign.get(slide.reading!.sign) ?? (slide.readingId as string));
    return createPostVersion(tx, {
      ...key,
      templateVersion: post.templateVersion,
      format,
      cover: { hook },
      caption,
      hashtags,
      signReadingIds,
    });
  });
  return { status: 'created', postId: created.id };
}
```

`src/lib/posts/http.ts`:
```ts
import { z } from 'zod';
import { isUniqueViolation } from '@/db/errors';
import type { Db } from '@/db/types';
import { editPost } from './edit';
import { postEditSchema } from './edit-schema';
import { markPostDownloaded, setPostPublished } from './repository';

type Deps = { db: Db; postId: string; now?: Date };

const statusSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('downloaded') }),
  z.object({ action: z.literal('published'), value: z.boolean() }),
]);

const BAD_REQUEST = () => Response.json({ error: 'Geçersiz istek.' }, { status: 400 });
const NOT_FOUND = () => Response.json({ error: 'Gönderi bulunamadı.' }, { status: 404 });

export async function handleEditPost(request: Request, deps: Deps): Promise<Response> {
  const parsed = postEditSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return BAD_REQUEST();
  try {
    const result = await editPost(deps.db, deps.postId, parsed.data, deps.now);
    if (result.status === 'invalid') return Response.json({ error: 'Bazı alanlar geçersiz.', errors: result.errors }, { status: 400 });
    if (result.status === 'not-found') return NOT_FOUND();
    if (result.status === 'stale') return Response.json({ error: 'Bu sürüm artık güncel değil.', currentId: result.currentId }, { status: 409 });
    return Response.json(result);
  } catch (error) {
    if (isUniqueViolation(error)) return Response.json({ error: 'Gönderi bu sırada değişti; sayfayı yenile.' }, { status: 409 });
    throw error;
  }
}

export async function handlePostStatus(request: Request, deps: Deps): Promise<Response> {
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return BAD_REQUEST();
  const row =
    parsed.data.action === 'downloaded'
      ? await markPostDownloaded(deps.db, deps.postId, deps.now)
      : await setPostPublished(deps.db, deps.postId, parsed.data.value, deps.now);
  return row ? Response.json({ status: row.status }) : NOT_FOUND();
}
```

`src/app/api/posts/[id]/route.ts`:
```ts
import { getDb } from '@/db/client';
import { handleEditPost } from '@/lib/posts/http';

export async function PATCH(request: Request, ctx: RouteContext<'/api/posts/[id]'>) {
  const { id } = await ctx.params;
  return handleEditPost(request, { db: getDb(), postId: id });
}
```

`src/app/api/posts/[id]/status/route.ts`:
```ts
import { getDb } from '@/db/client';
import { handlePostStatus } from '@/lib/posts/http';

export async function POST(request: Request, ctx: RouteContext<'/api/posts/[id]/status'>) {
  const { id } = await ctx.params;
  return handlePostStatus(request, { db: getDb(), postId: id });
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS. Build çıktısında `ƒ /api/posts/[id]` ve `ƒ /api/posts/[id]/status` yer alır.

- [ ] **Step 5: Commit**

```bash
git add src/lib/posts src/app/api/posts
git commit -m "feat: gönderi düzenleme (yeni sürüm) ve indirme/paylaşım durumu API'leri" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Tarayıcıda render ve gönderi sayfası

**Files:**
- Run: `shadcn add textarea`, Magic UI `animated-circular-progress-bar`
- Create:
  - `src/lib/render/render-images.ts`, `src/lib/render/deliver.ts`
  - `src/components/post/slide-thumbnail.tsx`, `slide-strip.tsx`, `char-field.tsx`, `slide-editor.tsx`, `export-panel.tsx`, `post-workspace.tsx`
  - `src/app/(app)/gonderi/[id]/page.tsx`
  - `e2e/jpeg.ts`, `e2e/post.spec.ts`
- Modify: `src/components/signs/regenerate-sign-button.tsx`, `e2e/helpers.ts`
- Test: `src/lib/render/deliver.test.ts`, `e2e/post.spec.ts`

**Interfaces:**
- Consumes: Task 1–4 ve Task 7'nin tümü
- Produces:
```ts
// src/lib/render/render-images.ts (yalnızca tarayıcı)
export const JPEG_QUALITY = 0.92;
export async function renderSlideJpeg(templateVersion: string, props: SlideProps, signal?: AbortSignal): Promise<Blob>;
export async function renderPostImages(input: { templateVersion: string; slides: readonly SlideProps[]; signal?: AbortSignal; onProgress?: (done: number, total: number) => void }): Promise<Blob[]>;
// src/lib/render/deliver.ts
export function saveBlob(blob: Blob, fileName: string): void;
export function canShareFiles(files: File[]): boolean;
// src/components/post/slide-thumbnail.tsx
export function SlideThumbnail(props: { templateVersion: string; props: SlideProps }): JSX.Element;
// src/components/signs/regenerate-sign-button.tsx: yeni isteğe bağlı prop
onRegenerated?: (postId: string) => void; // verilmezse router.refresh()
// e2e/helpers.ts
export async function freshPost(page: Page, audience?: 'kadin' | 'erkek', date?: DateKey): Promise<string>; // force ile yeni sürüm üretir, postId döner; tarih varsayılanı bugün
export async function downloadPostZip(page: Page): Promise<Record<string, Uint8Array>>;
```
Sayfa: `/gonderi/[id]`. Erişilebilir adlar (E2E bunlara bağlıdır):
- Slayt düğmeleri: `Slayt N: Kapak | <Burç adı> | Kapanış`.
- Alan etiketleri: `Kapak cümlesi`, `Başlık`, `Yorum`, `Kısa metin (Reels)`, `Caption`, `Hashtagler`, `4:5 (1080×1350)`, `3:4 (1080×1440)`.
- Düğmeler: `Değişiklikleri kaydet`, `JPEG'leri hazırla`, `ZIP indir`, `Paylaş / Fotoğraflara kaydet`, `Caption'ı kopyala`, `Paylaşıldı olarak işaretle` / `Paylaşıldı işaretini kaldır`.
- İlerleme metni: `N/14 görsel hazır`.
- Durum rozeti: `data-testid="post-status"`.
- Eski sürüm uyarısı: `Bu eski bir sürüm; yalnızca indirilebilir.`
- Sürüm listesi: `navigation "Sürümler"`.

- [ ] **Step 1: Başarısız birim ve E2E testlerini yaz**

`src/lib/render/deliver.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canShareFiles } from './deliver';

afterEach(() => vi.unstubAllGlobals());

describe('canShareFiles', () => {
  const files = [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })];

  it('Web Share dosya paylaşımı yoksa false döner', () => {
    vi.stubGlobal('navigator', {});
    expect(canShareFiles(files)).toBe(false);
  });

  it('tarayıcı dosyaları paylaşabiliyorsa true döner', () => {
    vi.stubGlobal('navigator', { share: async () => undefined, canShare: (data: { files?: File[] }) => (data.files?.length ?? 0) > 0 });
    expect(canShareFiles(files)).toBe(true);
    expect(canShareFiles([])).toBe(false);
  });
});
```

`e2e/jpeg.ts`:
```ts
// JPEG'in SOFn işaretinden piksel boyutunu okur.
export function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('JPEG değil');
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error('Bozuk JPEG');
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (bytes[offset + 5] << 8) | bytes[offset + 6], width: (bytes[offset + 7] << 8) | bytes[offset + 8] };
    }
    offset += 2 + length;
  }
  throw new Error('JPEG boyutu bulunamadı');
}
```

`e2e/helpers.ts` sonuna ekle (ve dosyanın başındaki importları şununla değiştir):
```ts
import { readFile } from 'node:fs/promises';
import { expect, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { istanbulDateKey } from '../src/lib/date/istanbul';
import { E2E_PASSWORD } from './constants';
```
```ts
export async function freshPost(page: Page, audience: 'kadin' | 'erkek' = 'kadin', date: string = istanbulDateKey()): Promise<string> {
  const response = await page.request.post('/api/generate', { data: { date, audience, force: true } });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { postId: string }).postId;
}

export async function downloadPostZip(page: Page): Promise<Record<string, Uint8Array>> {
  await page.getByRole('button', { name: "JPEG'leri hazırla" }).click();
  await expect(page.getByText('14/14 görsel hazır')).toBeVisible({ timeout: 90_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'ZIP indir' }).click()]);
  return unzipSync(new Uint8Array(await readFile(await download.path())));
}
```

`e2e/post.spec.ts`:
```ts
import { expect, test, type Page } from '@playwright/test';
import { istanbulDateKey } from '../src/lib/date/istanbul';
import { LONGEST_BODY } from '../src/remotion/fixtures';
import { downloadPostZip, freshPost, login } from './helpers';
import { jpegSize } from './jpeg';

async function bodiesFit(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-slot="body"]')].every((element) => element.scrollHeight <= element.clientHeight + 1),
  );
}

async function save(page: Page) {
  await page.getByRole('button', { name: 'Değişiklikleri kaydet' }).click();
  await expect(page.getByText('Yeni sürüm kaydedildi.').first()).toBeVisible();
}

test('gönderi 14 JPEG ve caption içeren ZIP olarak indirilir, durum İndirildi olur', async ({ page }) => {
  await login(page);
  const id = await freshPost(page);
  await page.goto(`/gonderi/${id}`);
  await expect(page.getByRole('button', { name: /^Slayt \d+:/ })).toHaveCount(14);
  const files = await downloadPostZip(page);
  const date = istanbulDateKey();
  const names = Object.keys(files).sort();
  expect(names).toHaveLength(15);
  expect(names).toEqual(expect.arrayContaining([`${date}_kadin-burc_01-kapak.jpg`, `${date}_kadin-burc_06-aslan.jpg`, `${date}_kadin-burc_14-kapanis.jpg`, 'caption.txt']));
  for (const name of names.filter((entry) => entry.endsWith('.jpg'))) {
    expect(jpegSize(files[name])).toEqual({ width: 1080, height: 1350 });
  }
  expect(new TextDecoder().decode(files['caption.txt'])).toContain('#yıldızlar');
  await expect(page.getByTestId('post-status')).toHaveText('İndirildi');
});

test('en uzun yorum iki formatta da kartına sığar, Türkçe harfler yüklenen fontla çizilir', async ({ page }) => {
  await login(page);
  const id = await freshPost(page);
  await page.goto(`/gonderi/${id}`);
  await page.getByRole('button', { name: /^Slayt 10: Yay/ }).click();
  await page.getByLabel('Başlık').fill('Çığır açan, güçlü bir gün İstanbul!');
  await page.getByLabel('Yorum').fill(LONGEST_BODY);
  await save(page);
  await expect(page).not.toHaveURL(new RegExp(id));
  expect(await bodiesFit(page)).toBe(true);

  const fontsLoaded = await page.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts];
    const hasLatinExt = (family: string) =>
      faces.some((face) => face.family.replaceAll('"', '') === family && face.status === 'loaded' && face.unicodeRange.includes('U+0100'));
    return hasLatinExt('Fraunces') && hasLatinExt('Nunito');
  });
  expect(fontsLoaded).toBe(true);

  await page.getByLabel('3:4 (1080×1440)').check();
  await save(page);
  expect(await bodiesFit(page)).toBe(true);
  const files = await downloadPostZip(page);
  expect(jpegSize(files[`${istanbulDateKey()}_kadin-burc_10-yay.jpg`])).toEqual({ width: 1080, height: 1440 });
});

test('eski sürüm salt okunurdur ve güncel sürüme bağlantı verir', async ({ page }) => {
  await login(page);
  const id = await freshPost(page);
  await page.goto(`/gonderi/${id}`);
  await page.getByLabel('Caption').fill('Eski sürüm testi için yeni açıklama.');
  await save(page);
  await page.goto(`/gonderi/${id}`);
  await expect(page.getByText('Bu eski bir sürüm; yalnızca indirilebilir.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Değişiklikleri kaydet' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Güncel sürüme git' }).click();
  await expect(page.getByLabel('Caption')).toHaveValue('Eski sürüm testi için yeni açıklama.');
});

test('caption kopyalanır, paylaşıldı işaretlenir, tek burç yenilenince yeni sürüme gidilir', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await login(page);
  const id = await freshPost(page);
  await page.goto(`/gonderi/${id}`);
  await page.getByRole('button', { name: "Caption'ı kopyala" }).click();
  await expect(page.getByText('Caption kopyalandı.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('#yıldızlar');
  await page.getByRole('button', { name: 'Paylaşıldı olarak işaretle' }).click();
  await expect(page.getByTestId('post-status')).toHaveText('Paylaşıldı');
  await expect(page.getByRole('button', { name: 'Paylaşıldı işaretini kaldır' })).toBeVisible();

  await page.getByRole('button', { name: /^Slayt 6: Aslan/ }).click();
  await page.getByRole('button', { name: 'Aslan yorumunu yeniden üret' }).click();
  await expect(page.getByText('Aslan yorumu yenilendi.')).toBeVisible({ timeout: 30_000 });
  await expect(page).not.toHaveURL(new RegExp(id));
});

test('geçersiz düzenleme alan hatası gösterir ve sürüm açmaz', async ({ page }) => {
  await login(page);
  const id = await freshPost(page);
  await page.goto(`/gonderi/${id}`);
  await page.getByLabel('Caption').fill('Hashtag yasak #burç');
  await page.getByRole('button', { name: 'Değişiklikleri kaydet' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Caption hashtag içermemeli' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(id));
});
```

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `npx vitest run src/lib/render/deliver.test.ts; npm run test:e2e -- e2e/post.spec.ts`
Expected:
- Birim testinde `./deliver` bulunamaz.
- E2E'de `/gonderi/<id>` 404 döner ve `Slayt` düğmeleri bulunamaz.

- [ ] **Step 3: Bileşenleri kur**

```bash
npx -y shadcn@latest add textarea -y
npx -y shadcn@latest add ~/.agents/skills/magic-ui/vendor/r/animated-circular-progress-bar.json -y
```
Expected: `src/components/ui/textarea.tsx` ve `src/components/ui/animated-circular-progress-bar.tsx` oluşur. `globals.css` değişirse biçimi kontrol edilir (Faz 1 Task 12'deki gibi).

- [ ] **Step 4: Render ve teslim modüllerini yaz**

`src/lib/render/deliver.ts`:
```ts
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function canShareFiles(files: File[]): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files })
  );
}
```

`src/lib/render/render-images.ts`:
```ts
import { FORMAT_SIZES, SLIDE_FPS, type SlideProps } from '@/remotion/slide-types';
import { getTemplate } from '@/remotion/templates';

export const JPEG_QUALITY = 0.92;

export async function renderSlideJpeg(templateVersion: string, props: SlideProps, signal?: AbortSignal): Promise<Blob> {
  const { renderStillOnWeb } = await import('@remotion/web-renderer');
  const template = getTemplate(templateVersion);
  await template.waitForFonts();
  const { width, height } = FORMAT_SIZES[props.format];
  const still = await renderStillOnWeb({
    composition: { id: 'slide', component: template.Slide, durationInFrames: 1, fps: SLIDE_FPS, width, height },
    inputProps: props,
    frame: 0,
    signal: signal ?? null,
  });
  return still.blob({ format: 'jpeg', quality: JPEG_QUALITY });
}

export async function renderPostImages(input: {
  templateVersion: string;
  slides: readonly SlideProps[];
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}): Promise<Blob[]> {
  const blobs: Blob[] = [];
  for (const props of input.slides) {
    input.signal?.throwIfAborted();
    blobs.push(await renderSlideJpeg(input.templateVersion, props, input.signal));
    input.onProgress?.(blobs.length, input.slides.length);
  }
  return blobs;
}
```
Typecheck `composition` nesnesinde `calculateMetadata` isterse `calculateMetadata: null` eklenir (Remotion'un `renderMediaOnWeb` örneği bu biçimi kullanır).

- [ ] **Step 5: Tek burç yenileme düğmesine geri çağrı ekle**

`src/components/signs/regenerate-sign-button.tsx`:
1. Bileşen imzasını şununla değiştir:
```tsx
export function RegenerateSignButton({
  date,
  audience,
  sign,
  name,
  onRegenerated,
}: {
  date: DateKey;
  audience: Audience;
  sign: SignSlug;
  name: string;
  onRegenerated?: (postId: string) => void;
}) {
```
2. `const data = … as { error?: string };` satırını şununla değiştir:
```tsx
          const data = (await response.json().catch(() => ({}))) as { error?: string; postId?: string };
```
3. Başarı dalındaki `router.refresh();` satırını şununla değiştir:
```tsx
            if (onRegenerated && data.postId) onRegenerated(data.postId);
            else router.refresh();
```

- [ ] **Step 6: Gönderi bileşenlerini yaz**

`src/components/post/slide-thumbnail.tsx`:
```tsx
'use client';

import { Thumbnail } from '@remotion/player';
import { FORMAT_SIZES, SLIDE_FPS, type SlideProps } from '@/remotion/slide-types';
import { getTemplate } from '@/remotion/templates';

export function SlideThumbnail({ templateVersion, props }: { templateVersion: string; props: SlideProps }) {
  const { width, height } = FORMAT_SIZES[props.format];
  return (
    <Thumbnail
      component={getTemplate(templateVersion).Slide}
      inputProps={props}
      compositionWidth={width}
      compositionHeight={height}
      durationInFrames={1}
      fps={SLIDE_FPS}
      frameToDisplay={0}
      style={{ width: '100%' }}
    />
  );
}
```

`src/components/post/slide-strip.tsx`:
```tsx
'use client';

import { cn } from '@/lib/utils';
import type { SlideData, SlideProps } from '@/remotion/slide-types';
import { SlideThumbnail } from './slide-thumbnail';

export function slideTitle(slide: SlideData): string {
  if (slide.type === 'cover') return 'Kapak';
  if (slide.type === 'cta') return 'Kapanış';
  return slide.signName;
}

export function SlideStrip({
  slides,
  templateVersion,
  selected,
  onSelect,
}: {
  slides: SlideProps[];
  templateVersion: string;
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ul aria-label="Slaytlar" className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
      {slides.map((props, index) => (
        <li key={index} className="w-[72vw] shrink-0 snap-center sm:w-64">
          <button
            type="button"
            aria-label={`Slayt ${index + 1}: ${slideTitle(props.slide)}`}
            aria-pressed={selected === index}
            onClick={() => onSelect(index)}
            className={cn(
              'block w-full overflow-hidden rounded-2xl border-2 transition-colors',
              selected === index ? 'border-primary' : 'border-transparent hover:border-border',
            )}
          >
            <SlideThumbnail templateVersion={templateVersion} props={props} />
          </button>
        </li>
      ))}
    </ul>
  );
}
```

`src/components/post/char-field.tsx`:
```tsx
'use client';

import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { graphemeLength } from '@/lib/text/turkish';
import { cn } from '@/lib/utils';

export function CharField({
  label,
  value,
  max,
  error,
  rows,
  onChange,
}: {
  label: string;
  value: string;
  max: number;
  error?: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const length = graphemeLength(value);
  const control = { id, value, 'aria-invalid': Boolean(error) || undefined };
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span className={cn('text-xs tabular-nums', length > max ? 'text-destructive' : 'text-muted-foreground')}>
          {length}/{max}
        </span>
      </div>
      {rows ? (
        <Textarea {...control} rows={rows} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Input {...control} onChange={(event) => onChange(event.target.value)} />
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```

`src/components/post/slide-editor.tsx`:
```tsx
'use client';

import { useId } from 'react';
import { RegenerateSignButton } from '@/components/signs/regenerate-sign-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PostDraft, SignText } from '@/lib/posts/draft';
import { EDIT_LIMITS } from '@/lib/posts/edit-schema';
import type { PostSummary } from '@/lib/posts/summary';
import type { SlideData } from '@/remotion/slide-types';
import { CharField } from './char-field';

type EditorProps = {
  draft: PostDraft;
  errors: Record<string, string>;
  onChange: (draft: PostDraft) => void;
};

export function SlideEditor({
  slide,
  post,
  draft,
  errors,
  onChange,
  onRegenerated,
}: EditorProps & { slide: SlideData; post: PostSummary; onRegenerated: (postId: string) => void }) {
  if (slide.type === 'cover') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kapak</CardTitle>
        </CardHeader>
        <CardContent>
          <CharField
            label="Kapak cümlesi"
            value={draft.hook}
            max={EDIT_LIMITS.coverHook}
            error={errors.coverHook}
            onChange={(hook) => onChange({ ...draft, hook })}
          />
        </CardContent>
      </Card>
    );
  }
  if (slide.type === 'cta') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kapanış</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Kapanış slaytı Ayarlar&apos;daki Instagram kullanıcı adını kullanır.
        </CardContent>
      </Card>
    );
  }
  const text = draft.signs[slide.sign] ?? { headline: slide.headline, body: slide.body, short: '' };
  const update = (patch: Partial<SignText>) => onChange({ ...draft, signs: { ...draft.signs, [slide.sign]: { ...text, ...patch } } });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{slide.signName}</CardTitle>
        <RegenerateSignButton date={post.date} audience={post.audience} sign={slide.sign} name={slide.signName} onRegenerated={onRegenerated} />
      </CardHeader>
      <CardContent className="space-y-4">
        <CharField
          label="Başlık"
          value={text.headline}
          max={EDIT_LIMITS.headline}
          error={errors[`${slide.sign}.headline`]}
          onChange={(headline) => update({ headline })}
        />
        <CharField
          label="Yorum"
          rows={7}
          value={text.body}
          max={EDIT_LIMITS.body}
          error={errors[`${slide.sign}.body`]}
          onChange={(body) => update({ body })}
        />
        <CharField
          label="Kısa metin (Reels)"
          rows={2}
          value={text.short}
          max={EDIT_LIMITS.short}
          error={errors[`${slide.sign}.short`]}
          onChange={(short) => update({ short })}
        />
      </CardContent>
    </Card>
  );
}

export function PostTextEditor({ draft, errors, onChange }: EditorProps) {
  const hashtagsId = useId();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Açıklama ve format</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <CharField
          label="Caption"
          rows={6}
          value={draft.caption}
          max={EDIT_LIMITS.caption}
          error={errors.caption}
          onChange={(caption) => onChange({ ...draft, caption })}
        />
        <div className="space-y-1.5">
          <Label htmlFor={hashtagsId}>Hashtagler</Label>
          <Input id={hashtagsId} value={draft.hashtags} onChange={(event) => onChange({ ...draft, hashtags: event.target.value })} />
          <p className="text-xs text-muted-foreground">En fazla 5 hashtag; boşlukla ayır.</p>
          {errors.hashtags && (
            <p role="alert" className="text-sm text-destructive">
              {errors.hashtags}
            </p>
          )}
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Format</legend>
          {(
            [
              ['4x5', '4:5 (1080×1350)'],
              ['3x4', '3:4 (1080×1440)'],
            ] as const
          ).map(([value, text]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="format"
                value={value}
                checked={draft.format === value}
                onChange={() => onChange({ ...draft, format: value })}
                className="size-4 accent-primary"
              />
              {text}
            </label>
          ))}
        </fieldset>
      </CardContent>
    </Card>
  );
}
```

`src/components/post/export-panel.tsx`:
```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AnimatedCircularProgressBar } from '@/components/ui/animated-circular-progress-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PostSummary } from '@/lib/posts/summary';
import { formatCaption } from '@/lib/render/caption';
import { canShareFiles, saveBlob } from '@/lib/render/deliver';
import { CAPTION_FILE_NAME, postBaseName, slideFileName, zipFileName } from '@/lib/render/file-names';
import { renderPostImages } from '@/lib/render/render-images';
import { buildZip } from '@/lib/render/zip';
import type { SlideProps } from '@/remotion/slide-types';

const JSON_HEADERS = { 'content-type': 'application/json' };

export function ExportPanel({ post, slides, blocked }: { post: PostSummary; slides: SlideProps[]; blocked: boolean }) {
  const router = useRouter();
  const controller = useRef<AbortController | null>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: slides.length });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const baseName = postBaseName(post);
  const caption = formatCaption(post.caption, post.hashtags);
  const shareable = files !== null && canShareFiles(files);

  useEffect(() => () => controller.current?.abort(), []);

  async function prepare() {
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setError(null);
    setFiles(null);
    setProgress({ done: 0, total: slides.length });
    try {
      const blobs = await renderPostImages({
        templateVersion: post.templateVersion,
        slides,
        signal: abort.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setFiles(blobs.map((blob, index) => new File([blob], slideFileName(baseName, index, slides[index].slide), { type: 'image/jpeg' })));
    } catch (caught) {
      if (!abort.signal.aborted) setError(caught instanceof Error ? caught.message : 'Görseller hazırlanamadı.');
    } finally {
      setRunning(false);
    }
  }

  async function markDownloaded() {
    await fetch(`/api/posts/${post.id}/status`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ action: 'downloaded' }) }).catch(
      () => null,
    );
    router.refresh();
  }

  async function downloadZip() {
    if (!files) return;
    const entries = await Promise.all(files.map(async (file) => ({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) })));
    entries.push({ name: CAPTION_FILE_NAME, data: new TextEncoder().encode(caption) });
    saveBlob(new Blob([new Uint8Array(buildZip(entries))], { type: 'application/zip' }), zipFileName(baseName));
    await markDownloaded();
  }

  async function share() {
    if (!files) return;
    try {
      await navigator.share({ files, title: baseName });
      await markDownloaded();
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === 'AbortError')) toast.error('Paylaşım açılamadı.');
    }
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      toast.success('Caption kopyalandı.');
    } catch {
      toast.error('Kopyalanamadı; metni elle seç.');
    }
  }

  async function togglePublished() {
    const published = post.status !== 'paylasildi';
    const response = await fetch(`/api/posts/${post.id}/status`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'published', value: published }),
    }).catch(() => null);
    if (!response?.ok) {
      toast.error('Durum güncellenemedi.');
      return;
    }
    toast.success(published ? 'Paylaşıldı olarak işaretlendi.' : 'Paylaşıldı işareti kaldırıldı.');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>İndir ve paylaş</CardTitle>
        <CardDescription>Görseller tarayıcında hazırlanır; bu sırada sekmeyi açık tut.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {blocked && <p className="text-sm text-muted-foreground">Önce değişiklikleri kaydet; indirme kayıtlı sürümü kullanır.</p>}
        {!files && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={running || blocked} onClick={() => void prepare()}>
              {running ? 'Hazırlanıyor…' : "JPEG'leri hazırla"}
            </Button>
            {running && (
              <Button type="button" variant="ghost" onClick={() => controller.current?.abort()}>
                İptal
              </Button>
            )}
          </div>
        )}
        {(running || files) && (
          <div className="flex items-center gap-4">
            <AnimatedCircularProgressBar
              className="size-20 text-base"
              max={progress.total}
              value={progress.done}
              gaugePrimaryColor="#7a5aa6"
              gaugeSecondaryColor="#f3e8f5"
            />
            <p aria-live="polite" className="text-sm">
              {progress.done}/{progress.total} görsel hazır
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {files && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void downloadZip()}>
              ZIP indir
            </Button>
            {shareable && (
              <Button type="button" variant="secondary" onClick={() => void share()}>
                Paylaş / Fotoğraflara kaydet
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => setFiles(null)}>
              Yeniden hazırla
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => void copyCaption()}>
            Caption&apos;ı kopyala
          </Button>
          <Button type="button" variant="outline" onClick={() => void togglePublished()}>
            {post.status === 'paylasildi' ? 'Paylaşıldı işaretini kaldır' : 'Paylaşıldı olarak işaretle'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

`src/components/post/post-workspace.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AUDIENCE_LABELS } from '@/lib/content/types';
import { formatDateLongTr } from '@/lib/date/istanbul';
import { applyDraft, createDraft, draftToEdit, isEmptyEdit, type DraftSource } from '@/lib/posts/draft';
import { STATUS_LABELS, type PostSummary, type VersionSummary } from '@/lib/posts/summary';
import { cn } from '@/lib/utils';
import type { SlideProps } from '@/remotion/slide-types';
import { ExportPanel } from './export-panel';
import { PostTextEditor, SlideEditor } from './slide-editor';
import { SlideStrip } from './slide-strip';

export function PostWorkspace({
  post,
  slides,
  source,
  versions,
}: {
  post: PostSummary;
  slides: SlideProps[];
  source: DraftSource;
  versions: VersionSummary[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => createDraft(source));
  const [selected, setSelected] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const preview = useMemo(() => applyDraft(slides, draft), [slides, draft]);
  const edit = useMemo(() => draftToEdit(source, draft), [source, draft]);
  const dirty = !isEmptyEdit(edit);
  const current = versions.find((version) => version.isCurrent);
  const openPost = (postId: string) => router.push(`/gonderi/${postId}`);

  async function save() {
    setSaving(true);
    setErrors({});
    const response = await fetch(`/api/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(edit),
    }).catch(() => null);
    const data = ((await response?.json().catch(() => null)) ?? {}) as {
      status?: string;
      postId?: string;
      error?: string;
      errors?: Record<string, string>;
    };
    setSaving(false);
    if (response?.ok && data.status === 'created' && data.postId) {
      toast.success('Yeni sürüm kaydedildi.');
      openPost(data.postId);
      return;
    }
    if (response?.ok) {
      toast.info('Değişiklik yok.');
      return;
    }
    if (data.errors) setErrors(data.errors);
    toast.error(data.error ?? 'Kaydedilemedi.');
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">{formatDateLongTr(post.date)}</p>
        <h1 className="font-heading text-3xl sm:text-4xl">{AUDIENCE_LABELS[post.audience]} burç yorumları</h1>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Sürüm {post.version}</Badge>
          <Badge variant="secondary" data-testid="post-status">
            {STATUS_LABELS[post.status]}
          </Badge>
        </div>
      </header>

      {!post.isCurrent && current && (
        <p role="status" className="rounded-xl border bg-secondary p-3 text-sm">
          Bu eski bir sürüm; yalnızca indirilebilir.{' '}
          <Link href={`/gonderi/${current.id}`} className="font-semibold underline">
            Güncel sürüme git
          </Link>
        </p>
      )}

      <SlideStrip slides={preview} templateVersion={post.templateVersion} selected={selected} onSelect={setSelected} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {post.isCurrent && (
            <>
              <SlideEditor
                slide={preview[selected].slide}
                post={post}
                draft={draft}
                errors={errors}
                onChange={setDraft}
                onRegenerated={openPost}
              />
              <PostTextEditor draft={draft} errors={errors} onChange={setDraft} />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>
                  {saving ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
                </Button>
                {dirty && <span className="text-sm text-muted-foreground">Kaydedilmemiş değişiklikler var.</span>}
              </div>
            </>
          )}
        </div>
        <aside className="space-y-6">
          <ExportPanel post={post} slides={slides} blocked={dirty} />
          <nav aria-label="Sürümler" className="space-y-2">
            <h2 className="text-sm font-medium">Sürümler</h2>
            <ul className="space-y-1 text-sm">
              {versions.map((version) => (
                <li key={version.id}>
                  <Link
                    href={`/gonderi/${version.id}`}
                    aria-current={version.id === post.id ? 'page' : undefined}
                    className={cn('hover:underline', version.id === post.id && 'font-semibold')}
                  >
                    Sürüm {version.version}
                    {version.isCurrent ? ' (güncel)' : ''}
                  </Link>
                  <span className="text-muted-foreground"> · {STATUS_LABELS[version.status]}</span>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </section>
  );
}
```

`src/app/(app)/gonderi/[id]/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { PostWorkspace } from '@/components/post/post-workspace';
import { getDb } from '@/db/client';
import { getPostDetail, getPostVersions } from '@/lib/posts/repository';
import { brandFromSettings, buildSlideProps } from '@/lib/posts/slide-props';
import { toDraftSource, toPostSummary, toVersionSummary } from '@/lib/posts/summary';
import { getSettings } from '@/lib/settings/repository';

export const metadata: Metadata = { title: 'Gönderi' };

export default async function PostPage(props: PageProps<'/gonderi/[id]'>) {
  await connection();
  const { id } = await props.params;
  const db = getDb();
  const detail = await getPostDetail(db, id);
  if (!detail) notFound();
  const { post } = detail;
  const [settings, versions] = await Promise.all([
    getSettings(db),
    getPostVersions(db, { date: post.date, kind: post.kind, audience: post.audience }),
  ]);
  return (
    <PostWorkspace
      key={post.id}
      post={toPostSummary(post)}
      slides={buildSlideProps(detail, brandFromSettings(settings))}
      source={toDraftSource(detail)}
      versions={versions.map(toVersionSummary)}
    />
  );
}
```
(`key={post.id}`, yeni sürüme geçişte taslak durumunu sıfırlar.)

- [ ] **Step 7: Testlerin geçtiğini gör**

Run: `npx vitest run src/lib/render && npm run typecheck && npm run lint && npm run test:e2e -- e2e/post.spec.ts`
Expected: deliver testleri ve beş gönderi E2E testi PASS.

Şu durumlarda ne yapılacağı:
- `bodiesFit` false dönerse metin kartı taşıyor demektir. `sign-slide.tsx` içindeki `bodyFontSize` basamakları ya da kart boşlukları küçültülür ve Task 4 testindeki px beklentileri aynı değerlere güncellenir. Kural olarak ledger'a yazılır.
- Font testi false dönerse `fonts.ts` alt kümeleri ve `waitForFonts` akışı incelenir.

- [ ] **Step 8: Tüm kontroller**

Run: `npm test && npm run test:e2e && npm run build`
Expected: PASS.

- [ ] **Step 9: Görsel kontrol**

1. E2E sunucusunu arka planda başlat: `npx tsx e2e/test-server.ts`.
2. Giriş yap ve bir gönderi üret. Playwright betiğiyle masaüstünde (1280 px) ve mobilde (390 px) `/gonderi/<id>` ekran görüntüsü al.
3. İndirilen ZIP'ten kapak, bir burç ve kapanış JPEG'ini `Read` ile aç. Şunları kontrol et:
   - Türkçe harfler doğru görünüyor.
   - Burç sembolü okunaklı.
   - Filigran içerikle çakışmıyor.
   - Kartlar taşmıyor.
   - Mobilde slayt şeridi yatay kayıyor ve alt menü içeriği örtmüyor.

Sorunları düzelt ve rapora yaz.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: gönderi sayfası — önizleme, düzenleme, tarayıcıda JPEG, ZIP, paylaşım ve caption" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Arşiv, menü ve Bugün sayfasından gönderiye geçiş

**Files:**
- Create: `src/app/(app)/arsiv/page.tsx`
- Modify: `src/components/app-shell/nav-items.ts`, `src/app/(app)/page.tsx`, `src/components/today/daily-package-panel.tsx`
- Test: `e2e/archive.spec.ts`

**Interfaces:**
- Consumes: Task 2 (`listArchivePosts`, `PostStatus`), Task 3 (`buildCoverProps`, `brandFromSettings`, `audienceOf`, `STATUS_LABELS`), Task 8 (`SlideThumbnail`, `freshPost`, `downloadPostZip`)
- Kapsam notu: Spec'teki "takvim görünümü" ve "tür" süzgeci ertelendi. Tarihe göre gruplanmış liste bu fazın ihtiyacını karşılıyor. Tür süzgeci, tarot geldiğinde (Faz 3) eklenecek.
- Produces:
  - `/arsiv?kitle=kadin|erkek&durum=taslak|indirildi|paylasildi&once=YYYY-MM-DD`. Sayfa başına 30 gönderi gösterilir, "Daha eski" bağlantısı sonraki sayfaya geçer.
  - Menüde `Arşiv` bağlantısı.
  - `DailyPackagePanel` öğelerinde `postId: string | null` alanı ve hazır öğeler için `Gönderiyi aç` bağlantısı.

- [ ] **Step 1: Başarısız E2E testini yaz**

`e2e/archive.spec.ts`:
```ts
import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { addDays, istanbulDateKey } from '../src/lib/date/istanbul';
import { downloadPostZip, freshPost, login } from './helpers';

// Arşiv testleri alfabetik olarak generate.spec'ten önce koşar. Bugünün paketini doldurup
// oradaki "Günün paketini oluştur" düğmesini devre dışı bırakmamak için yarının tarihi kullanılır.
const TOMORROW = addDays(istanbulDateKey(), 1);

function imageHashes(files: Record<string, Uint8Array>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files)
      .filter(([name]) => name.endsWith('.jpg'))
      .map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')]),
  );
}

test('arşiv güncel gönderileri listeler, kitleye göre süzer ve gönderiyi açar', async ({ page }) => {
  await login(page);
  for (const audience of ['kadin', 'erkek'] as const) {
    await page.request.post('/api/generate', { data: { date: TOMORROW, audience } });
  }
  await page.getByRole('navigation', { name: 'Ana menü' }).getByRole('link', { name: 'Arşiv' }).click();
  await expect(page.getByRole('link', { name: /Kadın burç yorumları$/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Erkek burç yorumları$/ }).first()).toBeVisible();
  await page.getByRole('navigation', { name: 'Kitle' }).getByRole('link', { name: 'Erkek' }).click();
  await expect(page).toHaveURL(/kitle=erkek/);
  await expect(page.getByRole('link', { name: /Kadın burç yorumları$/ })).toHaveCount(0);
  await page.getByRole('link', { name: /Erkek burç yorumları$/ }).first().click();
  await expect(page).toHaveURL(/\/gonderi\//);
});

test('arşivdeki eski sürüm ilk indirmedeki görsellerle birebir aynı yeniden üretilir', async ({ page }) => {
  await login(page);
  const oldId = await freshPost(page, 'kadin', TOMORROW);
  await page.goto(`/gonderi/${oldId}`);
  const before = imageHashes(await downloadPostZip(page));
  expect(Object.keys(before)).toHaveLength(14);

  await page.getByLabel('Kapak cümlesi').fill('Yeni sürümün kapak cümlesi');
  await page.getByRole('button', { name: 'Değişiklikleri kaydet' }).click();
  await expect(page).not.toHaveURL(new RegExp(oldId));

  await page.getByRole('navigation', { name: 'Ana menü' }).getByRole('link', { name: 'Arşiv' }).click();
  await page.getByRole('link', { name: /Kadın burç yorumları$/ }).first().click();
  await page.getByRole('navigation', { name: 'Sürümler' }).locator(`a[href="/gonderi/${oldId}"]`).click();
  await expect(page.getByText('Bu eski bir sürüm; yalnızca indirilebilir.')).toBeVisible();
  expect(imageHashes(await downloadPostZip(page))).toEqual(before);
});

test('Bugün sayfasından hazır gönderi açılır', async ({ page }) => {
  await login(page);
  await page.request.post('/api/generate', { data: { date: istanbulDateKey(), audience: 'kadin' } });
  await page.goto('/');
  await page.getByRole('link', { name: 'Gönderiyi aç' }).first().click();
  await expect(page).toHaveURL(/\/gonderi\//);
  await expect(page.getByRole('button', { name: /^Slayt \d+:/ })).toHaveCount(14);
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `npm run test:e2e -- e2e/archive.spec.ts`
Expected: FAIL. Menüde `Arşiv` bağlantısı ve Bugün sayfasında `Gönderiyi aç` bulunamaz.

- [ ] **Step 3: Menü, Bugün sayfası ve arşiv sayfasını yaz**

`src/components/app-shell/nav-items.ts`:
```ts
import { Archive, Settings, Stars, Sun, type LucideIcon } from 'lucide-react';

export const NAV_ITEMS: readonly { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Bugün', icon: Sun },
  { href: '/burclar', label: 'Burçlar', icon: Stars },
  { href: '/arsiv', label: 'Arşiv', icon: Archive },
  { href: '/ayarlar', label: 'Ayarlar', icon: Settings },
];
```

`src/app/(app)/page.tsx` içindeki `items` hesabını şununla değiştir:
```tsx
  const items = settings.dailyPlan.map((item) => {
    const post = posts.find((candidate) => candidate.kind === item.kind && candidate.audience === item.audience);
    return { ...item, ready: Boolean(post), postId: post?.id ?? null };
  });
```

`src/components/today/daily-package-panel.tsx`:
1. İmportlara ekle:
```tsx
import Link from 'next/link';
```
2. `buttonVariants` importunu mevcut `Button` importuna ekle:
```tsx
import { Button, buttonVariants } from '@/components/ui/button';
```
3. `type Item` satırını şununla değiştir:
```tsx
type Item = { kind: 'horoscope'; audience: Audience; ready: boolean; postId: string | null };
```
4. Liste öğesinin içindeki `<Badge …>` satırını şununla değiştir:
```tsx
              <span className="flex items-center gap-2">
                {item.postId && (
                  <Link href={`/gonderi/${item.postId}`} className={buttonVariants({ variant: 'link', size: 'sm' })}>
                    Gönderiyi aç
                  </Link>
                )}
                <Badge variant={item.ready ? 'secondary' : 'outline'}>{item.ready ? 'Hazır' : 'Bekliyor'}</Badge>
              </span>
```

`src/app/(app)/arsiv/page.tsx`:
```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { SlideThumbnail } from '@/components/post/slide-thumbnail';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { getDb } from '@/db/client';
import { AUDIENCE_LABELS } from '@/lib/content/types';
import { formatDateLongTr, formatDateShortTr, isDateKey } from '@/lib/date/istanbul';
import { listArchivePosts, type PostStatus } from '@/lib/posts/repository';
import { audienceOf, brandFromSettings, buildCoverProps } from '@/lib/posts/slide-props';
import { STATUS_LABELS } from '@/lib/posts/summary';
import { getSettings } from '@/lib/settings/repository';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Arşiv' };

const PAGE_SIZE = 30;
const STATUS_FILTERS: PostStatus[] = ['taslak', 'indirildi', 'paylasildi'];
type Filters = { kitle?: string; durum?: string; once?: string };

function archiveHref(filters: Filters): string {
  const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const text = query.toString();
  return text ? `/arsiv?${text}` : '/arsiv';
}

function FilterNav({ label, options, active, href }: { label: string; options: [string | undefined, string][]; active: string | undefined; href: (value: string | undefined) => string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      {options.map(([value, text]) => (
        <Link
          key={text}
          href={href(value)}
          aria-current={active === value ? 'page' : undefined}
          className={cn('rounded-full px-3 py-1', active === value ? 'bg-primary text-primary-foreground' : 'bg-secondary')}
        >
          {text}
        </Link>
      ))}
    </nav>
  );
}

export default async function ArchivePage(props: PageProps<'/arsiv'>) {
  await connection();
  const params = await props.searchParams;
  const kitle = params.kitle === 'kadin' || params.kitle === 'erkek' ? params.kitle : undefined;
  const durum = STATUS_FILTERS.find((value) => value === params.durum);
  const once = isDateKey(params.once) ? params.once : undefined;
  const db = getDb();
  const [settings, items] = await Promise.all([
    getSettings(db),
    listArchivePosts(db, { kind: 'horoscope', audience: kitle, status: durum, before: once, limit: PAGE_SIZE }),
  ]);
  const brand = brandFromSettings(settings);
  const dates = [...new Set(items.map((post) => post.date))];
  const last = items.at(-1);

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-3">
        <h1 className="font-heading text-4xl">Arşiv</h1>
        <FilterNav
          label="Kitle"
          options={[[undefined, 'Tümü'], ['kadin', 'Kadın'], ['erkek', 'Erkek']]}
          active={kitle}
          href={(value) => archiveHref({ kitle: value, durum })}
        />
        <FilterNav
          label="Durum"
          options={[[undefined, 'Tümü'], ...STATUS_FILTERS.map((value): [string, string] => [value, STATUS_LABELS[value]])]}
          active={durum}
          href={(value) => archiveHref({ kitle, durum: value })}
        />
      </header>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">Bu süzgeçle eşleşen gönderi yok.</p>
      ) : (
        dates.map((date) => (
          <div key={date} className="space-y-3">
            <h2 className="font-heading text-2xl">{formatDateLongTr(date)}</h2>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items
                .filter((post) => post.date === date)
                .map((post) => {
                  const audience = audienceOf(post);
                  return (
                    <li key={post.id}>
                      <Link
                        href={`/gonderi/${post.id}`}
                        aria-label={`${formatDateShortTr(post.date)} · ${AUDIENCE_LABELS[audience]} burç yorumları`}
                        className="block space-y-2 rounded-2xl border bg-card p-2 transition-colors hover:border-primary"
                      >
                        <SlideThumbnail templateVersion={post.templateVersion} props={buildCoverProps(post, brand)} />
                        <span className="flex items-center justify-between gap-2 px-1 text-sm">
                          <span className="font-medium">
                            {AUDIENCE_LABELS[audience]} · Sürüm {post.version}
                          </span>
                          <Badge variant="outline">{STATUS_LABELS[post.status]}</Badge>
                        </span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))
      )}
      {items.length === PAGE_SIZE && last && (
        <Link href={archiveHref({ kitle, durum, once: last.date })} className={buttonVariants({ variant: 'outline' })}>
          Daha eski
        </Link>
      )}
    </section>
  );
}
```
(`once` sınırı tarihe göre çalışır. Aynı günün 30'dan fazla gönderisi olursa kalanlar bir sonraki sayfaya kayar. Günde en fazla 5 gönderiyle bu durum oluşmaz.)

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npm run test:e2e && npm test && npm run typecheck && npm run lint && npm run build`
Expected: Tüm E2E (auth, generate, post, archive, settings) ve birim testleri PASS. Build'de `ƒ /arsiv` ve `ƒ /gonderi/[id]` yer alır.

- [ ] **Step 5: Görsel kontrol**

Arşiv sayfasının masaüstü (1280 px) ve mobil (390 px) ekran görüntülerini al. Şunları kontrol et:
- Kapak küçük resimleri 2 sütunda görünüyor.
- Süzgeçler satır kırıyor.
- Alt menü 5 simgeyle taşmıyor.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: arşiv sayfası, menüde Arşiv ve Bugün'den gönderiye bağlantı" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Tasarım onayı ve `pastel@1`'in dondurulması (kontrolcü + kullanıcı)

> Tasarım kararı kullanıcınındır. Kontrolcü gerçek içerikle üretilmiş JPEG'leri gösterir, onay alır, sonra şablonu dondurur.

**Files:**
- Create: `scripts/template-hashes.mjs`, `src/remotion/templates/pastel-v1/freeze.test.ts`
- Modify (yalnızca kullanıcı değişiklik isterse): `src/remotion/templates/pastel-v1/*`

**Interfaces:**
- Consumes: Task 1–9
- Produces: `pastel@1` dosyalarının SHA-256 manifesti. Dondurulmuş dosyalardan biri değişirse `freeze.test.ts` kırmızıya döner.

- [ ] **Step 1: Gerçek içerikle örnek görseller üret**

1. Production veritabanından bugünün güncel kadın ve erkek gönderilerini ve bağlı yorumlarını salt okunur olarak oku. Bunları yerel bir PGlite veritabanına kopyala. Bu iş, commit edilmeyen bir scratchpad betiğiyle yapılır. Production'a yazılmaz.
2. Yerel veritabanıyla uygulamayı geçici şifre ve oturum anahtarıyla başlat.
3. Playwright betiğiyle üç ZIP indir:
   - kadın gönderisi (4:5),
   - erkek gönderisi (4:5),
   - bir gönderinin 3:4 sürümü.
4. JPEG'leri scratchpad'e çıkar.

- [ ] **Step 2: Kullanıcıya göster**

1. `artifact-design` skill'ini yükle.
2. JPEG'leri Instagram carousel'i gibi yan yana gösteren özel (private) bir Artifact sayfası yayınla. Görseller `files` ile yüklenir. Sayfada kadın, erkek ve 3:4 bölümleri olur.
3. Kullanıcıya bağlantıyı ver ve tek soru sor (AskUserQuestion). Seçenekler:
   - "Onaylıyorum"
   - "Değişiklik istiyorum" (ne değişsin, not olarak)

- [ ] **Step 3: Geri bildirimi uygula**

Değişiklik istenirse:
1. Şablonu düzenle.
2. Task 4 ve Task 8 testlerini yeniden çalıştır.
3. Görselleri yeniden üret, Artifact'i aynı adrese yeniden yayınla ve tekrar sor.

Onay gelene kadar döngü sürer. Her değişiklik ledger'a `Task 10: design change: …` olarak yazılır.

- [ ] **Step 4: Manifest betiğini yaz ve şablonu dondur**

`scripts/template-hashes.mjs`:
```js
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.join('src/remotion/templates', process.argv[2] ?? 'pastel-v1');
const hashes = Object.fromEntries(
  readdirSync(dir)
    .filter((file) => !/\.test\.tsx?$/.test(file))
    .sort()
    .map((file) => [file, createHash('sha256').update(readFileSync(path.join(dir, file))).digest('hex')]),
);
console.log(JSON.stringify(hashes, null, 2));
```

Run: `node scripts/template-hashes.mjs pastel-v1`
Expected: 10 dosyanın SHA-256 değerlerini içeren JSON.

`src/remotion/templates/pastel-v1/freeze.test.ts`:
```ts
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.join(process.cwd(), 'src/remotion/templates/pastel-v1');

// pastel@1 yayımlanmış gönderilerde kullanılıyor; görünüm değişikliği yeni klasörde (pastel-v2) yapılır.
const FROZEN: Record<string, string> = {};

describe('pastel@1', () => {
  it('dondurulmuş şablon dosyaları değişmedi', () => {
    const actual = Object.fromEntries(
      readdirSync(DIR)
        .filter((file) => !/\.test\.tsx?$/.test(file))
        .sort()
        .map((file) => [file, createHash('sha256').update(readFileSync(path.join(DIR, file))).digest('hex')]),
    );
    expect(actual).toEqual(FROZEN);
  });
});
```

Önce testi boş `FROZEN` ile çalıştır. Expected: FAIL (10 dosyalık fark). Ardından betiğin JSON çıktısını `FROZEN` nesnesine yapıştır ve tekrar çalıştır. Expected: PASS.

Run: `npx vitest run src/remotion && npm test`

- [ ] **Step 5: Commit**

```bash
git add scripts/template-hashes.mjs src/remotion/templates
git commit -m "test: onaylanan pastel@1 şablonunu dondur" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Canlı doğrulama (kontrolcü + kullanıcı)

> executing-plans akışındaki bütün dal incelemesi ve düzeltme turundan sonra, birleştirmeyle birlikte kontrolcü tarafından yürütülür.

**Files:** yok

- [ ] **Step 1: Birleştir ve deploy et**

1. Dalı `main`'e birleştir ve birleşik halde `npm test` çalıştır.
2. `git push origin main` ile production deploy'unu başlat ve `Ready` durumunu bekle.

Deploy sonrası kontroller:
```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://burc-studio.vercel.app/arsiv
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://burc-studio.vercel.app/gonderi/00000000-0000-4000-8000-000000000000
curl -s -w " %{http_code}\n" -X PATCH https://burc-studio.vercel.app/api/posts/x -d '{}'
```
Expected:
- İki sayfa `307` ile `/giris?next=…` adresine yönlenir.
- API `401 {"error":"Oturum gerekli."}` döner.

- [ ] **Step 2: Telefonda gerçek kullanım (kullanıcı)**

Kullanıcıdan iste:
1. iPhone'da Safari'den siteye girsin. Render için en az Safari 26 gerekir.
2. Bugün → Gönderiyi aç → "JPEG'leri hazırla" → "Paylaş / Fotoğraflara kaydet" yolunu izlesin.
3. 14 görselin Fotoğraflar'a kaydedildiğini ve Instagram'da carousel olarak seçilebildiğini söylesin.

Sorun bildirirse ekran görüntüsünü iste. Kontrolcü sorunu yeniden üretip düzeltir.

- [ ] **Step 3: Rapor**

Raporda şunlar yer alır:
- nelerin nasıl doğrulandığı,
- ZIP içeriği ve ölçüler,
- birebir yeniden üretim kanıtı (E2E hash testi),
- tasarım onayının durumu,
- doğrulanamayanlar: Android/Chrome paylaşımı, çok eski iOS, Instagram'ın 3:4'ü kırpma davranışı.
