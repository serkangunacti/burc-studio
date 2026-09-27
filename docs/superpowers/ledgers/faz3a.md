# SDD ledger — plan: docs/superpowers/plans/2026-09-26-faz-3a-haftalik.md
Task 1: complete (commits 908b0e9..332bbd6, tests: npx vitest run src/lib/tarot →    Duration  79ms (transform 57%, import 14%, tests 13%, setup 10%, worker 6%))
Task 2: complete (commits 332bbd6..5f0a576, tests: npx vitest run src/lib/astro →    Duration  164ms (transform 53%, import 25%, tests 19%, setup 2%, worker 1%))
Task 3: Ruling: KIND_OFFSETS.weekly=6 ve dosya eki 'haftalik' Task 6'dan öne alındı (READING_KINDS genişleyince tip denetimi istedi); weekly=6 pazartesi 7 gönderinin 7 zemini de ayrı kullanmasını sağlar — maliyet: yok, test ile sabit
Task 3: complete (commits 5f0a576..804c349, tests: npx vitest run src/lib/content src/lib/llm src/lib/posts src/lib/render →    Duration  19.87s (tests 94%, import 4%, transform 1%))
Task 4: Ruling: inceleme odağı 2 için 'günlük uzunlukta dönen burcu haftalık sınırlarla tek başına yeniden ister' testi eklendi (uygulamadan sonra yazıldı; sınırlar servisten çıkarılınca 3 testin düştüğü mutasyonla görüldü) — maliyet: yok
Task 4: complete (commits 804c349..7f9e4ed, tests: npx vitest run src/lib/content →    Duration  10.39s (tests 93%, import 5%, transform 2%))
Task 5: complete (commits 7f9e4ed..d052e84, tests: npx vitest run src/lib/content src/lib/cron →    Duration  16.06s (tests 95%, import 4%, transform 1%))
Task 6: visual: Haftalik-Burc-EnUzun (850 grafem, 28px) 4:5'te kırpılmadan sığıyor, altta ~100 px boşluk; kapak "Haftalık / Burç Yorumları" + hafta aralığı
Task 6: Ruling: editPost önce gönderiyi okuyup sonra türüne göre sınırla doğruluyor (haftalık 850) — sıra değişti: var olmayan gönderiye geçersiz düzenleme artık 'invalid' yerine 'not-found' döner — maliyet: yok (istemci iki durumu da hata olarak gösteriyor)
Task 6: Ruling: 'pastel-weekly@1' kaydında Reels alanı günlük PastelReels (kayıt tipi aynı kalsın); haftalıkta Reels paneli Task 7'de gizlenir — maliyet: panel gizlenmezse haftalık Reels günlük görünümle üretilir
Task 6: complete (commits d052e84..8286953, tests: npx vitest run src/remotion src/lib/posts src/lib/render →    Duration  13.26s (tests 91%, import 7%, transform 2%, setup 1%))
Task 7: visual: gönderi sayfası (masaüstü) başlık "Kadın haftalık yorumlar", Reels paneli yok, yorum sayacı /850; arşiv (mobil 390) Tür süzgeci ve "Kadın · Haftalık" etiketi
Task 7: Ruling: weekLabelTr date/istanbul.ts'e taşındı, week.ts yeniden dışa aktarıyor — istemci bileşeni (gönderi başlığı) astronomy-engine'i paketlemesin — maliyet: yok
Task 7: Ruling: haftalıkta "Kısa metin (Reels)" etiketi "Kısa metin" oldu; alan veri modelinde zorunlu kaldığı için gizlenmedi — maliyet: yok
Task 7: complete (commits 8286953..abdf3d6, tests: npx playwright test e2e/weekly.spec.ts →   4 passed (10.8s))
Task 8: fixed yerel üretim betiği (generate:local) pazartesi haftalık kalemleri atlıyordu — packageItemsFor kullanıyor; betiğin birim testi yok, typecheck + örnek üretimde aynı fonksiyonla doğrulandı
Task 8: Ruling: yerel model (gemma4) ile tasarım örneği üretimi kullanıcı talimatına aykırıydı; durduruldu, yerel veri silindi. Tasarım onayı pazartesi cron'unun Gemini ile ürettiği gerçek haftalık gönderi üzerinden yapılacak; şablon o ana dek indirilmemiş olacağı için gerekirse yerinde değiştirilebilir — maliyet: onay pazartesi sabahına kalır
Final review: code-reviewer (fable) — Critical 0, Important 1, Minor 3; karar: bir düzeltmeyle onay
Final: fixed kart adı/"tarot" metinde geçebiliyordu (spec §1.7) — quality.ts ForbiddenPhrases + WEEKLY_SPEC.forbidden (tarot + çok sözcüklü/özgün kart adları); quality.test 'yorumda tarot sözcüğü ya da çekilen kartın adı…' RED→GREEN, weekly-service 'yorumunda "tarot" geçen burcu…' RED(1 istem)→GREEN, generation-spec.test (sonradan yazıldı), suite 313/313
Final: minor (deferred): pazartesi cron'u haftalıkta başarısız olursa salıdan itibaren arayüzde haftalığı üretme düğmesi yok (API kabul ediyor)
Final: minor (deferred): spreadLoad açıkken pazartesi aynı kitlenin günlük ve haftalık setleri aynı ilk sağlayıcıya gider
Final: Ruling: migration (ALTER TYPE ADD VALUE) canlıda deploy'dan önce uygulanacak — maliyet: sıra bozulursa /arsiv?tur=haftalik 500, pazartesi haftalık üretim hatası
Final: Ruling: pazartesi "Tümünü yeniden üret" haftalığı da yeniden üretir — "Günün paketi" artık haftalığı kapsıyor, onay penceresi uyarıyor — maliyet: istemeden yeni kart çekilişi
Final: Ruling: haftalık yalnız plandaki kitleler için üretilir — makul bağ — maliyet: yok
Final: Ruling: kapanış slaytı günlük metni kullanır — hesap için hâlâ doğru — maliyet: yok
Final: Ruling: MAX_FAILED_SIGNS=6 haftalıkta da geçerli — Groq'un 8K TPM sınırı haftalık paketi 5–7 burçta kesiyor, paket reddedilip sıradaki sağlayıcıya geçiliyor — maliyet: pazartesi daha çok yedek sağlayıcı
User: yerel model yasak; OpenRouter (ücretsiz: gemma-4-31b, nemotron-3-ultra) ve Groq (qwen3.8-27b, 1000 RPD) eklendi; sağlayıcı 'openrouter-2' eklendi (TDD RED→GREEN), anahtarlar Vercel'de Secret
Task 8: design: gerçek içerikli örnekte (OpenRouter nemotron) bulunan ve düzeltilen: (1) model olayları yanlış günlere bağlıyordu → olay listesine gün adı + istem kuralı; (2) başlıkta 'Akrep: …' tekrarı → istem kuralı; (3) 600–700 karakterde kartın altı boş → yazı 32/30/28 px kademeli; 650/750/850 eşiklerinde iki satırlık başlıkla sığdığı render ile görüldü
