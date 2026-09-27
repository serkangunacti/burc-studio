# SDD ledger — plan: docs/superpowers/plans/2026-09-26-faz-1-gunluk-burc-motoru.md
Spec: docs/superpowers/specs/2026-09-25-burc-studio-design.md (okundu; bağlayıcı otorite)
Setup: Ruling: izolasyon worktree yerine `faz-1-gunluk-burc` dalı (Faz 0 ile aynı gerekçe; kullanıcı işlemleri Claude'a bıraktı) — maliyet: yok.
Setup: Faz 0'dan taşınan: typecheck = `next typegen && tsc --noEmit`; e2e'de `getByRole('alert')` gerekiyorsa `.filter({ hasText })`; rate-limit API'si reserveLoginAttempt'e değişti (Faz 1 kullanmıyor); .agents/.claude/skills/skills-lock.json yok sayılıyor (Faz 1'deki `git add -A` güvenli).
Pre-flight: T1→T2/T4/T5/T8 SignSlug, SIGNS, getSign, signFromLongitude, normalizeSignName, foldTurkish/graphemeLength/countEmoji/looksTurkish adları eşleşiyor — temiz.
Pre-flight: T3→T4/T5/T8/T10/T12 LUCKY_COLOR_IDS, normalizeLuckyColor, getLuckyColor, mergeHashtags, READING_*/RUN_TRIGGERS, AUDIENCES, AUDIENCE_LABELS, RecentHeadline eşleşiyor — temiz.
Pre-flight: T4→T5/T6/T7/T10 QualityIssue, horoscope şemaları, checkHoroscopeBatch/checkSingleSign/batchIssues, mockHoroscopeEntry/Batch eşleşiyor — temiz.
Pre-flight: T6→T7/T10/T11/T13 ProviderSpec{factory(modelId)}, ProviderId (provider-ids.ts), availableProviders, resolveProviderChain eşleşiyor — temiz.
Pre-flight: T7→T8/T10/T11 AttemptLog, ProviderUsage, generateWithFailover, AllProvidersFailedError, NoProvidersConfiguredError eşleşiyor — temiz.
Pre-flight: T8→T10/T11/T12/T13 saveReadings, getCurrentReadings, getRecentHeadlines, createPostVersion, getCurrentPost(sForDate), startRun/finishRun/logLlmCall/getProviderUsage/getUsageSummary eşleşiyor — temiz.
Pre-flight: T9→T10/T11/T13 PlanItem, providerPreferenceSchema, Settings.cronEnabled/dailyPlan/baseHashtags/providerChain/spreadLoad eşleşiyor — temiz.
Pre-flight: T10→T11 GenerationDeps(spreadLoad?), SetResult, generateHoroscopeSet, regenerateSign, generateDailyPackage eşleşiyor — temiz.
Task 1: complete (commits 67cabb0..9f450ee, tests: npm test →    Duration  5.61s (tests 85%, import 12%, transform 2%))
Task 2: complete (commits 9f450ee..9636190, tests: npm test →    Duration  6.36s (tests 85%, import 11%, transform 3%))
Task 3: complete (commits 9636190..3ce817e, tests: npm test →    Duration  5.57s (tests 84%, import 11%, transform 3%, setup 1%))
Task 4: complete (commits 3ce817e..f78e7b4, tests: npm test →    Duration  5.73s (tests 82%, import 12%, transform 4%, setup 1%))
Task 5: complete (commits f78e7b4..afb19ee, tests: npm test →    Duration  6.36s (tests 82%, import 13%, transform 4%, setup 1%))
Task 6: complete (commits afb19ee..b2f0909, tests: npm test →    Duration  6.46s (tests 82%, import 13%, transform 4%, setup 1%))
Task 7: complete (commits b2f0909..f8eeb17, tests: npm test →    Duration  6.19s (tests 81%, import 14%, transform 4%, setup 1%))
Task 8: complete (commits f8eeb17..7cc2b8c, tests: npm test →    Duration  8.20s (tests 88%, import 9%, transform 3%))
Task 9: complete (commits 7cc2b8c..a9d8396, tests: npm test →    Duration  9.40s (tests 89%, import 8%, transform 2%))
Task 10: complete (commits a9d8396..9c9148b, tests: npm test →    Duration  15.75s (tests 92%, import 6%, transform 2%))
Task 11: note: eslint uyarısı src/lib/text/turkish.ts:16 ('_' kullanılmıyor, Task 1 kodu) — yalnız uyarı, dokunulmadı
Task 11: complete (commits 9c9148b..e388608, tests: npm test →    Duration  18.08s (tests 92%, import 6%, transform 1%))
Task 12: Ruling: shadcn'in globals.css'e eklediği orbit keyframe'i tek satıra sıkışık yazılmıştı; aynı içerikle çevre stiline göre biçimlendirildi — davranış değişmedi — yanlışsa maliyeti: yok (yalnız biçim)
Task 12: note: görsel kontrol — masaüstü 1280px Bugün: çark döner, konfeti bir kez; mobil 390px Burçlar: 12 kart tek sütun, scrollWidth 390, son kart alt menünün üstünde. Chrome DevTools MCP mobil ekran görüntüsünde zaman aşımına uğradı; mobil kontrol Playwright betiğiyle yapıldı.
Task 12: complete (commits e388608..793697f, tests: sh -c 'npm test && npm run test:e2e' →   11 passed (10.8s))
Task 13: Ruling: Faz 0 settings.spec'teki getByRole('button', { name: 'Kaydet' }) yeni 'Üretim ayarlarını kaydet' butonuyla da eşleşti (Playwright alt dize eşleşmesi, strict mode ihlali) — seçici exact: true yapıldı; doğrulanan davranış aynı — yanlışsa maliyeti: yok
Task 13: complete (commits 793697f..44a4d06, tests: sh -c 'npm test && npm run test:e2e' →   12 passed (10.5s))
Task 14: Ruling: elle doğrulama başarısız — gemma4:26b ve qwen3.8 (her biri ~18 GB) 16 GB RAM'li M4'te %53-85 CPU'da koşuyor; tek satırlık JSON isteği bile 300 sn'de dönmedi (AI_APICallError: Headers Timeout Error, 303 s / 304 s). Tam paket denemesi 681 s sonra iki kitlede de 2× server_error ile bitti. Betik kodu doğru (bağlanıyor, hatayı raporluyor, exit 1). Commit edildi; yerel yedek bu donanımda bu modellerle kullanılamaz — kullanıcıya küçük model önerisi rapora yazılacak — yanlışsa maliyeti: acil durum yedeği yok, bulut zinciri tek yol
Task 14: finding: undici fetch varsayılan headersTimeout=300 s; generate-local'daki timeoutMs 600_000 bu yüzden etkisiz (akışsız OpenAI-uyumlu çağrıda başlıklar üretim bitince gelir)
Task 14: complete (commits 44a4d06..377c742, tests: npm test →    Duration  11.90s (tests 90%, import 8%, transform 2%))
Task 15: finding: AI Gateway canlı deneme 403 — 'AI Gateway requires a valid credit card on file to service requests' (spec §11.3 'kart gerekmez' varsayımı yanlış). Yönlendirici auth_error olarak sınıflayıp zinciri tüketti ve net hata verdi. Gerçek üretim için Gemini/Ollama anahtarı ya da Vercel'e kart eklenmesi gerekiyor (kullanıcı kararı). Migration 0001 production Neon'a uygulandı (7 tablo, 2 migration).
Final: fixed İngilizce caption/kapak kaydediliyordu — 'İngilizce kapak kancası ve caption yanıtı reddeder' RED→GREEN, suite 216/216
Final: fixed takılan sağlayıcı 300 sn'yi aşıp çalışmayı running bırakıyordu — 'zaman bütçesi dolunca kalan sağlayıcıları denemeden hata fırlatır' ve 'zaman bütçesi dolarsa beklemeden durur ve çalışmayı failed işaretler' RED→GREEN, suite 218/218, e2e 12/12
Final: Ruling: aynı düzeltmede generate-local timeoutMs 290_000 / budgetMs 540_000 yapıldı (undici 300 s başlık sınırı ve STALE_RUN_MS 10 dk altında) — reviewer minor #4 ve bilinen headersTimeout bulgusu bu parametrelerle kapandı — yanlışsa maliyeti: yerel üretim 9 dk'da kesilir
Final: minor (deferred): skipIfExists ve regenerateSign'daki current okuması kilitten önce (ms'lik yarış)
Final: minor (deferred): burç adı eşleşmesi katlama sonrası birebir; "Koç (Aries)" gibi biçimler eşleşmez
Final: minor (deferred): tr-TR küçük harf ASCII I'yı ı yapar (#Istanbul → #ıstanbul) — hashtagler katlanmıyor
Final: minor (deferred): istemcide fetch reddi (telefon kilitlenmesi) butonu "Üretiliyor…"da bırakır; tek burç butonu hata sınırına düşer
Final: minor (deferred): Gateway'in kendi 408 zaman aşımı client_error sayılıyor (tekrar yok); bizim abort'umuz server_error olarak loglanıyor
Final: minor (deferred): ayarlar formunda boş tavan/model "Sağlayıcı sırası okunamadı" hatası veriyor; her kayıt model/tavanı dondurur
Final: minor (deferred): silinen route.test yerine route düzeyinde 401 testi yok (canlıda curl ile doğrulanacak)
Final: minor (deferred): tek burç yenilemede modele bugünkü metin verilmiyor, "farklı açı" isteği körlemesine
