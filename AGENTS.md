<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Kullanıcı tercihleri

- Serkan'ın bilgisayarına yerel ses/AI modelleri indirmeyin veya çalıştırmayın. Ses üretimi Gemini TTS ile, konuşma zamanlaması analizi ve animasyon/render otomasyonu yalnız GitHub Actions üzerinde yapılır. Ağır video üretimini bu bilgisayara taşımayın.
- Sosyal medya kullanıcı adını, görünen adını veya profil bilgilerini değiştirmeyin.

## 9 Ekim 2026 otomasyon kuralları (kullanıcı talimatı)

- Mevcut grafik, görsel, animasyon, yazı stili, video içeriği, metin, ses kimliği ve dil korunur. Her videonun mevcut giriş, 12 yorum ve kapanış metni tek Gemini TTS isteğinde seslendirilir; sahne başına TTS veya ek Gemini analiz isteği yapılmaz.
- Hiçbir yorum cümlesi TTS metninden kısaltılmaz. Her nihai seslendirme 178,5 saniyeyi, her tek MP4 178,9 saniyeyi aşamaz. Uzun sesin tamamı kelime kesmeden ve ses perdesini koruyan ffmpeg atempo ile en fazla 178,5 saniyeye uyarlanır. MP4 yüklenmeden önce gerçek kapsayıcı süresi ffprobe ile ölçülür. Render, hazır paket ve paylaşım aşamalarında 178,9 saniyeyi aşan, süresi bilinmeyen veya çok parçalı video reddedilir.
- TTS aynı model/ses ayarlarıyla GOOGLE_TTS_API_KEY → GOOGLE_GENERATIVE_AI_API_KEY → GOOGLE_TTS_API_KEY_3 sırasını kullanır; kota/anahtar hatasında sıradakine geçer, günlük kota sıfırlanınca anahtarı yeniden dener. Anahtar değerleri yalnız GitHub Secrets içinde kalır.
- Tam ses, tempo uyarlaması ve gerçek konuşma-sahne zamanlaması önbelleğe alınır. Konuşma analizi modeli yalnız GitHub Actions üzerine kurulur ve orada çalışır; kullanıcı bilgisayarına indirilmez.
- Vercel Blob listesinde bulunmayan eski MP4 yeniden çizilir; bir video yenilenirken günün mevcut onayları kaldırılır ve tam paket doğrulanana kadar kuyruk paylaşımı bekler.
- Yalnız Reels/video paylaşılır; carousel/kart paylaşılmaz.
- Vercel günlük içeriği 10:00 TSİ'de oluşturur. GitHub Actions ilk renderı 10:01 TSİ'de başlatır; kurtarma saatleri 11:10, 11:40 ve 13:10'dur. Preflight Gemini günlük kotası yenilenmeden önceki işi ve aynı Türkiye gününde başarıyla tamamlanmış yedekleri atlar. Pasifik yaz saati nedeniyle kota 1 Kasım'a kadar 10:00, 2 Kasım'dan itibaren 11:00 TSİ'de yenilenir. Render bitip günün tüm videoları doğrulanmadan paylaşım başlamaz; mevcut yayın sırası ve aralıkları korunur. 9 Ekim üretimi eski ses/video önbelleğini kullanmadan sıfırdan başlar; yeni önbellek yalnız aynı günün başarısız işini kurtarmak için kullanılabilir.
- Yalnız 2026-10-08 günü yeniden hazırlanan bütün videolar tamamlandıktan sonra Telegram bildirimi gönderilir ve kullanıcının Telegram /hemen komutu beklenir. Önceki onay ve kuyruklar yeniden hazırlanmış videolar için yetki sayılmaz.
- 2026-10-09 ve sonraki günlerde tam ve süreleri doğrulanmış paket planlanan saatlere otomatik alınır. Eksik veya hatalı paket otomatik yayınlanmaz, Telegram'a hata bildirilir.
- Normal günlerde dört, pazartesi günleri altı video hazırlanır; aynı günlük içerik ve yayın planı korunur.
- Render GitHub Actions üzerinde kalır. API anahtarları, şifreler ve ortam dosyaları kaynak koduna, raporlara veya ekran görüntülerine yazılmaz.
