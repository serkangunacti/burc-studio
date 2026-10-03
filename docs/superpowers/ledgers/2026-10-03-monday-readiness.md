# Pazartesi hazırlık kaydı

Kullanıcı 3 Ekim'de hazırlık raporundaki tüm önerilerin uygulanmasını ve üç görsel/video seçeneği hazırlanmasını onayladı. Bağlayıcı kapsam: `/Users/serkan/burc-studio-pazartesi-hazirlik-2026-10-03.md`.

Dal: `feat/monday-readiness-20261003`; temel: `f8090b9`.

## Sınırlar

- 5 Ekim 00:00 TSİ başlangıç kapısı ve yayın saatleri korunur.
- Günlük dört, pazartesi altı benzersiz video; aynı MP4 iki platformda kullanılır.
- Mevcut indirilen tasarımlar değiştirilmez; yeni görsel yön kullanıcı seçiminden sonra yeni sürümle bağlanır.
- Günlük TTS veya ek içerik üretim çağrısı eklenmez; Serkan'ın onaylı sesi tek sefer hazırlanır ve önbellekten kullanılır.
- Ses referansı / skill dosyaları GitHub veya Canva'ya aktarılmaz.
- Kullanıcının ana çalışma kopyasındaki `cutoff.tmp.mjs` korunur.

## İşler

1. Buffer kota yanıtlarını saklama, `Retry-After`, seyrekleşen durum sorguları ve belirsiz oluşturma sonucu için kopya engeli — uygulandı.
2. Platforma, tarihe, içerik türüne ve hedef kitleye uygun açıklamalar / etiketler — uygulandı; günlük LLM çağrı sayısı aynı.
3. Önbellekteki kişisel ses ve AI bildirim alanları — uygulandı; üretilmiş iki kısa klip GitHub secret'ına bağlandı.
4. Canlı sağlık kontrolü, GitHub doğrudan tetikleme — kod hazır; canlı GitHub bağlantısı kaydedildi; yeni sağlık raporu deploy sonrası doğrulanacak.
5. Üç görsel yön ve üç animasyon örneği; Canva içe aktarma — tamamlandı. Kullanıcı Pastel Kozmik'i seçti; yeni `@2` sürümleri bağlandı.
6. Profil metinleri ve ilk hafta ölçüm düzeni — Instagram görünen adı / biyografisi kaydedildi; TikTok güncellemesi devam ediyor. Oturum gerektiren CSV ve rehber hazır.
7. Bütün dal incelemesi, testler, merge, deploy, canlı doğrulama — devam ediyor.

## Kararlar ve kanıtlar

- Başlangıçta 459 test ve TypeScript kontrolü ana dalda geçti; çalışma kopyası aynı temel commit'ten oluşturuldu.
- Ruling: Çalışma kopyası proje dışında `/Users/serkan/burc-studio-hazirlik-20261003` oluşturuldu; ana dalın `.gitignore` dosyasını değiştirmeden kullanıcı değişikliğini korumak için.
- Canva `create_design` işi `feature_disabled` ile bitti: hesabın yöneticisi üretimi kapatmış. Aynı üretim çağrısı tekrarlanmadı. Dokuz yerel örnek içeren HTML başarıyla içe aktarıldı; Canva tasarımı `DAHW-z9bWsw`, dokuz sayfa, 1080×1350. İçerik görsellerden içe aktarılmış referans panosudur; düzenlenebilir katmanlar olarak sunulmadı.
- İlk bilgisayar erişimi kapalıydı; kullanıcı açmayı onayladı ve Chrome erişimi 3 Ekim'de doğrulandı.
- GitHub için yerel CLI'nin geniş yetkili anahtarı üretim veritabanına kopyalanmadı. Kullanıcının açık son onayıyla yalnız bu depoya Actions RW + zorunlu Metadata read erişimli anahtar oluşturuldu; 1 Ocak 2027'de sona eriyor. Canlı uygulama bağlantıyı doğruladı. Anahtar dosyaya / günlüğe yazılmadı.
- Serkanses: onaylı kişisel referansla ücretsiz Chatterbox V3 üzerinde yalnız iki kısa konuşma bir kez üretildi (3,72 sn giriş, 3,12 sn kapanış). `SERKANSES_VOICE_ASSET` secret'ı yalnız bu üretilmiş klipleri içerir; özel referans bilgisayarda kalır.
- Pastel Kozmik tam video gerçek üretim renderer'ıyla 1080×1920 H.264/AAC, 59,05 sn olarak çizildi. FFmpeg tam çözümleme başarılı. 420 / 850 grafem uzunluk örnekleri ve video karesi görsel olarak incelendi; metinler sığıyor. Doğal örnek metinli galeri ayrıca hazırlandı.
- Yeni kota / belirsiz sonuç testlerinde 429 ile GraphQL HTTP 200 ve 502 ayrımı doğrulandı. İlk tüm test çalıştırmasında sağlık düğmesini içermeyen eski UI mock'u yakalandı ve güncellendi. Son tüm test çalıştırması: 88 dosyada 491 test geçti.
- Yerel Turbopack, çalışma kopyasının dışına giden `node_modules` sembolik bağlantısını reddetti. Çalışma kopyasında webpack üretim derlemesi kullanılacak; Vercel'in gerçek bağımlılık kurulumuyla Turbopack derlemesi ayrıca deploy'da doğrulanacak. Proje yapılandırması değiştirilmedi.
- Webpack derlemesi mevcut Queue SDK'nin geniş `Request | {request: Request}` parametre tipini Next.js route sınırında reddetti. Runtime akışı değiştirilmeden `POST` ihracının tipi `Request → Promise<Response>` olarak daraltıldı; üretim derlemesi yeniden doğrulanacak.
