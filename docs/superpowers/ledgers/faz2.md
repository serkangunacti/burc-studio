# SDD ledger — plan: docs/superpowers/plans/2026-09-26-faz-2-carousel-jpeg.md
Setup: Ruling: worktree yerine `faz-2-carousel` dalı (Faz 0/1 ile aynı; kullanıcı işlemleri Claude'a bıraktı) — maliyet: yok.
Setup: Ruling: plan incelemesi için kullanıcı beklenmedi — kullanıcı "Faz 2'ye geç" dedi ve teknik kararları Claude'a bıraktı (kalıcı tercih); tasarım onayı Task 10'da kullanıcıya soruluyor — maliyet: plan kapsamı kullanıcının beklediğinden farklıysa Task 10'da geri bildirim.
Pre-flight: T1→T3/T4/T5/T8 SlideProps, FORMAT_SIZES, fixtures — imzalar tutarlı.
Pre-flight: T2→T3/T7/T9 PostDetail, getPostDetail, listArchivePosts, seedPost — tutarlı.
Pre-flight: T3→T7/T8 postEditSchema/PostEdit, DraftSource, PostSummary, STATUS_LABELS — tutarlı.
Pre-flight: T4→T5/T8 PastelSlide, getTemplate, waitForFonts — tutarlı.
Pre-flight: T6 GenerationDeps.format, Faz 1 düzeltmesindeki budgetMs'in yanına eklenir — tutarlı.
Pre-flight: T8→T9 SlideThumbnail, freshPost(page, audience, date), downloadPostZip — tutarlı.
Pre-flight: Ruling: archive.spec alfabetik olarak generate.spec'ten önce koşar; bugünü doldurmasın diye yarının tarihiyle çalışır (planda düzeltildi) — maliyet: yok.
Task 1: complete (commits a4941c5..f5065eb, tests: npm test -- --maxWorkers=3 →    Duration  61.78s (tests 91%, import 8%, transform 1%))
Task 1: Ruling: makine kullanıcının açık oyunu (101OkeyPlus, %200+ CPU) yüzünden yüklü; varsayılan paralellikte PGlite beforeEach 10 sn hook sınırını aştı (26 test, kod değişikliğiyle ilgisiz). Takım --maxWorkers=3 ile çalıştırıldı; hookTimeout değiştirilmedi — maliyet: yok, yalnız süre
Task 2: complete (commits f5065eb..eb9c980, tests: npm test -- --maxWorkers=3 →    Duration  75.69s (tests 92%, import 7%, transform 1%))
Task 3: complete (commits eb9c980..7056ddb, tests: npm test -- --maxWorkers=3 →    Duration  81.99s (tests 92%, import 7%, transform 1%))
Task 4: complete (commits 7056ddb..e7875e0, tests: npm test -- --maxWorkers=3 →    Duration  82.36s (tests 91%, import 8%, transform 1%))
Task 5: Ruling: Studio 'Version mismatch: zod installed 4.6.5, required 4.5.4' uyarısı verdi — Remotion'a zod şeması verilmiyor (renderStillOnWeb/Composition schema kullanılmıyor), zod uygulamanın geri kalanında (AI SDK, doğrulama) kullanılıyor; zod düşürülmedi. Studio 200 döndü, 'Built in 4284ms', paketleme hatası yok — maliyet: Studio'da şema tabanlı prop düzenleme kullanılırsa uyumsuzluk çıkabilir
Task 5: complete (commits e7875e0..e02d822, tests: npm test -- --maxWorkers=3 →    Duration  85.77s (tests 91%, import 7%, transform 1%))
Task 6: complete (commits e02d822..0afc92c, tests: npm test -- --maxWorkers=2 →    Duration  46.58s (tests 91%, import 7%, transform 1%))
Task 6: note: yük ortalaması 61'e çıktı (oyun + E2E); tam takım bundan sonra --maxWorkers=2 ile koşuyor, hookTimeout değişmedi
Task 7: complete (commits 0afc92c..8051553, tests: npm test -- --maxWorkers=2 →    Duration  33.82s (tests 91%, import 8%, transform 1%))
Task 8: Ruling: renderStillOnWeb composition tipi (props dolu olduğunda) defaultProps istiyor; plandaki olası 'calculateMetadata: null' notu yerine defaultProps: props eklendi (inputProps ile aynı) — kaynak: node_modules/@remotion/web-renderer/dist/props-if-has-props.d.ts — maliyet: yok
Task 8: Ruling: plan testindeki font denetimi 'U+0100' arıyordu; Chrome aralığı 'U+100-2BA' diye yazıyor (fontlar yüklü, doğrulandı). Test unicode-range'i ayrıştırıp ğşıİöüç ĞŞÖÜÇ harflerinin her birini yüklenmiş Fraunces/Nunito yüzüyle kapsadığını denetleyecek şekilde düzeltildi (daha sıkı) — maliyet: yok
Task 8: Ruling: getByLabel('Yorum') '<Burç> yorumunu yeniden üret' aria-label'ıyla da eşleşti; exact: true — maliyet: yok
Task 8: visual: gerçek render doğrulandı (kadın+erkek, 28 JPEG, 1080×1350; Türkçe harfler ve renkli emoji doğru). Bulunan ve düzeltilen: (1) ışıltı süsleri başlık yazısı ve kart kenarıyla çakışıyordu → köşelere taşındı; (2) önizleme küçük resmi <button> içinden text-align:center miras alıyor, JPEG sola yaslı çıkıyordu → PastelSlide kökünde yazı ayarları sabitlendi (test: 'çizim konumları tam piksel; kök stil…' RED→GREEN); (3) Next "1 Issue": kapak çemberindeki kesirli konumlar hydration uyuşmazlığı veriyordu → Math.round (aynı test). Konsol hatası kalmadı; mobilde scrollWidth 390.
Task 8: complete (commits 8051553..ecc9d94, tests: sh -c 'npm test -- --maxWorkers=2 && npm run test:e2e' →   18 passed (34.1s))
Task 9: note: E2E logunda '[WebServer] ⨯ Error: The destination stream closed early.' (2 kez) — çok bağlantılı sayfalardaki Link prefetch akışları test bağlamı kapanırken kesiliyor; testler 21/21 geçti. Görsel: arşiv masaüstü/mobil scrollWidth 1280/390, Bugün'de 'Gönderiyi aç' bağlantıları
Task 9: complete (commits ecc9d94..13c4247, tests: sh -c 'npm test -- --maxWorkers=2 && npm run test:e2e' →   21 passed (43.3s))
Task 9: Ruling: renderStillOnWeb her render'da lisans uyarısı veriyordu; kullanıcı tek kişilik, ticari olmayan kullanım (spec §12: bireylere ücretsiz) → licenseKey: 'free-license' eklendi (ayrı commit), uyarı kalktı — maliyet: sayfa gelir getirmeye başlarsa lisans koşulları yeniden değerlendirilmeli
Task 10: design change: kapak cümlesi uzunluğa göre 52/46/40px ve kutu 430px (48 grafemlik gerçek kanca 5 satıra bölünüyordu) — test 'kapak cümlesi uzadıkça küçülür' RED→GREEN
Task 10: design change (kullanıcı isteği: 'günde 3 kere… hepsinde aynı değil, değişik arka planlarda… çok küçük değişiklikler'): SlideProps.variant (tarih+tür+kitle'den deterministik, variantFor), 7 pastel zemin + zemine bağlı 3 ışıltı yerleşimi; aynı gün 5 gönderi türü ayrı zemin, ardışık günler farklı. Testler RED→GREEN; arşiv birebirliği korunuyor (variant kayıtlı veriden hesaplanır)
Task 10: user: tasarım onaylandı ('Tasarımları beğendim. devam et'); ek istekler: ad 'kozmikarkan' (UI adı değişti, canlı ayarda instagramHandle=kozmikarkan), slaytlarda sağ üst indirme butonu (E2E RED→GREEN), carousel'lerden Reels videosu (Faz 2 sonrası ayrı plan)
Task 10: complete (commits 1bff585..9a0a92f, tests: sh -c 'npm test -- --maxWorkers=2 && npm run test:e2e' →   22 passed (32.3s))
Final: Ruling: kullanıcı isteğiyle ('kartların üst kısmında günlük burç - kadın … kaldıralım … çok belli oluyor ai kullanıldığı') burç kartındaki etiket kaldırıldı; pastel@1 henüz hiçbir yayımlanmış gönderide kullanılmadığından aynı sürümde değiştirildi, dondurma manifestinde yalnız sign-slide.tsx özeti güncellendi (test RED→GREEN) — maliyet: yok
Final: fixed eşzamanlı düzenleme/yenileme eski temelden sürüm açıp değişiklik siliyordu — 'temel alınan sürüm artık güncel değilse yeni sürüm açmaz', 'aynı sürüme eşzamanlı iki kayıt…', 'yenileme sürerken gönderi başka bir sürüme geçerse…' RED→GREEN
Final: fixed arşivde 'Daha eski' sınır günündeki gönderileri atlıyordu — 'sayfayı gün sınırında keser…' RED→GREEN
Final: fixed dondurma yalnız şablon klasörünü koruyordu (lucky-colors, signs, variantFor, tarih biçimi, graphemeLength, FORMAT_SIZES arşiv çıktısını sessizce değiştirebilirdi) — 'örnek gönderiler aynı işaretlemeyle çizilir' altın testi; iki çalıştırmada kararlı, lucky-colors hex'i geçici değiştirilince RED (sonra geri alındı). Piksel düzeyi altın JPEG testi tarayıcı sürümüne bağlı olduğundan seçilmedi
Final: Ruling: reviewer minor #4 (yalnız boşluk/büyük-küçük harf düzenlemesi sonrası sayfa 'kaydedilmemiş' kalıp ZIP ve tek slayt indirmesini kilitliyordu) Important'a yükseltildi — ana akışı (indirme) yenilemeden kurtulunamayan biçimde bloke ediyor
Final: fixed yukarıdaki — 'yalnızca boşluk eklenen kayıt sürüm açmaz ve indirmeyi kilitli bırakmaz' E2E RED→GREEN
Final: minor (deferred): 409 stale yanıtındaki currentId kullanılmıyor; kullanıcı yalnız toast görür, güncel sürüme bağlantı yok, taslak kaybolur
Final: minor (deferred): markDownloaded yanıtı kontrol etmiyor; başarısızsa durum sessizce Taslak kalır
Final: minor (deferred): iOS Safari'de ZIP indirme await sonrası a.click() ile tetikleniyor ve object URL 10 sn'de iptal ediliyor — gerçek iPhone'da doğrulanacak (Task 11); paylaşım yolu ayrı dokunuşla çalışıyor
Final: minor (deferred): Focus 1 E2E'si 35 karakterlik başlık kullanıyor, 40 değil (3 satırlık başlık 4:5'te test edilmedi)
Final: minor (deferred): tek burç yenileme kaydedilmemiş taslağı uyarısız atar (yeni sürüme geçiş remount eder)
Final: Ruling: reviewer'ın pastel@1'i yerinde değiştirme uyarısı — Faz 2 henüz canlıda değil, production'da hiçbir gönderi pastel@1 ile indirilmedi; değişiklik aynı sürümde kaldı — maliyet: yok
Final: Ruling: 'Declined to judge' — sürüm başına durum (paylaşılmış gönderi düzenlenince yeni sürüm Taslak), tek slayt indirmenin durumu değiştirmemesi, #Instagram→#ınstagram, tarayıcılar arası bayt eşliği, eşzamanlı renderStillOnWeb: tek kullanıcılı akışta kabul edilebilir; ilk ikisi ürün kararı olarak kullanıcıya raporlanır — maliyet: arşivde 'Paylaşıldı' süzgeci düzenlenmiş gönderiyi göstermeyebilir
