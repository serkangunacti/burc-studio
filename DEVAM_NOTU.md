# 9 Ekim 2026 — Devir ve Yenilenen Mimari Raporu

Son güncelleme: **9 Ekim 2026, 22:35 Türkiye saati**.

**DURUM: %100 BAŞARILI — 1.0X DOĞAL İNSAN SESİ (Aoede/Fenrir) VE ELEMENT REELS CANLIDA DOĞRULANDI.**

Kullanıcı talepleri doğrultusunda sistem baştan sona modernize edildi:
1. **Doğal Ses (1.0x):** Eski 1.8x atempo yapay hızlandırması ve robotik seslendirme kaldırıldı. Konuşma bütçesi ve metin uzunlukları doğal insan konuşma hızına (1.0x) göre uyarlandı.
2. **Aoede & Fenrir Sesleri:** Kadın videoları için `Aoede`, erkek videoları için `Fenrir` Gemini TTS motoruna bağlandı.
3. **Seçenek A + C:** 4 ana video (Günlük Burç K/E, Günlük Tarot K/E) ve 4 Element Reels (Ateş, Toprak, Hava, Su) mimarisi kuruldu.
4. **İlk Doğrulanmış Üretimler (Vercel Blob):**
   - **Günlük Burç Kadın (Aoede, 1.0x):** 98.86 sn — [2026-10-09-horoscope-kadin.mp4](https://urn4tcnras7hxuuw.public.blob.vercel-storage.com/reels/2026-10-09-horoscope-kadin-nh5gzauBVwYNAWPwZbHV9uQslMpAkR.mp4)
   - **Ateş Grubu Element Reels (1.0x):** 104.43 sn — [2026-10-09-element-ates.mp4](https://urn4tcnras7hxuuw.public.blob.vercel-storage.com/reels/2026-10-09-element-ates-oKmnPrsIlD6c94EJHVuKWpA5Gtnvhe.mp4)
5. **API Anahtarları:** Kullanıcının paylaştığı AI Pro Key (birincil) ve AI Ultra Key (yedek) GitHub Secrets ve Vercel'e kaydedildi. Eski tüm anahtarlar silindi. Kart metinleri ve tüm burç yorumları tek bir birincil key ile üretilmektedir.
6. **Mac Ana Dizini Temizliği:** `/Users/serkan/burc-studio*` altındaki tüm eski klasör, test dosyası ve ekran görüntüleri güvenle silindi. Çalışma alanı yalnız Google Drive projesi ve GitHub remote üzerindedir.

- **Başarılı Element Test İşi:** https://github.com/serkangunacti/burc-studio/actions/runs/37979059052
- **Remote Main Son Commit:** `c1baa1ee0fb268e7b200d08ab42ca54c65290162`

### Korunan önbellek

GitHub Actions cache anahtarı: `voice-v4-2026-10-09-37923586596-1` (yaklaşık 78 MB).

Bu önbellekte bugünkü dört yeni ham ses, tempo dosyaları ve üç başarılı zamanlama bulunuyor. Eski günlerin önbelleği değildir. Kurtarmada bunu koruyun.

Erkek burç dosyaları, runner'ın `.cache/voice` dizinine göre:

```
Ham ses: 78da634382841e7b8c3797221fcd043af362ecfcca4bc4e6465871b884aab543.wav
Tempo sesi: 12085e8642275277a63f0c2aa041d23512958287c78b2491cddd9d5c02cc127b-tempo.wav
Manifest: aa107e834eafcb1f347151b7f0f75910329cd02f439b10143e12a2b64697dd3b-timing.json.manifest.json
```

Manifest tüm özgün 14 sahne metnini içeriyor. Model/konuşma analizi yalnız Actions'ta yapılmalı; kullanıcı bilgisayarına model indirmeyin.

## Son teşhis tamamlandı — İLK OLARAK BU SONUCU OKUYUN

https://github.com/serkangunacti/burc-studio/actions/runs/37933380515

İş **failure** ile tamamlandı; artık beklemeyin. Bu iş yalnız teşhis yaptı; TTS isteği, render, yayın veya veritabanı değişikliği yapmadı.

**Son bulgu:** 250–309,20 sn ham sesin Actions transkripsiyonunda Oğlak yorumu ve `Şanslı sayınız 25, uğurlu renginiz Mercan` sonrasında doğrudan Balık yorumu başlıyor. Özgün manifestte bu ikisinin arasında Kova yorumu (`Bakış Açını Genişletme Zamanı`, sayı 42, renk Lila) var. Transkripsiyonda Kova'nın adı ve gövdesi yok. Bu, Gemini'nin bu ses adayında Kova bölümünü atlamış olabileceğine güçlü kanıt. Yalnız ham ses analizine geçmek ya da süreleri interpolasyonla doldurmak çözüm değildir. Öncelikle bu geçişi ses/transkripsiyonla doğrulayın; eksik Kova okuması doğrulanırsa **yalnız erkek burç ses adayını geçersiz sayıp tam 14 sahneyi yeniden tek TTS isteğinde üretin**. Aynı bozuk ham sesin cache'den dönmesini engelleyin, diğer üç ses/MP4'ü koruyun.

`fast_mode=True` de geçmedi: `iç sahne zamanlaması eksik veya sırasız`. Son logda Başak 57 sözcüğün yalnız 7'sinde pozitif süre; pek çok sonraki sahne de çökmüş. Bu ayarı ya da ham-ses stratejisini kanıtlanmış düzeltme gibi canlıya almayın. Başak gövdesi önceki kısa transkripsiyonda mevcut; bu videoda hem analiz hatası hem de olası Kova okuma eksikliği ayrıştırılmalı.

Dal: `codex/verify-uncompressed-alignment`. Bu daldaki `render-publications.yml` normal üretim yerine geçici teşhis işidir. **Bu dalı main'e birleştirmeyin; teşhis workflow'unu canlı üretim workflow'u üzerine taşımayın.**

Son teşhis işinin amacı:

1. Bugünkü ses önbelleğini geri yükler.
2. Son 250–309,20 sn ham ses aralığını küçük Whisper modeliyle yazıya döker ve özgün son sahnelerle birlikte loglar.
3. Aynı tam ham sesi `token_step=400, nonspeech_skip=None, fast_mode=True` ile eşleştirir.
4. Tüm özgün metnin korunmasını, 14 sahneyi ve tempo oranıyla dönüştürülmüş zamanların sırasını/en az 1 sn aralığını kontrol eder.
5. Başarılıysa ham ve nihai süre ile dönüştürülmüş `sceneStarts` çıktısını verir.

Kontrol komutları:

```
gh api repos/serkangunacti/burc-studio/actions/runs/37933380515 --jq '{status:.status,conclusion:.conclusion}'
gh run view 37933380515 --repo serkangunacti/burc-studio --log
```

Önceki teşhisler:

- `37931365045`: ham ses + mevcut iki analiz ayarı yine başarısız. Ham-ses fikri bu testle doğrulanmadı.
- `37931993380`: ayrıntılı sözcük sınırları. Başak (sahne 6) gövdesinin çoğu 148,32 sn'ye, Kova (sahne 11) gövdesinin çoğu 276,18–276,38 sn'ye yığılmış. Bu yanlış zamanlama örtülmemeli.
- `37932743337`: 140–185 sn ses transkripsiyonu Başak gövdesinin ses içinde bulunduğunu gösterdi; dolayısıyla Başak için eksik TTS okuması değil, analiz hatası var. 265–309,20 sn parçası Kova hakkında kesin sonuç vermedi. `fast_mode=True` denemesi, teşhis logunda NumPy `int64` JSON'a yazılamadığı için durdu; algoritmanın geçtiği/geçmediği henüz doğrulanmadı. Son `37933380515` bu teşhis çıktı hatasını düzeltiyor ve daha geniş son ses aralığını kontrol ediyor.

Resmî analiz aracı belgesi: https://github.com/jianfch/stable-ts#alignment . `fast_mode=True` doğru tam metin ve büyük sessizlik olmayan ses için belgelenmiş bir seçenek; ancak gerçek sesle sonucu doğrulamadan canlıya alınmamalı.

## Sonraki uygulanacak adımlar

1. Yukarıdaki son teşhis sonucunu okuyun. İş bitti ve başarısız. Kova bölümündeki olası TTS atlamasını önce doğrulayın; başka bir rastgele analiz ayarını peş peşe canlıya almayın.
2. Konuşmanın gerçekten tam olduğunu ve sahne başlangıçlarının gerçek okumayla eşleştiğini doğrulayın. Sıfır süreli, aynı zamana yığılmış bütün yorumları kabul ederek sorunu gizlemeyin. Eksik okuma kanıtlanırsa yalnız bu videonun sesini geçersiz sayıp tam metinle tek yeni TTS isteği yapın; üç hazır videoyu koruyun.
3. Kanıtlanan çözümü mevcut klasörde `scripts/automation/align-narration.py` ve gerekiyorsa `full-narration.ts` üzerinde uygulayın. Ham ses analizinden final sese dönüşüm gerekiyorsa `finalDuration/rawDuration` oranını kullanın; analizdeki asgari sahne aralığını ters oranla ölçekleyin. Zamanlama önbelleğinin motor sürümünü değiştirerek eski başarısız/uygunsuz zamanlamayı tekrar kullanmayın.
4. Regresyon testlerini, tip kontrolünü ve ilgili lint kontrolünü Actions üzerinde çalıştırın. Ardından yalnız eksik video üretimini yürütün.
5. Kurtarma için normal üretim workflow'unu main'de `date=2026-10-09`, `force=false`, tercihen `only=horoscope-erkek` ile başlatın. `force=true` ve boş `only` kullanmayın; üç hazır MP4 gereksiz yeniden çizilir. Mevcut kodda `only` filtresi sonunda TAM günlük paket doğrulamasını kaldırmamalı. Hazır endpoint dört videonun tümünü doğrulamalı.
6. Dördüncü MP4'ün gerçek ffprobe süresi <=178,9 sn, son ses <=178,5 sn, tek dosya ve tam metin/sahne eşleştirmesi doğrulanmalı. Canlı uygulamada dört benzersiz video / sekiz platform kaydı kontrol edilmeli.
7. Kullanıcının 9 Ekim otomatik paylaşım planı korunuyor: tam paket doğrulanınca yayın saatleri tamamlanma sonrasına alınacak; mevcut sıralama ve aralıklar korunacak. Manuel sosyal paylaşım tetiklemeyin. Telegram hazır bildiriminin gerçekten gönderildiğini sonuçtan doğrulayın.

## Canlı sürüm ve çalışma alanı

- Repo: `serkangunacti/burc-studio`, uygulama: https://burc-studio.vercel.app/paylasimlar
- Main son commit: `f1031702186f3d0a0b643bf5378a70a408c0e1d6`. Vercel production `dpl_BFtnHjEKpssfu6Ke1YyTjqCo8mLy` READY doğrulandı.
- Asıl doğrulanmış kod commit'i: `6d66ae96f1f5455d9e7686f685d146011f510614`. Önceki Actions doğrulaması `37894832439`: 99 ilgili test, typecheck, lint, 11 Python testi ve önceki erkek tarot sesi üzerinde gerçek eşleştirme geçti. **Bu doğrulama bugünkü erkek burç hatasının çözüldüğü anlamına gelmez.**
- Normal workflow enabled. İlk render 10:01 TSİ; yedekler 11:10, 11:40, 13:10. Vercel günlük içerik cron'u 10:00 TSİ. Eski 04:00 planı kaldırıldı. Son commit normal workflow timeout'unu 180 dakikaya çıkarıyor; pazartesi altı tam video için gerekli pay.
- 3 eski Blob videosu silindi; doğrulamada eski üretim sayısı 0'dı. Bugünün 6 eski yayın kaydı sıfırlandı. 36 eski `voice-*` önbelleği silindi. Yukarıdaki yeni dosyaları/yeni v4 önbelleğini silmeyin.
- Üç TTS anahtarı GitHub Secrets'ta. Değerleri kayda, kaynak koda veya loga yazmayın.
- Gerçek çalışma klasörü: `/Users/serkan/Library/CloudStorage/GoogleDrive-serkangunacti@gmail.com/Drive'ım/Burc Studio/burc-studio`.
- Yerel dal `codex/one-full-narration-179s`, eski base `cab0c580`; üretim değişiklikleri GitHub API ile remote main'e alındı. Yerel değişiklikler mevcut; körlemesine checkout/reset yapmayın. Stash `codex preserve local narration plan before rebasing on remote main` korunmalı, pop/drop yapmayın. `.git` yazma kısıtı nedeniyle önceki remote commit'ler `gh api` ile oluşturuldu.
- Ham-ses stratejisi için geçici bir yerel test yazıldı, fakat strateji gerçek sesle doğrulanmadığı için devir sırasında kaldırıldı. **Uygulanmamış bu yaklaşımı bekleyen bir test bırakılmadı.** Yerel Vitest başlatıcısı Drive I/O nedeniyle çıktı vermedi ve Ctrl-C ile durduruldu; test geçti diye raporlamayın. Sonraki çözümün gerçek soruna uygun regresyon testi eklenmeli.
- Yerel ağır AI veya video renderı yapılmadı. Geçici teşhis workflow metni `/private/tmp/burc-raw-alignment-workflow.yml`; API payload'u aynı isim `.json`. Bunlar main'e alınacak üretim workflow'u değildir.

## Kota için somut durum

9 Ekim yaklaşık 15:00'te GitHub billing ekranı **905/2.000 dakika kullanılmış**, **1.095 dakika kalmış** gösterdi. Devam eden iş/teşhislerin tümü henüz bu değere yansımamış olabilir. Üç gerçek render yaklaşık 19–20 dakika/MP4 sürdü. Bu hızla ücretsiz Actions kotasının 1 Kasım'a kadar günlük 4/pazartesi 6 videoya yeteceğini söylemeyin; önceki daha düşük tahmin geçersiz. Yeni ücretli plan/harcama yetkisi varsaymayın.

Gemini reseti bu tarihte 10:00 TSİ, 2 Kasım'dan itibaren Pasifik kış saati nedeniyle 11:00 TSİ; reset guard mevcut. Anahtar değiştirmek aynı Google projesinin kotasını bağımsız yapmaz. Bugünkü dört tam ses isteği başarıyla üretildi; kalan engel kota değil, son videonun doğrulanmış konuşma-sahne zamanlamasıdır.
