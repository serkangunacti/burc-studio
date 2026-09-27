# SDD ledger — plan: docs/superpowers/plans/2026-09-26-faz-0-iskelet.md
Spec: docs/superpowers/specs/2026-09-25-burc-studio-design.md (okundu; bağlayıcı otorite)
Setup: Ruling: izolasyon worktree yerine ~/burc-studio içinde `faz-0-iskelet` dalı — onaylı plan (Global Constraints + Task 1 Step 1) dal yaklaşımını kullanıcı tercihi olarak belirtiyor; worktree plan komutlarındaki yolları bozardı — maliyet: ana checkout'ta çalışılır, main'e commit yok.
Pre-flight: T2→T4/T6/T7/T10 Db, createTestDb, settings/loginAttempts adları eşleşiyor — temiz.
Pre-flight: T5→T7/T8 SESSION_COOKIE, createSessionToken, verifySessionToken, sessionCookieOptions, hashPassword/verifyPassword eşleşiyor — temiz.
Pre-flight: T6→T7 checkLoginAllowed/recordFailedLogin/clearLoginAttempts(db, ip, now?) + getClientIp eşleşiyor — temiz.
Pre-flight: T4→T10 Settings/SettingsPatch/WATERMARK_POSITIONS/parseInstagramHandleInput/normalizeInstagramHandle eşleşiyor — temiz.
Pre-flight: T1/T2/T5/T7→T9 istanbul tarih yardımcıları, startLocalDb({port,dataDir}), hashPassword, safeNextPath, /api/auth/* eşleşiyor — temiz.
Pre-flight: T9→T10 e2e login(page, path?) ve 'Şifre' etiketi eşleşiyor — temiz.
Task 1: Ruling: create-next-app sırasında `.superpowers/` scratchpad'e taşınıp geri konuldu — create-next-app bilinmeyen dizin içeren klasöre kurulumu reddediyor — maliyet: yok (ledger korundu).
Task 1: Ruling: `@types/node` ^20 → ^24 — vitest 5.0.2 peer `^22 || >=24` istiyor; engines 24.x ile tutarlı; --force/--legacy-peer-deps kullanılmadı — maliyet: yok.
Task 1: Ruling: Expected "12 test" → gerçekte 11 — planın sayım hatası, tüm test vakaları mevcut — maliyet: yok.
Task 1: complete (commits 6c144fe..24146ec, tests: npm test →    Duration  102ms (transform 41%, import 38%, worker 8%, setup 7%, tests 6%))
Task 2: complete (commits 24146ec..f69fa10, tests: npm test →    Duration  1.05s (tests 77%, import 19%, transform 3%))
Task 3: complete (commits f69fa10..b42ec04, tests: npm test →    Duration  1.07s (tests 75%, import 19%, transform 5%, setup 1%))
Task 4: complete (commits b42ec04..0366b52, tests: npm test →    Duration  2.25s (tests 84%, import 13%, transform 3%, setup 1%))
Task 5: complete (commits 0366b52..5c01eea, tests: npm test →    Duration  2.39s (tests 81%, import 13%, transform 5%, setup 1%))
Task 6: complete (commits 5c01eea..dc8b851, tests: npm test →    Duration  3.45s (tests 87%, import 10%, transform 2%, setup 1%))
Task 7: complete (commits dc8b851..4fd8c93, tests: npm test →    Duration  5.37s (tests 87%, import 10%, transform 2%))
Task 8: complete (commits 4fd8c93..c69c87a, tests: npm test →    Duration  5.10s (tests 88%, import 10%, transform 2%))
Task 9: Ruling: Kırmızı E2E "etiket bulunamadı" yerine webServer zaman aşımı olarak göründü — Playwright 404'ü hazır saymıyor; neden elle doğrulandı (/giris 404, / → 307 /giris) — maliyet: yok.
Task 9: Ruling: auth.spec'te `getByRole('alert')` → `getByRole('alert').filter({ hasText: 'Şifre hatalı.' })` — Next her sayfaya role=alert taşıyan `#__next-route-announcer__` ekliyor; iddia gücü aynı. Task 10'daki aynı seçiciye de uygulanacak — maliyet: yok.
Task 9: Ruling: `typecheck` script'i `next typegen && tsc --noEmit` oldu — tsc önceki build'den kalan eski `.next/types`'a bağlıydı (silinen page.tsx hatası); typegen sırayı önemsiz kılar — maliyet: typecheck başına ~1-2 sn.
Task 9: complete (commits c69c87a..7a742ed, tests: sh -c 'npm test && npm run test:e2e' →   5 passed (6.1s))
Task 10: Ruling: settings.spec'teki `getByRole('alert')` Task 9 kararı gereği `.filter({ hasText })` ile daraltıldı — aynı Next route announcer belirsizliği — maliyet: yok.
Task 10: complete (commits 7a742ed..2742524, tests: sh -c 'npm test && npm run test:e2e' →   8 passed (9.8s))
Task 11: complete (commits 2742524..d3b2b24, tests: npm test →    Duration  5.27s (tests 86%, import 11%, transform 2%, setup 1%))
Task 12: Ruling: Step 8 (birleştirme) ve Step 9 (production doğrulaması), tüm dal incelemesinden sonraya alındı — executing-plans birleştirmeden önce dal incelemesi istiyor; Step 1-7 (önizleme) önce yürütülür — maliyet: yok.
Task 12: Ruling: production vercel.app alanı Vercel Authentication (all_except_custom_domains) ile korunuyor; spec yalnızca önizleme korumasını öngörüyordu. Güvenliği düşürmemek için şimdilik korunuyor; cron'un bu koruma altında çalışması production'da test edilecek, çalışmazsa kullanıcıya sorulacak — maliyet: kullanıcı her tarayıcıda bir kez Vercel'e de giriş yapar.
Final: minor (deferred): pg 8.23, Neon URL'deki sslmode=require için 'gelecekte verify-full semantiği' uyarısı veriyor; şu an davranış güvenli (verify-full), pg 9 öncesi URL'ye sslmode=verify-full eklenebilir.
Task 12: Ruling: ilk git deploy'u (faz-0-iskelet) Vercel tarafından production'a atandı (projede henüz production yoktu; productionBranch=main doğru). Site Vercel Auth + uygulama şifresiyle korunduğu için bırakıldı; böylece cron production'da test edilebilir — maliyet: inceleme öncesi kod production'da (dışarıya kapalı).
Task 12: Ruling (düzeltme): production alanı burc-studio.vercel.app Vercel Auth ile KORUNMUYOR (düz istek uygulamanın /giris'ine 307); yalnızca deploy'a özel URL'ler korunuyor — spec'le birebir uyumlu. Önceki "production korunuyor" kararı geçersiz — maliyet: yok.
Task 12: Doğrulama: /ayarlar→307 /giris?next=%2Fayarlar; robots noindex+Disallow; cron anahtarsız 401; Vercel'in tetiklediği cron 200 (gerçek CRON_SECRET); yanlış şifre 401 (DB+hash çalışıyor); Neon migration uygulandı.
Task 12: Not: `vercel env pull` gizli değişkenleri (SESSION_SECRET, CRON_SECRET, APP_PASSWORD_HASH) 11 karakterlik yer tutucu olarak yazıyor; yerel betikler yalnızca DATABASE_URL kullanmalı (Faz 1 generate:local için geçerli).
Task 12: Step 7 (kullanıcının kendi şifresiyle tarayıcı girişi) birleştirme sonrasına, rapora bırakıldı — yalnızca kullanıcı şifreyi biliyor.
Task 12: Doğrulama: kullanıcı https://burc-studio.vercel.app adresinde kendi şifresiyle giriş yaptığını bildirdi (APP_PASSWORD_HASH doğru) — Step 7 tamam.
Final review: code-reviewer (fable), paket review-6c144fe..11d27b8 — hüküm: "With fixes" (1 Critical, 1 Important, 5 Minor).
Final: fixed #1 açık yönlendirme (nokta segmentleri: /.//evil.com vb.) — redirect.test.ts 5 yeni vaka RED→GREEN (15/15), suite 98/98 — commit 3f70080.
Final: fixed #2 paralel istekle giriş sınırı aşımı — login-handler.test "paralel yanlış denemeler" RED (10×401)→GREEN (5×401+5×429); reserveLoginAttempt atomik upsert+RETURNING, eski check/record kaldırıldı, rate-limit testleri aynı davranışı yeni fonksiyonla doğruluyor + eşzamanlılık testi; suite 98/98, E2E 8/8 — commit fe2a30e.
Final: minor (deferred): #3 SESSION_SECRET eksikken doğru şifre 500 döndürüyor (yalnız yanlış yapılandırmada şifre doğruluğunu sızdırır); başa 503 kontrolü eklenebilir.
Final: minor (deferred): #4 instagram.com/p/… ya da /reel/… URL'si "@p"/"@reel" olarak kabul ediliyor; önizlemede görünür, ayrılmış segmentler reddedilebilir.
Final: minor (deferred): #5 hash-password betiği şifreyi yazarken ekranda gösteriyor.
Final: minor (deferred): #6 X-Frame-Options / frame-ancestors başlığı yok (clickjacking); Faz 1 üretim butonları öncesi eklenmesi önerilir.
Final: minor (deferred): İngilizce Next hata sayfaları (not-found/error Türkçe değil); oturumu dolmuş kullanıcı ayar kaydederken giriş yerine "unexpected response" görüyor.
Final: Ruling: #7 takip edilmeyen .agents/, .claude/skills/, skills-lock.json (Neon entegrasyonu kurdu) .gitignore'a eklendi — Faz 1'in `git add -A` adımları bunları commit'lemesin; yeniden kurulabilir yerel araçlar — maliyet: yok.
Final: Ruling: sürücü node-postgres+attachDatabasePool (spec'teki @neondatabase/serverless yerine) — transaction gerektiği için planda seçildi, davranış gereksinimi etkilenmiyor — maliyet: yok.
Final: Ruling: 30 günlük durumsuz JWT, çıkış yalnızca çerezi siler — spec §7 tasarımı; çalınan çerez SESSION_SECRET döndürülerek iptal edilir — maliyet: çerez sızarsa 30 güne kadar geçerli.
Final: Ruling: çıkış CSRF'i (başka site formla çıkış yaptırabilir) — yalnızca rahatsızlık, veri etkisi yok — maliyet: kullanıcı yeniden giriş yapar.
Final: Ruling: paylaşılan IP (mobil CGNAT) kilidi — spec'in IP başına kuralı; 15 dk ile sınırlı — maliyet: nadiren 15 dk bekleme.
Final: Ruling: x-forwarded-for'un ilk IP'sine güven — Vercel başlığı üzerine yazıyor; kendi sunucuda barındırma kapsam dışı — maliyet: yok.
Final: Ruling: saveSettings transaction'sız oku-birleştir-yaz — tek kullanıcı, aynı anda iki kayıt pratikte yok — maliyet: nadir kayıp güncelleme.
Final: Ruling: eski deploy'un bilinmeyen ayar anahtarlarını düşürmesi — Faz 1 yeni alanları varsayılanlarla ekliyor, eski deploy yalnızca geçiş anında — maliyet: yeni ayarlar varsayılana dönebilir.
Final: Ruling: girişliyken /giris formu göstermesi ve E2E'nin next dev'de koşması — zararsız / canlı kontroller Vercel'de yapıldı — maliyet: yok.
Task 12: Doğrulama (production, main 67cabb0): /ayarlar→307 /giris?next=%2Fayarlar; noindex; cron anahtarsız 401; Vercel cron 200; dal main'e fast-forward birleştirildi, uzak/yerel faz-0-iskelet silindi.
Task 12: complete (commits d3b2b24..67cabb0, tests: npm test →    Duration  5.67s (tests 84%, import 12%, transform 3%, setup 1%))
