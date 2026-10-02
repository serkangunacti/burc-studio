@AGENTS.md

# kozmikarkan (burc-studio): proje notları

Tek kullanıcılı, özel bir astroloji içerik stüdyosu. Instagram hesabı @kozmikarkan için içeriği otomatik üretir, tasarlar, arşivler ve kullanıcının Telegram onayıyla planlı saatlerde Instagram'a paylaşır (Faz 6). Hiçbir akış manuel adım gerektirmemeli.

## Bağlantılar
- **Canlı site:** https://burc-studio.vercel.app (Vercel projesi `serkangunactis-projects/burc-studio`). `main`'e push otomatik yayına alır.
- **Tasarım onay sayfası (tüm onaylı tasarımlar, örnek videolar):** https://claude.ai/artifact/7AwwB1EkVtnChKCXrKs3RQ. Güncellemeden önce Artifact aracıyla `read`, sonra aynı `url` ile yayınla.
- **Spec (bağlayıcı, sondaki "Durum" bölümü güncel özet):** `docs/superpowers/specs/2026-09-25-burc-studio-design.md`.
- **Instagram profil logoları (1080×1080 PNG + SVG; pastel, krem, koyu):** `docs/brand/`.
- **Faz planları:** `docs/superpowers/plans/`. Her fazda verilen kararlar (`Ruling:`) ve ertelenen küçük işler: `docs/superpowers/ledgers/`.

## Ne üretiliyor
- **Her gün ~05:00 TSİ cron (`/api/cron/daily`):** Kadın ve erkek günlük burç (`pastel@1`) ile kadın ve erkek günlük tarot (`pastel-tarot@1`).
- **Pazartesi ek olarak:** Kadın ve erkek haftalık yorumlar (`pastel-weekly@1`), 4 burçluk 3 parça hâlinde üretilir.
- **Günlük plan:** Canlıdaki `settings.data.dailyPlan` alanında (4 kalem). Ayarlar sayfasından değişir.
- **Her gönderi için:** 14 slaytlık JPEG carousel (tarayıcıda `renderStillOnWeb`), ZIP, caption ve 59 sn müzikli Reels (tarayıcıda `renderMediaOnWeb`, AAC).
- **Reels müziği:** Kodla üretilir (`src/lib/music`). Kullanıcı sesleri onayladı; karakterini değiştirme.

## Otomatik paylaşım (Faz 6, spec §14)
- **Akış:**
  1. Cron `/api/cron/daily` 05:00 TSİ'de içeriği üretir.
  2. Günlük cron üretimi bitirince GitHub Actions `render-publications.yml` işini `workflow_dispatch` ile başlatır. Anahtar Ayarlar'daki GitHub kartından girilir (ince ayarlı, yalnız bu depo, Actions RW). Yedek zamanlamalar 06:07, 06:37 ve 07:07 TSİ; aynı gün ikinci kez çizmez, ikinci mesaj göndermez (`scripts/render-publications.ts`, `scripts/automation/`):
     - Carousel'i 3 parçaya böler (kapak + 4 burç + kapanış).
     - JPEG'leri Neon `media_files` tablosuna, Reels MP4'ü Blob'a (`kozmikarkan-medya`) yazar.
     - `/api/automation/ready` ucunu çağırır.
  3. Telegram onay mesajı gider (`/api/telegram/webhook`). Her plan gönderilmeden webhook güncel `AUTOMATION_SECRET` ile eşitlenir; bekleyen Telegram güncellemeleri silinmez.
  4. Onaylananlar Vercel Queues'a (`instagram-publish`) gecikmeli bırakılır.
  5. Tüketici `/api/queues/publish` Instagram Graph API v25 ile paylaşır.
  6. TikTok'a yalnızca Reels videosu gider: Buffer GraphQL API (`src/lib/buffer/`) ile `shareNow`, durum `sent` olana kadar izlenir.
     - Buffer API anahtarı Ayarlar'dan girilir.
     - `automation.tiktok.enabled` ile açılıp kapanır.
- **Bakım:** `/api/cron/maintenance` 00:30 TSİ'de çalışır. Onaysızları düşürür, 3 günlük medyayı siler, Instagram anahtarını yeniler.
- **Kod:** `src/lib/automation/` (plan, carousel, repository, service, day-message, http, runtime), `src/lib/instagram/`, `src/lib/telegram/`, `src/lib/buffer/`.
- **Arayüz:** Ayarlar → "Otomatik paylaşım" (bağlantılar ve saatler), `/paylasimlar` sayfası.
- **Sırlar:**
  - Vercel: `AUTOMATION_SECRET`, `INTEGRATIONS_KEY` (Secret), `BLOB_READ_WRITE_TOKEN`.
  - GitHub secrets: `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `AUTOMATION_SECRET`.
  - Bot ve Instagram anahtarları DB'de şifreli (`integrations`).
- **Elle yeniden çizim:** `gh workflow run render-publications.yml -f date=YYYY-AA-GG [-f force=true]`.

## Mimari (önemli dosyalar)
- **Üretim:**
  - `src/lib/content/generation-spec.ts`: `HOROSCOPE_SPEC`, `TAROT_SPEC`, `WEEKLY_SPEC`; prompt, sınırlar, şablon, parça boyutu.
  - `src/lib/content/horoscope-service.ts`: üretim, tek burç yenileme, kart yeniden çekme.
  - `src/lib/content/quality.ts`: kalite kapısı, cümle sınırında kısaltma, yasaklı ifadeler.
- **LLM zinciri (hepsi ücretsiz ve uzak):** `src/lib/llm/providers.ts`. Sıra: Gemini → Gemini Lite → Groq → Mistral → Cohere → OrcaRouter → OpenRouter (2 model) → NVIDIA. Anahtarlar yalnızca Vercel env'de (Secret).
- **Görsel:**
  - Şablonlar: `src/remotion/templates/` (`pastel-v1`, `pastel-v1-reels`, `pastel-weekly-v1`, `pastel-tarot-v1`) ve `index.ts` kaydı.
  - Tarot tasarım sistemi: `src/remotion/tarot/` (78 kart).
  - Studio: `npm run studio`.
- **Veritabanı:** Neon Postgres + Drizzle. Migration: `npm run db:migrate:prod` (`.env.production.local` ile).

## Çalışma kuralları (bu projede öğrenilenler)
- **Yerel dil modeli (Ollama vb.) ASLA kullanılmaz.** Gerçek içerik gerekiyorsa uzak ücretsiz API'ler; olmuyorsa sahte model (`LLM_MOCK=1`).
- **Kullanıcı teknik adım yapmaz.** Merge, deploy, env, migration ve ayar güncellemesi Claude'un işi. Yalnız geri alınamaz ya da yıkıcı işlemlerde sor.
- **Testler:**
  - `npm test -- --maxWorkers=2` (makine yüklüyken PGlite zaman aşımı olmasın).
  - `npm run test:e2e` (Playwright, localhost:3100, sahte model).
  - `npx eslint src e2e scripts`: arka plandaki ajan çalışma kopyaları (`.claude/worktrees`) lint'e girmesin.
- **Prettier çalıştırma** (projede ayarı yok; dosyaları baştan biçimlendirir).
- **Arşiv tekrarlanabilirliği:**
  - Şablonlar altın testlerle (`render-chain.test.ts`, `deck-golden.test.ts`) ve dondurma manifestleriyle (`freeze.test.ts`) korunur.
  - Görünüm değişecekse önce canlıda o şablonla **indirilmiş** gönderi var mı bak.
  - Yoksa yerinde değiştir, hash'leri güncelle ve ledger'a yaz. Varsa yeni sürüm aç (`pastel@2` gibi).
- **Tarayıcı render kısıtları:**
  - Yalnız inline stil. `z-index`, `filter`, `backdrop-filter`, `mix-blend-mode` ve `text-transform` kullanılmaz.
  - SVG konumlu bir div içinde durur; konumlar `Math.round` ile tam piksel.
  - Dönüş ve ölçek div'lere uygulanır.
- **İş akışı:** Superpowers (plan → TDD → bütün dal incelemesi → düzeltme → merge → deploy → canlı doğrulama). Her iş ayrı dalda; `main`'e `--no-ff` ile birleşir.

## Açık, isteğe bağlı işler (spec "Durum" bölümü)
- **Özel gündem (§1.6):** Gökyüzü takvimi ve özel günler için cinsiyetsiz gönderiler.
- **Slayt MP4'leri:** Her slaytın animasyonlu MP4 hâli.
- **Ertelenen küçük işler:** Ledger'lardaki `minor (deferred)` satırları.
