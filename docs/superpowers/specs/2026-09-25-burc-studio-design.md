# Burç Stüdyosu: Tasarım Spec'i ve Uygulama Planı

> Çalışma adı: **burc-studio** (marka adı belli olunca değiştirilebilir) · Tarih: 25.09.2026
> Durum: Onaylandı (25.09.2026) · Süreç: superpowers:brainstorming → bu spec → superpowers:writing-plans (faz bazlı ayrıntılı plan)

## Bağlam

Instagram'da bir astroloji sayfası açılacak. Her gün şunlar paylaşılacak:
- 12 burç için kadın ve erkeğe ayrı günlük yorumlar,
- burçlara göre tarot yorumları (kadın ve erkeğe ayrı),
- zaman zaman dönemin gelişmelerine göre cinsiyetten bağımsız özel yorumlar.

Toplam varsayılan olarak günde 4 carousel eder.

Bu proje sadece senin erişebildiğin bir **içerik stüdyosu** olacak. Stüdyo şunları yapar:
- içeriği ücretsiz yapay zekâ kaynaklarıyla üretir,
- Instagram'a hazır görsel ve video olarak tasarlar (JPEG carousel, animasyonlu carousel, Reels),
- ürettiği her şeyi arşivler.

Kod private GitHub reposunda duracak, site Vercel'de çalışacak.

## Kararlar (soru-cevap özeti)

| Konu | Karar |
|---|---|
| Günlük paket | 4 gönderi: Kadın burç, Erkek burç, Kadın tarot, Erkek tarot. Özel gündem varsa 5. gönderi eklenir. Plan ayarlardan değiştirilebilir. |
| Çıktılar | JPEG carousel, animasyonlu carousel (slayt başına MP4) ve 9:16 Reels. |
| Metin üretimi | Ücretsiz kaynaklar ve çok sağlayıcılı yedekleme (çapraz üretim). Geliştirme ve testte yerel Ollama kullanılır. |
| Özel yorumlar | Astrolojik olaylar (otomatik hesaplanır) ile gündem ve özel günler (serbest konu). Cinsiyetten bağımsız. |
| Tarot | Her burca günün tek kartı. Kadın ve erkek için ayrı çekiliş, her çekilişte 12 burca birbirinden farklı kart. Yalnızca düz kart. |
| Tarot görselleri | Kodla çizilen özel minimal tasarım (SVG). |
| Stil / Ton | Pastel ve yumuşak / samimi-pozitif ile eğlenceli-esprili harmanı. |
| Render | Tarayıcıda (`@remotion/web-renderer`). Sunucu, kota ve maliyet yok. |
| Arşiv | Veri ve birebir yeniden üretim. Medya dosyası saklanmaz, şablonlar sürümlüdür. |
| Ekstralar | Caption ve hashtag (**en fazla 5**, Instagram sınırı), şans puanları (aşk/para/sağlık) ile şanslı renk ve sayı (burç gönderilerinde), CTA kapanış slaytı, Reels müziği. |
| Marka | Ayarlarda Instagram kullanıcı adı alanı. Kartların altında küçük filigran, açılıp kapatılabilir, konumu ayarlanabilir. Ad boşsa filigran görünmez. |
| Erişim | Uygulama içinde tek kullanıcılı şifreli giriş. Password Protection Hobby planında yok. Vercel Authentication açıkken cron'un çalışıp çalışmadığı dokümanda net değil. |
| Veritabanı | Neon Postgres (Vercel Marketplace, Free plan: 0.5 GB, 100 CU-saat/ay, kart gerekmez) ve Drizzle. |

## Mimari

```
Tarayıcı (Mac / telefon)
  Next.js arayüzü (Magic UI) + Remotion Player + @remotion/web-renderer
  → JPEG / MP4 / Reels burada üretilir → ZIP indir veya Web Share ile paylaş
        │  şifreli oturum çerezi
        ▼
Vercel (Hobby) — Next.js 16 route handler / server action
  ├─ İçerik motoru ─ LLM yönlendirici ─► AI Gateway → Gemini API → Ollama Cloud → (+opsiyonel)
  │                 ├─ Gökyüzü modülü (astronomy-engine)
  │                 └─ Tarot çekilişi
  ├─ Neon Postgres (Drizzle): metinler + sürümler, gönderiler, ayarlar, üretim logları
  ├─ Vercel Blob (private): yalnızca Reels müzik dosyaları
  └─ Vercel Cron (günde 1, ~06:00 TSİ) → /api/cron/daily
Mac (opsiyonel yedek): npm run generate:local → yerel Ollama → aynı Neon DB
```

## Teknoloji yığını

Sürümler 25.09.2026'da `npm view` ile doğrulandı.

- **Uygulama:**
  - Next.js 16.3 (App Router, TypeScript), React 19.3, Tailwind v4, shadcn/ui.
  - Magic UI yerel vendor'dan kurulur: `npx shadcn@latest add ~/.agents/skills/magic-ui/vendor/r/<slug>.json`.
- **Video:** Remotion 4.0.529. Kullanılan paketler: `remotion`, `@remotion/player`, `@remotion/web-renderer`, `@remotion/google-fonts`, `@remotion/layout-utils`, `@remotion/paths`, `@remotion/transitions`, `@remotion/media`.
- **LLM:** AI SDK 7 (`ai`), `@ai-sdk/gateway`, `@ai-sdk/google`, `@ai-sdk/openai-compatible`.
- **Veri ve kütüphaneler:**
  - Gökyüzü hesabı: astronomy-engine 2.1.19.
  - Veritabanı: drizzle-orm 0.45, drizzle-kit, `@neondatabase/serverless`.
  - Diğerleri: zod 4, jose 6, fflate (ZIP), `@vercel/blob` 2.8.
- **Test:** Vitest 5 (browser mode, Playwright ile), PGlite (bellek içi Postgres).
- **Ortam:** Paket yöneticisi npm, mevcut Remotion projen de npm kullanıyor. Vercel'de Node 24 LTS kullanılacak; destek Faz 0'da doğrulanacak.

## 1. İçerik motoru

### 1.1 Gökyüzü modülü (`src/lib/astro/`)

API'si astronomy-engine README'sinden doğrulandı.

- **Boylam hesabı:** Tropikal burç boylamı `Ecliptic(GeoVector(body, date, true)).elon` ile hesaplanır. Bu, doğrudan tarih ekliptiğini (true ecliptic of date) verir. Güneş için `SunPosition`, Ay için `EclipticGeoMoon` kullanılır. Burç = ⌊boylam / 30⌋.
- **Günlük özet (prompt'a girer):**
  - Güneş ve Ay burcu,
  - Ay evresi (`MoonPhase`),
  - retrodaki gezegenler (günlük boylam farkının işaretiyle),
  - bugünkü burç geçişleri,
  - 3 gün içinde yeni ay veya dolunay varsa o bilgi (`SearchMoonQuarter`).
- **45 günlük takvim (özel gündem için):**
  - ay evreleri ve düştükleri burç,
  - tutulmalar (`SearchLunarEclipse`, `SearchGlobalSolarEclipse`),
  - Merkür, Venüs, Mars, Jüpiter ve Satürn'ün retro başlangıç ve bitişleri,
  - Güneş, Venüs ve Mars'ın burç geçişleri.
- Tüm "gün" hesapları Europe/Istanbul saat dilimine göre yapılır.

### 1.2 LLM yönlendirici (`src/lib/llm/`)

Çapraz üretim ve failover bu katmanda yapılır.

**Sağlayıcı zinciri.** Ayarlardan sıralanabilir. Her sağlayıcının modeli, günlük istek tavanı ve açık/kapalı durumu vardır.
1. **Vercel AI Gateway:** `google/gemini-2.5-flash`. Her ay 5 dolar ücretsiz kredi var ve Vercel'de OIDC ile anahtarsız çalışır. Liste fiyatı $0.30 / $2.50 per 1M token, tahmini kullanımımız ayda 1–3 dolar.
2. **Gemini API ücretsiz anahtarı:** Önce Flash, ardından Flash-Lite (yaklaşık 20 ve 500 istek/gün). Google limitleri habersiz değiştiriyor.
3. **Ollama Cloud ücretsiz katmanı:** `https://ollama.com` API'si Bearer anahtarla çalışır. DeepSeek, Kimi veya GLM gibi bir bulut modeli kullanılır. OpenAI uyumlu uç nokta Faz 1'de doğrulanacak, çalışmazsa native `/api/chat` adaptörü yazılır.
4. **Opsiyonel:** Groq, OpenRouter (`:free` modeller) ve Cerebras. İlgili env anahtarı varsa zincire otomatik eklenir.

**Hata davranışı.**

| Hata | Davranış |
|---|---|
| 429 / kota | Hemen sıradaki sağlayıcıya geç. Sağlayıcıyı o gün için "dolu" işaretle. |
| 5xx / zaman aşımı | 1 kez tekrar dene, sonra sıradakine geç. |
| Şema veya kalite hatası | Aynı sağlayıcıda 1 kez tekrar dene, sonra sıradakine geç. |

- Günlük tavanı dolan sağlayıcı önceden atlanır. Tavan hesabı `llm_calls` tablosundaki sayımlarla yapılır.
- Her deneme `llm_calls` tablosuna yazılır. Her metin hangi sağlayıcı ve modelden geldiğini saklar.
- Zincir tükenirse net bir hata gösterilir ve "yerel üret" önerilir. Sessiz başarısızlık yoktur.
- **Yük dağıtımı ayarı:** Varsayılan kapalı. Açılırsa günün istekleri sağlıklı sağlayıcılar arasında sırayla dağıtılır.

**Geliştirme ve test.**
- `LLM_PROVIDER_OVERRIDE=ollama-local` ile yerel `http://localhost:11434/v1` kullanılır (`gemma4:26b` veya `qwen3.8`). Böylece kota harcanmaz.
- Otomatik testler sahte (mock) sağlayıcıyla çalışır.

**Acil durum yedeği.** `scripts/generate-local.ts` Mac'te yerel Ollama ile üretir ve aynı veritabanına yazar.

### 1.3 Üretim çağrıları

Her çağrı 12 burcu tek istekte üretir. Çıktı zod şemalı JSON'dur.

**Günlük burç** (kadın veya erkek). Her burç için:
- `baslik` (≤40 karakter),
- `yorum` (280–420 karakter, carousel metni),
- `kisa` (≤140 karakter, Reels metni),
- `puanlar {ask, para, saglik}` (1–5),
- `sansliRenk` (pastel paletten seçilen enum),
- `sansliSayi` (1–99).

**Tarot** (kadın veya erkek). Kartları sistem çeker ve prompt'a verir. Model her burç için yalnızca `yorum` ve `kisa` yazar.

**Özel gündem** (cinsiyetsiz). Girdi konu ve bağlam metnidir. Çıktı her burç için `yorum` ve `kisa`dır.

**Her gönderi için ortak alanlar:**
- `kapakKanca` (≤60 karakter),
- `caption` (≤700 karakter),
- `hashtagler` (**en fazla 5**, çünkü Instagram Aralık 2025'ten beri fazlasını yok sayıyor): ayarlardaki 2 temel hashtag ve modelin önerdiği en fazla 3 hashtag.

**Prompt'un içeriği:**
- Sabit stil rehberi:
  - Türkçe ve "sen" dili; samimi, pozitif ve hafif esprili bir ton.
  - En fazla 2 emoji.
  - Sağlık veya finans talimatı yok, kaderci ya da korkutucu dil yok.
  - Kadın ve erkek versiyonları bakış açısında ayrışır, aşağılayıcı kalıp yargı içermez.
- Gökyüzü özeti ve burç özellikleri.
- Tarot kartlarının Türkçe anlamları.
- Tekrarı önlemek için son 2 günün aynı burç için `baslik` ve `kisa` metinleri.
- `PROMPT_VERSION` her metinle birlikte saklanır.

**Hacim tahmini:** Günde 4 temel istek, özel gündem ve yeniden üretimlerle birlikte 5–20 istek. Yaklaşık 45 bin giriş ve 15 bin çıktı token'ı (tahmini).

### 1.4 Kalite kapısı

Her çıktı şu kontrollerden geçer:
- zod şeması ve 12 burcun eksiksiz gelmesi,
- uzunluk aralıkları,
- Türkçe dil ve karakter kontrolü (İngilizce çıktıyı yakalamak için),
- yasaklı ifade listesi,
- emoji sayısı,
- en fazla 5 hashtag.

Tek bir burç geçemezse yalnızca o burç için yeniden istek atılır.

### 1.5 Tarot (`src/lib/tarot/`)

- **Deste:** 78 kartın Türkçe adları ve anahtar kelimeleri.
  - Büyük Arkana: 22 kart.
  - Küçük Arkana: Kupa, Değnek, Kılıç ve Tılsım takımlarının her birinde As–10, Prens, Şövalye, Kraliçe ve Kral.
- **Çekiliş:** Her gün, her audience (kadın/erkek) için deste `crypto` ile karıştırılır. İlk 12 kart sırayla 12 burca atanır, tekrar olmaz.
- Çekiliş veritabanına yazılır. "Kartları yeniden çek" yeni bir sürüm oluşturur ve iki şekilde kullanılabilir:
  - tüm gönderi için 12 kartı birden yeniden çeker,
  - ya da tek bir burcun kartını, diğer 11 kartı dışarıda bırakarak yeniden çeker. Böylece kartlar tekrarsız kalır.

### 1.6 Özel gündem

`/ozel` sayfasında üç kaynak listelenir:
- 45 günlük gökyüzü takvimi,
- Türkiye özel günleri: 14 Şubat, 8 Mart, Anneler ve Babalar Günü, yılbaşı, 2026–2028 Ramazan ve Kurban Bayramı (sabit liste),
- serbest konu formu.

Seçilen konu için tek tıkla 12 burçluk cinsiyetsiz yorum ve bir özel gönderi üretilir.

Bugün bir olay varsa ana sayfada bir öneri kartı çıkar ("Bugün Dolunay (Koç'ta). Özel gönderi üretilsin mi?"). Otomatik üretim yapılmaz, karar sende kalır.

## 2. Veri modeli (`src/db/schema.ts`, Drizzle)

- **`readings`:** Bir burcun tek bir yorumu.
  - Alanlar: `id`, `date`, `kind` (horoscope|tarot|special), `audience` (kadin|erkek|genel), `sign`, `topic_id?`, `version`, `is_current`, `headline`, `body`, `short`, `meta jsonb {scores, luckyColor, luckyNumber, tarotCardId}`, `provider`, `model`, `prompt_version`, `run_id`, `edited_at`, `created_at`.
  - Kısıt: `(date, kind, audience, sign, topic_id)` üzerinde `WHERE is_current` koşullu unique index.
- **`posts`:** Bir Instagram gönderisi.
  - Alanlar: `id`, `date`, `kind`, `audience`, `topic_id?`, `version`, `is_current`, `status` (taslak|hazir|indirildi|paylasildi), `template_version`, `format` (4x5|3x4), `cover jsonb`, `caption`, `hashtags text[]`, `downloaded_at`, `published_at`, `created_at`.
- **`post_slides`:** Gönderinin slaytları.
  - Alanlar: `post_id`, `position`, `type` (cover|sign|cta), `reading_id?`.
  - Her slayt belirli bir metin sürümüne bağlıdır. Birebir yeniden üretimin temeli budur.
- **`topics`:** Özel gündem konuları.
  - Alanlar: `id`, `title`, `context`, `event_type` (lunation|eclipse|retrograde|ingress|special_day|custom), `event_at`, `source` (auto|manual).
- **`generation_runs` ve `llm_calls`:** Her üretim çalışması ve her LLM denemesi.
  - `llm_calls` alanları: `provider`, `model`, `status`, `http_status`, `error`, `tokens`, `latency`.
  - Kota takibi ve hata ayıklama bu tablolardan yapılır.
- **`settings`:** Tek satırlık jsonb.
  - Alanlar: `instagramHandle`, `watermark {enabled, position, opacity}`, `dailyPlan`, `cronEnabled`, `defaultFormat`, `providerChain`, `baseHashtags` (2 adet), `reels {secondsPerSign, musicId, musicVolume}`.
- **`music_tracks`:** `id`, `title`, `blob_pathname`, `duration_sec`.
- **`login_attempts`:** `ip`, `count`, `window_start`.

Hiçbir üretim silinmez. Yeniden üretim yeni bir sürüm ekler ve eski sürüm arşivde kalır.

## 3. Görsel sistem (`src/remotion/`)

**Şablon ve kompozisyonlar**
- **Şablon `pastel@1`:** Bir gönderide kullanıldığı anda dondurulur. Sonraki değişiklikler `pastel@2` olarak yapılır. Her gönderi kendi `template_version` değerini saklar.
- **Kompozisyonlar:**
  - `CoverSlide`
  - `SignSlide`: burç sembolü ve adı, tarih aralığı, başlık, yorum, yıldızlı puanlar, şanslı renk dairesi ve sayı.
  - `TarotSlide`: burç, minimal kart, kart adı ve yorum.
  - `SpecialSlide`
  - `CtaSlide`: "Kaydet 🔖 · Arkadaşını etiketle 💌 · Takip et ✨" ve kullanıcı adı.
- **`AnimatedSlide`:** Aynı slaydın 6 saniyelik girişli video hali. Son karesi JPEG ile birebir aynıdır.
- **`Reels`:**
  - Akış: 2 sn giriş, ardından 12 burç × 6 sn (`kisa` metinler), sonra 2 sn kapanış. Toplam yaklaşık 76 sn.
  - `@remotion/transitions` ile geçişler yapılır. İsteğe bağlı müzik `<Audio>` ile fade-in ve fade-out olarak eklenir.

**Görünüm**
- **Ölçüler:** 4:5 1080×1350 (varsayılan), 3:4 1080×1440 (ayar), Reels 1080×1920. Hepsi 30 fps.
- **Palet:**
  - Temel renkler: krem zemin, lila, pudra pembe, bebek mavisi, adaçayı ve şeftali pastelleri. Çizgiler yumuşak altın, metin koyu erik (kontrast ≥ 4.5:1).
  - Vurgu renkleri: kadın için pudra-lila, erkek için bebek mavisi-adaçayı, tarot için lavanta-şeftali, özel gönderiler için şeftali-altın.
  - Burç kartlarında elemente göre hafif bir fon tonu kullanılır.
- **Tipografi:** Fontlar `@remotion/google-fonts` ile `latin-ext` alt kümesiyle yüklenir (ğ ş ı İ ö ü ç için). Başlangıç önerisi başlıklarda Fraunces, metinde Nunito. Türkçe glif testi Faz 2'de yapılır.

**Varlıklar**
- Tüm çizimler kodda SVG olarak, tek çizgi stilinde yapılır.
- 12 burç sembolü.
- Tarot tasarım sistemi:
  - 22 Büyük Arkana ikonu,
  - 4 takım sembolü,
  - As–10 için pip yerleşim motoru,
  - 4 saray işareti.
  - Bu parçalardan 78 kart sistematik olarak üretilir.
- Animasyonlar: `@remotion/paths` ile çizgi çizme, 2B kart çevirme (scaleX) ve ışıltı efekti.

**Tarayıcı render kısıtlarına uyum**
- Yalnızca doğrusal gradyan kullanılır. Radyal ışımalar SVG data-URI `<Img>` ya da `filter: blur` ile yapılır.
- `backdrop-filter`, `mix-blend-mode`, `z-index` ve `perspective` kullanılmaz.
- Tüm animasyonlar `useCurrentFrame` tabanlıdır. Magic UI, CSS ve motion animasyonları kompozisyonlarda kullanılmaz; Magic UI yalnızca site arayüzü içindir.
- Kompozisyonlar Tailwind yerine inline stil ve tasarım token'ları kullanır. Böylece Studio, Player ve web-renderer'da aynı görünür.

**Metin ve filigran**
- **Metin sığdırma:** Önce modele verilen uzunluk sınırları devreye girer. Metin yine de taşarsa `@remotion/layout-utils` `fitText` ile font küçültülür.
- **Filigran:**
  - `@kullaniciadi` biçiminde, altta, güvenli alanda durur.
  - Yaklaşık 22 px boyutunda ve %55 opaklıkta.
  - Açma-kapatma ve konum seçimi ayarlardan yapılır, önizlemesi de oradadır.
- **Tasarım iterasyonu:** Kompozisyonlar Remotion Studio'da örnek verilerle önizlenir. Sen onayladıktan sonra şablon dondurulur.

## 4. Render ve dışa aktarım (tarayıcıda)

- **Carousel:** `renderStillOnWeb` ile JPEG (kalite 0.92).
- **Video:** `renderMediaOnWeb` ile MP4 (H.264). Slayt videoları 6 sn. Reels yaklaşık 76 sn, müzik varsa ses AAC.
- **İş kuyruğu:** İşler tarayıcıda sırayla çalışır. İlerleme `onProgress` ile gösterilir, iptal `AbortSignal` ile yapılır. Arka plan sekmesi yavaşladığı için "sekmeyi açık tut" uyarısı gösterilir.
- **Teslim:**
  - Masaüstünde gönderi başına bir ZIP (fflate). Dosya adları `2026-09-25_kadin-burc_01-kapak.jpg` biçimindedir, ZIP'in içinde `caption.txt` de bulunur.
  - Mobilde Web Share API ile doğrudan paylaşım ya da Fotoğraflar'a kaydetme.
  - Ayrıca "Caption'ı kopyala" butonu.
- **Durum:** İndirme sonrası gönderi otomatik olarak `indirildi` olur. "Paylaşıldı" işaretini sen koyarsın.
- **Birebir yeniden üretim:** Arşivden, aynı `post_slides` ve `template_version` ile aynı dosyalar yeniden üretilir.

## 5. Web arayüzü (Next.js ve Magic UI, pastel tema, mobil uyumlu)

**`/giris`**
- Şifre formu.
- Pastel `particles` arka plan, `shine-border` kart.

**`/` (Bugün)**
- Tarih ve gökyüzü özeti.
- `orbiting-circles` ile burç çarkı.
- Günün 4 gönderisi `magic-card` olarak listelenir, üretim sırasında `border-beam` gösterilir.
- Büyük "Günün paketini oluştur" butonu (`shimmer-button`), bugün veya yarın seçimiyle.
- Üretim ilerlemesi `animated-list` ile, tamamlanınca `confetti`.
- Özel olay öneri kartı.

**`/gonderi/[id]`**
- Instagram gibi sağa kaydırılan önizleme (shadcn `carousel` ve Remotion `Player`/`Thumbnail`).
- Slayt bazında metin düzenleme, karakter sayacıyla.
- Tek burcu yeniden üretme, tarot için "kartları yeniden çek".
- Format seçimi, caption ve hashtag'i düzenleme ve kopyalama.
- İndirme menüsü: JPEG ZIP, animasyonlu MP4'ler, Reels (müzik seçimiyle).
- Render ilerlemesi `animated-circular-progress-bar` ile.

**`/burclar`**
- Günün tüm yorumları, kadın ve erkek sekmeleriyle.
- Sitenin "her gün yayınlanan burçlar" görünümü.

**`/ozel`**
- Gökyüzü takvimi, özel günler ve serbest konu formu.
- Seçilen konu için üretim.

**`/arsiv`**
- Takvim ve liste görünümü.
- Filtreler: tür, kadın/erkek, durum.
- Tembel yüklenen `Thumbnail` önizlemeleri ve yeniden indirme.

**`/ayarlar`**
- Kullanıcı adı ve filigran ayarları, önizlemeli.
- Günlük plan, cron açık/kapalı, varsayılan format.
- Sağlayıcı zinciri: sıralama, günlük tavanlar ve son 7 günün kullanım tablosu.
- 2 temel hashtag.
- Reels süresi ve müzik kütüphanesi (yükleme ve silme).

**Genel**
- Navigasyon: mobilde `dock`, masaüstünde yan menü.
- Ölçülü animasyonlar: `blur-fade`, `sparkles-text`, `number-ticker`.

## 6. Günlük akış

1. **Otomatik üretim:** Cron `0 3 * * *` UTC'de çalışır, yani 06:00 TSİ (Hobby'de 06:00–06:59 arası). `/api/cron/daily` adresi `CRON_SECRET` ile çağrılır. Ayar açıksa 4 LLM isteğiyle günün 4 metin setini ve 4 taslak gönderiyi üretir. İçerik zaten varsa atlar (idempotent).
2. **Gözden geçirme:** Siteye girdiğinde gönderiler hazır olur. Metinleri okur, düzenler ya da yeniden ürettirirsin.
3. **Paylaşım:** Önce indirirsin: JPEG, istersen animasyonlu MP4'ler ve Reels. Sonra Instagram'da paylaşır, gönderiyi "Paylaşıldı" olarak işaretlersin.
4. **Elle üretim:** "Günün paketini oluştur" butonu aynı işi elle yapar. "Yarın" seçeneğiyle ertesi günün paketini akşamdan hazırlayabilirsin.

Hobby planında bir fonksiyon en fazla 300 sn çalışabilir. 4 paralel istek bunun çok altında kalır (tahmini).

## 7. Güvenlik ve erişim

- **Oturum:** Tek kullanıcılı. `APP_PASSWORD_HASH` (scrypt) ve `SESSION_SECRET` (jose HS256 JWT) kullanılır. Çerez httpOnly, secure ve sameSite=lax'tır, 30 gün geçerlidir.
- **Koruma:** `proxy.ts` (Next 16), `/giris`, `/api/auth/*`, `/api/cron/*` ve statik dosyalar dışındaki her şeyi korur.
- **Giriş sınırı:** IP başına 15 dakikada en fazla 5 deneme.
- **Cron:** `Authorization: Bearer ${CRON_SECRET}` başlığı zorunlu.
- **Arama motorları:** `robots.txt` Disallow ve `X-Robots-Tag: noindex, nofollow` başlığı.
- **Önizleme deployment'ları:** Vercel Standard Protection ile korunur.
- **Anahtarlar:** Tüm API anahtarları yalnızca sunucuda, şifreli Vercel env değişkenlerinde durur.
- **Müzik:** Dosyalar private Blob'da saklanır ve kimlik doğrulamalı bir route üzerinden servis edilir.

## 8. Proje yapısı (`~/burc-studio`)

```
src/app/(auth)/giris · (app)/{page, gonderi/[id], burclar, ozel, arsiv, ayarlar}
src/app/api/{auth, generate, cron/daily, music}/
src/proxy.ts
src/lib/{astro, llm, content, tarot, zodiac, render, auth, settings, date}/
src/remotion/{index.ts, Root.tsx, templates/pastel-v1/{slides, reels, assets}}
src/components/{ui, post, render}/
src/db/{schema.ts, client.ts, migrations/}
scripts/generate-local.ts
docs/superpowers/{specs, plans}/
vercel.json (cron) · drizzle.config.ts · vitest.config.ts
```

## 9. Fazlar ve kabul kriterleri

Her faz kendi ayrıntılı planıyla (writing-plans) ve TDD ile uygulanır. Her faz doğrulamayla ve sana gösterimle biter.

| Faz | Kapsam | Kabul kriteri |
|---|---|---|
| **0: İskelet** | Private repo, Next.js 16, Tailwind, shadcn, Magic UI pastel tema, Drizzle ve Neon, giriş, ayarlar (kullanıcı adı), Vercel deploy, cron iskeleti | Vercel URL'sinde girişsiz her sayfa `/giris`'e yönlenir. Doğru şifreyle giriş yapılır. noindex başlıkları vardır. Ayarlar kaydedilir. |
| **1: Günlük burç motoru** | Gökyüzü modülü, LLM yönlendirici ve failover, prompt ve kalite kapısı, kadın/erkek üretimi, sürümleme, `/burclar`, cron. Faz 3'e kadar günlük paket yalnızca 2 burç gönderisinden oluşur. | Tek tıkla 24 geçerli Türkçe yorum üretilir (puan, renk ve sayı dahil). Birinci sağlayıcı zorla kapatıldığında ikinciden üretilir. `CRON_SECRET` olmadan cron 401 döner. |
| **2: Carousel ve JPEG** | `pastel@1` (kapak, burç, CTA, filigran), Studio'da tasarım onayı, gönderi sayfası, ZIP ve mobil paylaşım, caption, arşiv | 14 adet 1080×1350 JPEG üretilir. Türkçe karakterler doğrudur. Arşivden yeniden üretilen kare aynı hash'i verir. **Bu fazın sonunda günlük burç paylaşımına başlayabilirsin.** |
| **3: Tarot** | 78 kart verisi, minimal kart tasarım sistemi, ayrı çekilişler, tarot prompt'ları ve slaytları | Her audience'ta 12 farklı kart çıkar. Paket tek tıkla 4 gönderi üretir. |
| **4: Animasyon** | Slayt MP4'leri, 9:16 Reels, müzik kütüphanesi, render kuyruğu | MP4'ler iPhone'da oynar ve Instagram'a yüklenir. Reels yaklaşık 76 sn sürer. Müzik fade-in ve fade-out yapar. |
| **5: Özel gündem** | Gökyüzü takvimi, özel günler, serbest konu, özel gönderi | Ay evreleri ve tutulmalar referans kaynaklarla ±1 saat içinde uyuşur. Özel gönderi uçtan uca üretilir. |

## 10. Doğrulama planı

- **Birim testleri (Vitest):**
  - Burç ve tarih yardımcıları.
  - Gökyüzü hesapları, bilinen tarihlere karşı: 23.09.2026 ekinoksu (Güneş Terazi'ye girer), 2026 dolunay ve retro tarihleri harici kaynaklarla karşılaştırılır.
  - Tarot çekilişinin tekrarsızlığı.
  - Yönlendirici, sahte sağlayıcılarla: 429, 5xx ve şema hatası senaryoları.
  - Kalite kapısı fixture'ları, prompt oluşturucu, oturum imzalama.
- **Veritabanı entegrasyonu (PGlite ve Drizzle migrasyonları):** Sürümleme, unique index kısıtı, idempotent cron.
- **Render testleri (Vitest browser mode, Chromium):**
  - Örnek veriyle `renderStillOnWeb` 1080×1350 boyutunda, boş olmayan bir görsel üretmeli.
  - Kısa bir MP4 oynatılabilir olmalı ve doğru sürede bitmeli.
- **Uçtan uca testler (Playwright, `LLM_MOCK=1`):** Giriş, paket oluşturma, gönderiyi açma, ZIP indirme ve içinde 14 JPEG olduğunu doğrulama.
- **Canlı ortamda doğrulama:**
  - Preview deploy'da giriş, ardından gerçek sağlayıcılarla bir paket üretme ve indirme.
  - Cron'u `vercel crons run /api/cron/daily` ile tetikleme ve logları kontrol etme.
  - Chrome DevTools MCP ile mobil görünümü kontrol etme.
- **Her faz sonunda:** `npm run lint && npm run typecheck && npm test`, görsel kontrol ve verify-done.

## 11. Senden gerekenler

1. Google AI Studio'dan ücretsiz bir Gemini API anahtarı. Yeni anahtarlar "auth key" formatında geliyor.
2. `ollama.com/settings/keys` adresinden bir Ollama API anahtarı.
3. AI Gateway'de **kredi satın alma.** Satın alırsan her ay gelen ücretsiz 5 dolar sona erer. Kart gerekmez, ilk istekle kendiliğinden etkinleşir.
4. Neon'u (Vercel Marketplace) ve private Blob store'u projeye bağlama. İşlemleri CLI ile ben yaparım, hesap onayları sende.
5. Giriş şifresini belirleme. Hash'ini ben üretip env değişkenine koyarım.
6. Opsiyonel: Groq, OpenRouter veya Cerebras'tan ücretsiz anahtarlar.
7. Tasarım onayları: Faz 2 ve 3'te Remotion Studio önizlemeleri üzerinden.

## 12. Riskler ve notlar

- **Ücretsiz katman limitleri habersiz değişiyor.** Önlemler: ayarlardan değiştirilebilen zincir sırası ve tavanlar, kullanım tablosu, yerel Ollama yedeği.
- **Vercel Hobby yalnızca ticari olmayan kullanım içindir.** Sayfa gelir getirmeye başlarsa Pro plana geçmek gerekir ($20/ay).
- **Remotion lisansı** bireyler ve en fazla 3 çalışanlı şirketler için ücretsiz. Tarayıcıda render her seferinde telemetri gönderir.
- **Tarayıcı render kısıtları:** Desteklenen CSS bir alt küme, arka plan sekmesi yavaşlıyor ve telefonda video üretimi daha uzun sürüyor. Video süreleri Faz 4'te ölçülecek.
- **AAC ses kodlamanın** tarayıcı desteği Faz 4'te doğrulanacak. Desteklenmezse Reels müziksiz indirilir ve müzik Instagram'da eklenir.
- **Gemini anahtar formatı:** Eylül 2026'dan itibaren yalnızca "auth key" kabul ediliyor. AI SDK uyumu Faz 1'de doğrulanacak.
- **Şablon değişiklikleri:** Birebir yeniden üretimin bozulmaması için kullanılmış şablon sürümleri dondurulur ve görsel regresyon testiyle korunur.
- **İçerik eğlence amaçlıdır.** Prompt; sağlık ve finans talimatını ve aşağılayıcı cinsiyet kalıplarını engeller.
- **Müzik telifi** senin sorumluluğundadır, yalnızca telifsiz parça kullanılmalı.

## 13. Kapsam dışı

- Instagram'a otomatik paylaşım (Graph API)
- Çoklu kullanıcı
- Herkese açık site
- Analitik
- Yapay zekâ ile görsel üretimi
- Ödeme

## Onaydan sonra (Superpowers akışı)

1. `~/burc-studio` oluşturulur, `gh repo create burc-studio --private` çalıştırılır. Bu spec `docs/superpowers/specs/2026-09-25-burc-studio-design.md` olarak commit'lenir.
2. `superpowers:writing-plans` ile Faz 0 ve 1 için TDD adımlı ayrıntılı plan yazılır. Sen planı inceler ve yürütme yöntemini seçersin (subagent-driven ya da inline).
3. Fazlar sırayla uygulanır. Her faz sonunda doğrulanıp sana gösterilir.
