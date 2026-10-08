<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Kullanıcı tercihleri

- Serkan'ın bilgisayarına yerel ses/AI modelleri indirmeyin veya çalıştırmayın. Ses üretimi Gemini TTS ile, konuşma zamanlaması analizi ve animasyon/render otomasyonu yalnız GitHub Actions üzerinde yapılır. Ağır video üretimini bu bilgisayara taşımayın.
- Sosyal medya kullanıcı adını, görünen adını veya profil bilgilerini değiştirmeyin.

## 8 Ekim 2026 otomasyon kuralları (kullanıcı talimatı)

- Mevcut grafik, görsel, animasyon, yazı stili, video içeriği, metin, ses kimliği ve dil korunur. Her videonun mevcut giriş, 12 yorum ve kapanış metni tek Gemini TTS isteğinde seslendirilir; sahne başına TTS veya ek Gemini analiz isteği yapılmaz.
- Her nihai seslendirme ve her MP4 ayrı ayrı kesinlikle 179 saniyeden kısa olur. Uzun sesin tamamı kelime kesmeden ve ses perdesini koruyan ffmpeg atempo ile en fazla 178,5 saniyeye uyarlanır. MP4 en fazla 178,9 saniye hedefler; yüklemeden önce gerçek kapsayıcı süresi ffprobe ile ölçülür. Render, hazır paket ve paylaşım aşamalarında 179,00 saniye dahil uzun, süresi bilinmeyen veya çok parçalı video reddedilir.
- TTS aynı model/ses ayarlarıyla GOOGLE_TTS_API_KEY → GOOGLE_GENERATIVE_AI_API_KEY → GOOGLE_TTS_API_KEY_3 sırasını kullanır; kota/anahtar hatasında sıradakine geçer, günlük kota sıfırlanınca anahtarı yeniden dener. Anahtar değerleri yalnız GitHub Secrets içinde kalır.
- Tam ses, tempo uyarlaması ve gerçek konuşma-sahne zamanlaması önbelleğe alınır. Konuşma analizi modeli yalnız GitHub Actions üzerine kurulur ve orada çalışır; kullanıcı bilgisayarına indirilmez.
- Yalnız Reels/video paylaşılır; carousel/kart paylaşılmaz.
- Günlük hazırlık Türkiye saatiyle 04:00 için zamanlanır, bütün videolar 08:30 paylaşım başlangıcına hazır olacak şekilde çalışır. Mevcut sabah yayın sırası korunur; haftalık yayınlar da 08:30 öncesine alınmaz.
- Yalnız 2026-10-08 günü yeniden hazırlanan bütün videolar tamamlandıktan sonra Telegram bildirimi gönderilir ve kullanıcının Telegram /hemen komutu beklenir. Önceki onay ve kuyruklar yeniden hazırlanmış videolar için yetki sayılmaz.
- 2026-10-09 ve sonraki günlerde tam ve süreleri doğrulanmış paket planlanan saatlere otomatik alınır. Eksik veya hatalı paket otomatik yayınlanmaz, Telegram'a hata bildirilir.
- Render GitHub Actions üzerinde kalır. API anahtarları, şifreler ve ortam dosyaları kaynak koduna, raporlara veya ekran görüntülerine yazılmaz.
