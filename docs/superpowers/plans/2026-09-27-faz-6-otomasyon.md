# Faz 6: Instagram Otomasyonu (Telegram onaylı) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Her gün üretilen günlük burç ve tarot içeriklerini (kadın/erkek ayrı) ve pazartesi ek olarak haftalık yorumları insansız olarak paylaşıma hazırlamak:
- JPEG'ler ve müzikli Reels sunucuda üretilir.
- Kullanıcıya Telegram'dan onay sorulur.
- Onaylananlar planlanan saatte açıklama ve hashtag'lerle Instagram'a paylaşılır.

**Architecture:**
- **Üretim (mevcut):** Cron 06:00 TSİ'de metinleri üretir.
- **Paylaşım planı:** Cron, üretimden hemen sonra o günün paylaşım planını `publications` tablosuna yazar.
- **Render işçisi:** GitHub Actions saat 07:15 TSİ'de çalışır. Mevcut Remotion şablonlarıyla sunucu tarafında (`@remotion/renderer`) carousel parçalarını ve Reels'i üretir, Vercel Blob'a yükler.
- **Onay:** Render bitince Telegram'a günlük paket mesajı gider. Kullanıcı "Hepsini onayla"ya ya da tek tek "Paylaşma"ya basar.
- **Paylaşım:** Onaylanan her paylaşım Vercel Queues'a planlanan saate göre gecikmeli olarak bırakılır. Tüketici, Instagram Graph API ile container → (Reels için durum yoklaması) → publish akışını çalıştırır ve sonucu Telegram'a bildirir.

**Tech Stack:**
- Mevcut: Next.js 16, Drizzle, Neon, Remotion 4.0.529.
- Yeni: `@remotion/renderer` ve `@remotion/bundler` (aynı sürüm), `@vercel/blob`, `@vercel/queue`, Instagram API with Instagram Login (graph.instagram.com), Telegram Bot API. Yeni ücretli servis yok.

**Spec:** `docs/superpowers/specs/2026-09-25-burc-studio-design.md`. §13'teki "Instagram'a otomatik paylaşım: kapsam dışı" kararı bu fazla kaldırılır; spec'e "§14 Otomasyon" eklenir (Task 1).

## Kullanıcı kararları (27.09.2026)

- **Carousel'ler üçe bölünür.** Instagram API'si carousel'de en fazla 10 görsele izin veriyor. Her parça: kapak ("1/3 · Koç → Yengeç") + 4 burç + kapanış = 6 görsel.
- **Reels:** Günlük burç ve tarot Reels'leri de paylaşılır. Pazartesi haftalık carousel ve Reels eklenir.
- **Onay:** Sabah tek bir Telegram paket mesajı; "Hepsini onayla" ve her paylaşım için "Paylaşma".
- **Saatler (TSİ, Ayarlar'dan değiştirilebilir):**

  | Saat | Paylaşım |
  |---|---|
  | 08:30 | Kadın burç carousel |
  | 09:30 | Erkek burç carousel |
  | 12:30 | Kadın tarot carousel |
  | 13:30 | Erkek tarot carousel |
  | 19:00 | Kadın burç Reels |
  | 20:00 | Erkek burç Reels |
  | 21:00 | Kadın tarot Reels |
  | 22:00 | Erkek tarot Reels |
  | 10:30 (pazartesi) | Kadın haftalık carousel |
  | 11:30 (pazartesi) | Erkek haftalık carousel |
  | 17:00 (pazartesi) | Kadın haftalık Reels |
  | 18:00 (pazartesi) | Erkek haftalık Reels |

  Bir saatteki 3 carousel parçası 3'er dakika arayla sırayla paylaşılır.
- **Araç seçimi Claude'a bırakıldı.** Composio yerine doğrudan resmî API seçildi. 10 görsel sınırı orada da aynı; ek hesap ve üçüncü taraf bağımlılığı yok.

## Global Constraints

- **Yerel dil modeli yok.** Manuel adım yalnız tek seferlik kurulumlarda: Telegram botu (BotFather), Instagram profesyonel hesap ve Meta uygulaması/erişim anahtarı.
- **Gizli bilgiler:** Anahtarlar yalnız Vercel env (Secret) ya da GitHub Actions secrets'ta tutulur. Instagram erişim anahtarı veritabanında AES-GCM ile şifrelenir (60 günde bir otomatik yenilenir).
- **Instagram sınırları:**
  - 24 saatte 100 API paylaşımı; bizim yükümüz günde 16, pazartesi 24.
  - JPEG, en boy oranı 4:5.
  - Reels: MP4 H.264 + AAC, 59 sn.
  - Medya herkese açık bir adresten çekilir. Blob adresleri tahmin edilemez ve paylaşımdan 3 gün sonra silinir.
- **Telegram:**
  - Webhook `X-Telegram-Bot-Api-Secret-Token` başlığıyla doğrulanır.
  - Yalnız kayıtlı sohbet kimliğinden gelen komutlar kabul edilir.
- **Onaysız paylaşım asla yapılmaz.** Onay planlanan saatten sonra gelirse paylaşım hemen yapılır. Gün bitene kadar (23:59 TSİ) onaylanmayanlar "süresi doldu" olur.
- **Tekrar paylaşmama:** Her paylaşım idempotenttir. Durum makinesi `planned → rendering → ready → approved → publishing → published`, yan dallar `skipped | expired | failed`. Kuyruk mesajı iki kez gelse de iki kez paylaşmaz.
- **Arşiv:** Dondurulmuş şablonların (`pastel@1`, `pastel-v1-reels`) mevcut altın testleri değişmeden geçer. Parça kapakları yeni, varsayılanı boş bir alanla çizilir.

## Review Focus

1. **Çift paylaşım:** Kuyruk mesajı yinelenirse ya da onay iki kez basılırsa Instagram'a ikinci gönderi gitmemeli. → Task 5 tüketici testi (aynı mesaj iki kez).
2. **Reels işleme süresi:** Container `IN_PROGRESS` kalırsa tüketici yeniden denemeli; `ERROR` ya da `EXPIRED` olursa `failed` ve Telegram bildirimi. → Task 5.
3. **Eksik içerik:** Üretimi başarısız olan gönderi için paylaşım planlanmamalı; render işçisi eksik gönderiyi atlayıp diğerlerini hazırlamalı. → Task 2 ve Task 3.
4. **Süresi dolan erişim anahtarı:** Yenileme başarısızsa Telegram'a uyarı gitmeli; paylaşımlar sessizce düşmemeli. → Task 5 anahtar testi.
5. **Başkasının Telegram'dan komut göndermesi:** Kayıtlı sohbet dışındaki mesajlar yok sayılmalı. → Task 4 webhook testi.

---

### Task 1: Spec eki, paylaşım veri modeli ve plan

- **Spec:** §13'ten otomatik paylaşımı çıkar; §14 Otomasyon'u bu planın kararlarıyla ekle.
- **Migration:** `publications` tablosu.
  - Alanlar: `id`, `post_id`, `format` (`carousel` | `reels`), `part` (1–3, Reels'te null), `scheduled_at`, `status`, `media` (jsonb: adresler), `caption`, `ig_container_id`, `ig_media_id`, `permalink`, `error`, `attempts`, `created_at`, `updated_at`.
  - Kısıtlar: benzersiz (`post_id`, `format`, `part`); `(status, scheduled_at)` üzerinde dizin.
- **Ayarlar şeması (`settingsSchema`):** `automation` alanı eklenir: `{ enabled, schedule: Record<'horoscope'|'tarot'|'weekly', {kadin:{carousel,reels}, erkek:{carousel,reels}}>, partGapMinutes: 3 }` ve yukarıdaki varsayılan saatler.
- **Saf planlayıcı:** `planPublications(date, posts, automation)` → paylaşım satırları. Parçaya bölme `splitCarousel(slides)` → 3 × 6 slayt (kapak her parçada, parça etiketiyle).
- **Testler:**
  - Salı: 4 gönderi → 12 carousel + 4 Reels satırı.
  - Pazartesi: 24 satır.
  - Saatler TSİ'den UTC'ye doğru çevrilir.
  - Parça etiketleri "1/3 · Koç → Yengeç".
  - Eksik gönderi için satır yok.

### Task 2: Parça kapağı ve sunucu tarafı bileşimleri

- **Kapak etiketi:** `CoverSlideData`'ya isteğe bağlı `partLabel` eklenir. `pastel@1`, `pastel-tarot@1` ve `pastel-weekly@1` kapakları varsa tarih satırının altında gösterir. Alan verilmezse işaretleme aynıdır: tüm altın testler değişmeden geçmeli.
- **Remotion kökü:** `Post-Slide` (inputProps: `{templateVersion, props}`) ve `Post-Reels` (inputProps: `{templateVersion, reels, musicSrc}`) bileşimleri eklenir. Boyut ve süre `calculateMetadata` ile verilir.
- **Testler:** Parça etiketli kapakta etiket görünür, etiketsiz kapağın hash'i aynıdır. Bileşim metadata'sı biçime göre 1080×1350 / 1080×1440 / 1080×1920 çıkar.

### Task 3: Render işçisi (GitHub Actions)

- **Betik (`scripts/render-publications.ts`):**
  1. DB'den `status='planned'` ve bugünün paylaşımlarını alır.
  2. Gönderi ayrıntısını mevcut `getPostDetail`, `buildSlideProps`, `buildReelsProps` ve `formatCaption` ile kurar.
  3. `@remotion/bundler` ile tek paket oluşturur.
  4. Carousel parçalarını `renderStill` ile JPEG (kalite 92) olarak çizer.
  5. Reels müziğini mevcut `composeAmbient` + `renderScoreToWav` ile Remotion'ın başsız tarayıcısında WAV'a çevirir, `Post-Reels`'i `renderMedia` ile H.264 + AAC (5 Mbps) üretir.
  6. Dosyaları `@vercel/blob` `put` ile herkese açık ve rastgele adresli yükler.
  7. Satırı `ready` yapar; hatada `failed` + hata metni yazar.
  8. Son olarak `/api/automation/ready` uç noktasını gizli anahtarla çağırır; Telegram paketi gider.
- **İş akışı (`.github/workflows/render.yml`):** `schedule: '15 4 * * *'` (07:15 TSİ) ve `workflow_dispatch`. Node 24, `npm ci`, Remotion tarayıcı önbelleği. Secrets: `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `AUTOMATION_SECRET`, `APP_URL`.
- **Doğrulama:**
  - Yerelde tohumlanmış veritabanında betik bir carousel parçası ve bir Reels üretir; JPEG 1080×1350, MP4'te ses izi var.
  - Actions'ta `workflow_dispatch` ile gerçek çalıştırma; süre ölçülür, günlük süre ayda 2.000 dakikanın altında kalmalı.

### Task 4: Telegram botu (onay)

- **`src/lib/telegram/`:** `sendMessage`, `sendMediaGroup`, `sendVideo`, `answerCallbackQuery` ve satır içi klavye yardımcıları (fetch; test için enjekte edilebilir).
- **`POST /api/telegram/webhook`:**
  - Gizli başlık doğrulanır.
  - `/start`: `settings.automation.telegramChatId` boşsa kaydeder; doluysa yalnız o sohbet kabul edilir.
  - Düğmeler: `onayla:<gün>` (hepsi), `atla:<id>`, `ayrinti:<id>`.
- **Paket mesajı (`/api/automation/ready`):**
  - Günün başlığı.
  - Her paylaşım için bir satır: saat, tür, kitle ve parça.
  - Burç ve tarot carousel'lerinden kapak + 1 slaytlık küçük önizleme albümü; ilk Reels videosu.
  - Düğmeler "✅ Hepsini onayla" ve her satır için "🚫".
  - Tam açıklamalar "Ayrıntı" ile.
- **Onay:** `approved` yapılır ve her paylaşım Vercel Queues'a `delaySeconds = max(0, scheduled_at − now)` ile bırakılır. Yanıt mesajında "✓ 16 paylaşım planlandı".
- **Testler:** Yanlış gizli başlık 401. Yabancı sohbet yok sayılır. "Hepsini onayla" yalnız `ready` durumdakileri onaylar ve kuyruğa doğru gecikmeyle bırakır (kuyruk istemcisi sahte). Atla → `skipped`, kuyruğa girmez.

### Task 5: Instagram yayıncısı, kuyruk tüketicisi, anahtar yenileme

- **`src/lib/instagram/client.ts`:**
  - `createImageContainer`, `createCarousel`, `createReelsContainer`, `containerStatus`, `publish`, `permalink`, `publishingLimit`, `refreshToken`.
  - Tabanı `graph.instagram.com`. Hatalar kodlarıyla sınıflanır: yeniden denenebilir / kalıcı.
- **`src/lib/instagram/token.ts`:** Erişim anahtarı `instagram_tokens` satırında (tek satır) AES-GCM (`INSTAGRAM_TOKEN_KEY`) ile şifreli; son kullanım tarihi tutulur.
- **Kuyruk tüketicisi (`/api/queues/publish`):**
  - Paylaşım `approved` değilse çıkar (idempotent).
  - Carousel: 6 görsel container → carousel container → publish.
  - Reels: container → `IN_PROGRESS` ise 30 sn sonra yeniden teslim için hata fırlatır (en fazla 20 deneme) → `FINISHED` ise publish.
  - Başarı: `published`, bağlantı ve Telegram "✅ Paylaşıldı: <bağlantı>".
  - Kalıcı hata: `failed` ve Telegram uyarısı.
- **Günlük bakım cron'u (`/api/cron/maintenance`, Vercel cron, günde bir):**
  - Anahtarın süresine 20 günden az kaldıysa yeniler; hata olursa Telegram'a uyarır.
  - 23:59'u geçen onaysızları `expired` yapar.
  - 3 günlük Blob dosyalarını siler.
- **Testler (fetch sahte):**
  - Carousel akışı doğru sırada 8 çağrı yapar.
  - Reels `IN_PROGRESS`'te yeniden denemeyi ister.
  - Aynı mesaj iki kez gelince ikinci kez paylaşmaz.
  - Anahtar şifrele/çöz gidiş-dönüşü çalışır.
  - Yenileme hatası uyarı üretir.

### Task 6: Arayüz ve günlük cron bağlantısı

- **Günlük cron:** Üretimden sonra `planPublications` ile satırları yazar (`automation.enabled` ise).
- **"Paylaşımlar" sayfası:** Bugünün ve yarının paylaşımları; saat, durum, Instagram bağlantısı; elle "Şimdi paylaş" / "Paylaşma"; render'ı yeniden tetikleme (`workflow_dispatch`, ince ayarlı GitHub anahtarı ile, isteğe bağlı).
- **Ayarlar → Otomasyon:** Açık/kapalı, saat tablosu, Telegram bağlantı durumu, Instagram bağlantı durumu ve anahtar son kullanım tarihi.
- **E2E:** Paylaşımlar sayfası planlanan 16 satırı gösterir. Ayarlar'da saat değişikliği kaydedilir.

### Task 7: Kurulum, uçtan uca canlı deneme ve devreye alma

1. **Claude:**
   - Vercel Blob mağazası ve Queues.
   - Env ve GitHub secrets.
   - Telegram webhook kaydı (`setWebhook` + gizli anahtar).
   - Migration.
2. **Kullanıcı, tek seferlik:**
   - BotFather'dan bot anahtarı; bota `/start`.
   - Instagram'ı profesyonel hesaba çevirme.
   - Meta uygulamasında Instagram girişi ve erişim anahtarı. Claude, kullanıcının tarayıcısında adım adım yardım eder.
3. **Kuru deneme:** Tek bir paylaşım için Telegram onayı → Instagram'da gerçek paylaşım. Kullanıcının onayıyla; istenirse sonra silinebilir.
4. **Devreye alma:** Ertesi gün tam akış; sabah paket mesajı, akşama kadar 16 paylaşım.
5. **Son adımlar:** Bütün dal incelemesi → düzeltmeler → merge → deploy.

## Verification (uçtan uca)

- **Birim ve E2E:** `npm test -- --maxWorkers=2`, `npm run test:e2e`, `npx eslint src e2e scripts`.
- **Render işçisi:** Actions'ta `workflow_dispatch`; üretilen JPEG ve MP4'ler Blob'da, satırlar `ready`.
- **Telegram:** Paket mesajı gelir. "Hepsini onayla" → Queues'ta 16 gecikmeli mesaj.
- **Instagram:** Kuru denemede tek paylaşım görünür. `content_publishing_limit` kontrolü yapılır.
- **Ertesi gün:** Tüm paylaşımlar planlanan saatlerde `published`; Telegram'da her biri için "✅ Paylaşıldı".
