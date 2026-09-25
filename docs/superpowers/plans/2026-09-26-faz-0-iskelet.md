# Faz 0: İskelet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vercel'de çalışan, yalnızca şifreyle girilebilen, pastel Magic UI temalı Next.js 16 iskeleti. Instagram kullanıcı adı ve filigran ayarları Neon'da saklanır, cron uç noktası `CRON_SECRET` ile korunur.

**Architecture:** Next.js 16 App Router (`src/`). Tek kullanıcılı oturum: scrypt şifre özeti + jose HS256 JWT çerezi, koruma `src/proxy.ts` ile. Drizzle ORM: üretimde node-postgres + Neon (`attachDatabasePool`), birim testlerde bellek içi PGlite, yerel geliştirme ve E2E'de PGlite soket sunucusu (üretim verisine hiç dokunulmaz). Route handler'lar incedir; iş mantığı bağımlılık enjeksiyonlu, test edilebilir `src/lib/**` modüllerindedir.

**Tech Stack:** Next.js 16.3.6, React 19.2, TypeScript 5, Tailwind v4, shadcn (base-nova / Base UI), Magic UI (yerel vendor), Drizzle ORM 0.45.3 + drizzle-kit 0.31.11, pg 8, @vercel/functions 3, @electric-sql/pglite 0.5.8 + pglite-socket 0.2.11, jose 6.2.12, zod 4, Vitest 5.0.2, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-25-burc-studio-design.md`

## Global Constraints

- Node: `package.json` → `"engines": { "node": "24.x" }` (Vercel). Paket yöneticisi npm.
- Next.js 16.3.6 App Router, `src/` dizini, `@/*` → `./src/*`. Next API'si yazmadan önce `node_modules/next/dist/docs/` altındaki ilgili rehber okunur (AGENTS.md kuralı). Middleware yok; `src/proxy.ts` içinde `export function proxy` kullanılır.
- Arayüz metinleri Türkçe, `<html lang="tr">`. Tarih gösterimi `tr-TR` + `Europe/Istanbul`.
- Gizli değerler yalnızca sunucuda: `APP_PASSWORD_HASH`, `SESSION_SECRET` (en az 32 karakter), `CRON_SECRET`, `DATABASE_URL`.
- Girişsiz erişim: sayfalar `/giris?next=…` adresine yönlenir, `/api/*` 401 JSON döner. Herkese açık yollar: `/giris`, `/api/auth/*`, `/api/cron/*`, `_next/static`, `_next/image`, `favicon.ico`, `robots.txt`.
- Tüm yanıtlarda `X-Robots-Tag: noindex, nofollow`; `robots.txt` her şeyi engeller.
- Giriş sınırı: IP başına 15 dakikada en fazla 5 başarısız deneme.
- Oturum çerezi `bs_session`: httpOnly, sameSite=lax, path `/`, 30 gün; `secure` yalnızca `NODE_ENV=production` iken.
- Ayarlar tek satırlık jsonb. Instagram kullanıcı adı `^[a-z0-9._]{1,30}$` (küçük harfe çevrilir, `@` ve instagram.com URL'si temizlenir). Filigran varsayılanı: açık, alt-orta, opaklık 0.55.
- Fontlar: Fraunces (başlık, `--font-heading`) + Nunito (metin, `--font-sans`), `latin-ext` alt kümesiyle.
- Magic UI bileşenleri yalnızca `npx shadcn@latest add ~/.agents/skills/magic-ui/vendor/r/<slug>.json` ile kurulur. `src/components/ui/**` üretilmiş vendor kodudur: lint dışıdır ve elle yeniden yazılmaz.
- DB'ye dokunan sayfalar ve tarihe bağlı sayfalar render başında `await connection()` çağırır (aksi halde build sırasında statik üretilir).
- Commit mesajları Conventional Commits biçiminde, son satır `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Çalışma dalı `faz-0-iskelet`; `main`'e doğrudan commit yok.
- E2E testleri çalışırken `npm run dev` kapalı olmalı (ikisi de `.next/` kullanır).

## Review Focus

1. **Açık yönlendirme:** `/giris?next=https://evil.com`, `//evil.com` ya da `/\evil.com` gibi değerler dış siteye yönlendirmemeli, `/` adresine düşmeli. → Task 5, `redirect.test.ts`.
2. **Eksik gizli değer:** `SESSION_SECRET` eksik ya da kısa, `APP_PASSWORD_HASH` eksik olduğunda sistem kapalı kalmalı (fail closed). Kimse içeri alınmamalı, çökme ya da açık kapı olmamalı. → Task 5 `session.test.ts`, Task 7 `login-handler.test.ts` (503), Task 8 `proxy.test.ts`.
3. **Kullanıcı adı varyantları:** `"@Foo.Bar "`, `https://www.instagram.com/foo.bar/?hl=tr`, `"foo bar"`, 31 karakter, `"Ayşe"` ve boş değer doğru normalize edilmeli ya da Türkçe hata vermeli. → Task 4, `schema.test.ts`.
4. **IP başlığı varyantları:** `x-forwarded-for` çoklu olduğunda ilk IP alınmalı. Başlık hiç yoksa `unknown` kovası kullanılmalı. 5 hatadan sonra kilit, 15 dakika sonra sıfırlama çalışmalı. → Task 6.
5. **Proxy kapsamı:** Proxy statik dosyaları ve `robots.txt`'yi engellememeli (giriş sayfasının CSS'i bozulur). API'ye HTML yönlendirmesi değil, 401 JSON dönmeli. → Task 8, `proxy.test.ts`.

---

### Task 1: Next.js iskeleti, test altyapısı ve İstanbul tarih yardımcıları

**Files:**
- Create (iskelet): `create-next-app` çıktısı (`src/app/*`, `AGENTS.md`, `CLAUDE.md`, `eslint.config.mjs`, `next.config.ts`, `tsconfig.json`, …)
- Modify: `package.json`, `eslint.config.mjs`, `.gitignore`
- Create: `vitest.config.ts`, `src/test/setup.ts`, `src/lib/date/istanbul.ts`
- Test: `src/lib/date/istanbul.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
```ts
// src/lib/date/istanbul.ts
export type DateKey = string; // 'YYYY-MM-DD', Europe/Istanbul takvim günü
export function istanbulDateKey(instant?: Date): DateKey;
export function isDateKey(value: unknown): value is DateKey;
export function addDays(key: DateKey, days: number): DateKey;
export function istanbulDayStart(key: DateKey): Date; // 00:00 TSİ
export function istanbulNoon(key: DateKey): Date;     // 12:00 TSİ
export function formatDateLongTr(key: DateKey): string;  // '26 Eylül 2026 Cumartesi'
export function formatDateShortTr(key: DateKey): string; // '26 Eylül'
```

- [ ] **Step 1: Dalı aç, planları commit'le, iskeleti kur**

```bash
cd ~/burc-studio
git switch -c faz-0-iskelet
git add docs/superpowers/plans
git commit -m "docs: Faz 0 ve Faz 1 uygulama planları" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
npx -y create-next-app@16.3.6 . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes --disable-git
```
Expected: `Success! Created burc-studio`. `docs/` dokunulmamış. `AGENTS.md` ve `CLAUDE.md` oluşmuş.

- [ ] **Step 2: Test araçlarını kur**

```bash
npm install -D vitest@5.0.2 tsx
```

- [ ] **Step 3: `package.json`'a engines ve script'leri ekle**

`"scripts"` bloğunu şununla değiştir ve kök seviyeye `engines` ekle:
```json
  "engines": { "node": "24.x" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 4: Vitest yapılandırması ve setup dosyası**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 20_000,
  },
});
```

`src/test/setup.ts`:
```ts
import { AsyncLocalStorage } from 'node:async_hooks';

// next/server, Next çalışma zamanının kurduğu global AsyncLocalStorage'ı bekler; yoksa import anında hata verir.
const globals = globalThis as { AsyncLocalStorage?: typeof AsyncLocalStorage };
globals.AsyncLocalStorage ??= AsyncLocalStorage;
```

- [ ] **Step 5: Vendor UI kodunu lint dışına al**

`eslint.config.mjs` içindeki `globalIgnores([...])` listesinin sonuna ekle:
```js
    // shadcn ve Magic UI tarafından üretilen vendor kodu; elle düzenlenmez.
    "src/components/ui/**",
```

- [ ] **Step 6: `.gitignore`'a ekle**

```gitignore
# yerel PGlite verisi ve Playwright çıktıları
.data/
/test-results/
/playwright-report/
!.env.example
```

- [ ] **Step 7: Başarısız testi yaz**

`src/lib/date/istanbul.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatDateLongTr,
  formatDateShortTr,
  isDateKey,
  istanbulDateKey,
  istanbulDayStart,
  istanbulNoon,
} from './istanbul';

describe('istanbulDateKey', () => {
  it("UTC 22:30 İstanbul'da ertesi gündür", () => {
    expect(istanbulDateKey(new Date('2026-09-25T22:30:00Z'))).toBe('2026-09-26');
  });

  it("UTC 20:59 İstanbul'da hâlâ aynı gündür", () => {
    expect(istanbulDateKey(new Date('2026-09-25T20:59:00Z'))).toBe('2026-09-25');
  });
});

describe('isDateKey', () => {
  it.each([
    ['2026-09-26', true],
    ['2026-02-30', false],
    ['26.09.2026', false],
    ['2026-9-26', false],
    [20260926, false],
    [null, false],
  ])('%s → %s', (value, expected) => {
    expect(isDateKey(value)).toBe(expected);
  });
});

describe('addDays', () => {
  it('yıl ve ay sınırlarını aşar', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('İstanbul saatleri', () => {
  it('gün başlangıcı ve öğlen UTC+3 hesaplanır', () => {
    expect(istanbulDayStart('2026-09-26').toISOString()).toBe('2026-09-25T21:00:00.000Z');
    expect(istanbulNoon('2026-09-26').toISOString()).toBe('2026-09-26T09:00:00.000Z');
  });
});

describe('Türkçe tarih biçimleri', () => {
  it('uzun ve kısa biçim', () => {
    expect(formatDateLongTr('2026-09-26')).toBe('26 Eylül 2026 Cumartesi');
    expect(formatDateShortTr('2026-09-26')).toBe('26 Eylül');
  });
});
```

- [ ] **Step 8: Testin başarısız olduğunu gör**

Run: `npx vitest run src/lib/date/istanbul.test.ts`
Expected: FAIL — `Failed to resolve import "./istanbul"`.

- [ ] **Step 9: Uygulamayı yaz**

`src/lib/date/istanbul.ts`:
```ts
export type DateKey = string;

const TIME_ZONE = 'Europe/Istanbul';
const keyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const longFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const shortFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'long',
});

export function istanbulDateKey(instant: Date = new Date()): DateKey {
  return keyFormatter.format(instant);
}

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// TSİ 2016'dan beri sabit UTC+3 (yaz saati yok); sabit ofset bu yüzden güvenli.
export function istanbulDayStart(key: DateKey): Date {
  return new Date(`${key}T00:00:00+03:00`);
}

export function istanbulNoon(key: DateKey): Date {
  return new Date(`${key}T12:00:00+03:00`);
}

export function formatDateLongTr(key: DateKey): string {
  return longFormatter.format(istanbulNoon(key));
}

export function formatDateShortTr(key: DateKey): string {
  return shortFormatter.format(istanbulNoon(key));
}
```

- [ ] **Step 10: Testleri ve statik kontrolleri çalıştır**

Run: `npx vitest run src/lib/date/istanbul.test.ts && npm run lint && npm run typecheck`
Expected: 12 test PASS, lint ve typecheck hatasız.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: Next.js 16 iskeleti, Vitest ve İstanbul tarih yardımcıları" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Veritabanı katmanı (Drizzle şeması, istemci, test ve yerel PGlite sunucusu)

**Files:**
- Create: `src/db/schema.ts`, `src/db/types.ts`, `src/db/client.ts`, `drizzle.config.ts`, `src/test/db.ts`, `scripts/local-db.ts`, `.env.example`
- Generated: `src/db/migrations/0000_init.sql`, `src/db/migrations/meta/*`
- Modify: `package.json` (script'ler)
- Test: `src/db/schema.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
```ts
// src/db/schema.ts
export const settings;      // settings(id smallint pk = 1, data jsonb, updated_at timestamptz)
export const loginAttempts; // login_attempts(ip text pk, count int, window_start timestamptz)
// src/db/types.ts
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>; // node-postgres, PGlite ve transaction nesnesi (tx) bu tipe uyar
// src/db/client.ts
export function getDb(): Db;            // DATABASE_URL ile tekil pg Pool + attachDatabasePool
export async function closeDb(): Promise<void>;
// src/test/db.ts
export async function createTestDb(): Promise<Db>; // bellek içi PGlite + migration'lar
// scripts/local-db.ts
export async function startLocalDb(options: { port: number; dataDir: string }): Promise<{ url: string; stop(): Promise<void> }>;
```

- [ ] **Step 1: Bağımlılıkları kur**

```bash
npm install drizzle-orm@0.45.3 pg @vercel/functions
npm install -D drizzle-kit@0.31.11 @types/pg @electric-sql/pglite@0.5.8 @electric-sql/pglite-socket@0.2.11
```

- [ ] **Step 2: Başarısız testi yaz**

`src/db/schema.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { settings } from '@/db/schema';
import { createTestDb } from '@/test/db';

describe('veritabanı şeması', () => {
  it('ayarlar tablosu yalnızca id=1 satırını kabul eder', async () => {
    const db = await createTestDb();
    await db.insert(settings).values({ id: 1, data: {} });
    await expect(db.insert(settings).values({ id: 2, data: {} })).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Testin başarısız olduğunu gör**

Run: `npx vitest run src/db/schema.test.ts`
Expected: FAIL — `Failed to resolve import "@/db/schema"`.

- [ ] **Step 4: Şema, tip, istemci ve test yardımcısını yaz**

`src/db/schema.ts`:
```ts
import { sql } from 'drizzle-orm';
import { check, integer, jsonb, pgTable, smallint, text, timestamp } from 'drizzle-orm/pg-core';

export const settings = pgTable(
  'settings',
  {
    id: smallint('id').primaryKey().default(1),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('settings_singleton', sql`${t.id} = 1`)],
);

export const loginAttempts = pgTable('login_attempts', {
  ip: text('ip').primaryKey(),
  count: integer('count').notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
});
```

`src/db/types.ts`:
```ts
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
```

`src/db/client.ts`:
```ts
import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import type { Db } from './types';

let pool: Pool | undefined;
let db: Db | undefined;

export function getDb(): Db {
  if (db) return db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL tanımlı değil');
  pool = new Pool({ connectionString, max: 5 });
  attachDatabasePool(pool);
  db = drizzle({ client: pool, schema });
  return db;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  db = undefined;
}
```

`src/test/db.ts`:
```ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/db/schema';
import type { Db } from '@/db/types';

export async function createTestDb(): Promise<Db> {
  const db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder: 'src/db/migrations' });
  return db;
}
```

`drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '' },
});
```

- [ ] **Step 5: Migration üret**

Run: `npx drizzle-kit generate --name init`
Expected: `src/db/migrations/0000_init.sql` içinde `CREATE TABLE "settings"` (CHECK `"settings"."id" = 1` ile) ve `CREATE TABLE "login_attempts"`.

- [ ] **Step 6: Testin geçtiğini gör**

Run: `npx vitest run src/db/schema.test.ts`
Expected: PASS.

- [ ] **Step 7: Yerel PGlite sunucusu, `.env.example` ve script'ler**

`scripts/local-db.ts`:
```ts
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

export async function startLocalDb(options: { port: number; dataDir: string }) {
  const pglite = new PGlite(options.dataDir);
  await migrate(drizzle({ client: pglite }), { migrationsFolder: 'src/db/migrations' });
  const server = new PGLiteSocketServer({ db: pglite, port: options.port, host: '127.0.0.1', maxConnections: 10 });
  await server.start();
  return {
    url: `postgresql://postgres:postgres@127.0.0.1:${options.port}/postgres`,
    async stop() {
      await server.stop();
      await pglite.close();
    },
  };
}

async function main() {
  const local = await startLocalDb({
    port: Number(process.env.LOCAL_DB_PORT ?? 55432),
    dataDir: process.env.LOCAL_DB_DIR ?? '.data/pglite',
  });
  console.log(`Yerel veritabanı hazır: ${local.url}`);
  const shutdown = () => void local.stop().then(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.argv[1]?.endsWith('local-db.ts')) void main();
```

`.env.example`:
```dotenv
# Yerel geliştirme: `npm run db:local` ile açılan PGlite sunucusu
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/postgres
# En az 32 karakter: openssl rand -base64 48
SESSION_SECRET=
# `npm run hash-password` çıktısı
APP_PASSWORD_HASH=
# openssl rand -base64 32
CRON_SECRET=
```

`package.json` → `scripts` içine ekle:
```json
    "db:generate": "drizzle-kit generate",
    "db:local": "tsx scripts/local-db.ts",
    "db:migrate:prod": "node --env-file=.env.production.local ./node_modules/drizzle-kit/bin.cjs migrate",
```

- [ ] **Step 8: Yerel sunucuyu elle doğrula**

```bash
LOCAL_DB_PORT=55499 LOCAL_DB_DIR=memory:// npx tsx scripts/local-db.ts & LOCAL_DB_PID=$!
sleep 4
node -e "const {Pool}=require('pg');const p=new Pool({connectionString:'postgresql://postgres:postgres@127.0.0.1:55499/postgres'});p.query('select count(*)::int as n from settings').then(r=>{console.log('settings satırı:',r.rows[0].n);return p.end()})"
kill $LOCAL_DB_PID
```
Expected: `Yerel veritabanı hazır: postgresql://…:55499/postgres`, ardından `settings satırı: 0`.

- [ ] **Step 9: Tüm kontroller**

Run: `npm test && npm run lint && npm run typecheck`
Expected: tüm testler PASS.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json drizzle.config.ts .env.example src/db src/test/db.ts scripts/local-db.ts
git commit -m "feat: Drizzle şeması, Neon istemcisi ve yerel PGlite veritabanı" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Pastel tema, fontlar, UI temeli, robots ve noindex

**Files:**
- Run: `shadcn init`, `shadcn add` (UI bileşenleri `src/components/ui/`, `src/lib/utils.ts`, `components.json`)
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `next.config.ts`
- Create: `src/app/robots.ts`
- Test: `src/app/robots.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `src/components/ui/{button,card,input,label,switch,slider,radio-group,sonner,particles,shine-border,shimmer-button,dock,blur-fade}.tsx`. Tailwind renkleri: `lila`, `pudra`, `bebek-mavisi`, `adacayi`, `seftali`, `altin`, `erik`. Font yardımcıları: `font-heading` (Fraunces) ve `font-sans` (Nunito).

- [ ] **Step 1: Başarısız testi yaz**

`src/app/robots.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import robots from './robots';

describe('arama motoru engeli', () => {
  it('robots.txt her şeyi engeller', () => {
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });

  it('tüm yanıtlara noindex başlığı eklenir', async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toContainEqual({
      source: '/:path*',
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
    });
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `npx vitest run src/app/robots.test.ts`
Expected: FAIL — `./robots` bulunamaz.

- [ ] **Step 3: robots ve başlıkları yaz**

`src/app/robots.ts`:
```ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
```

`next.config.ts` (tamamını değiştir):
```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
};

export default nextConfig;
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `npx vitest run src/app/robots.test.ts`
Expected: 2 test PASS.

- [ ] **Step 5: shadcn ve Magic UI bileşenlerini kur**

```bash
npx -y shadcn@latest init -d -y
npx -y shadcn@latest add input label switch slider card radio-group sonner -y
V=~/.agents/skills/magic-ui/vendor/r
npx -y shadcn@latest add $V/particles.json $V/shine-border.json $V/shimmer-button.json $V/dock.json $V/blur-fade.json -y
```
Expected: `components.json` (style `base-nova`), `src/lib/utils.ts` ve yukarıdaki `src/components/ui/*.tsx` dosyaları. `globals.css` güncellenmiş olur.

- [ ] **Step 6: Pastel paleti ve fontları `globals.css`'e işle**

`src/app/globals.css` içinde `@theme inline { … }` bloğunda `--font-sans`, `--font-heading` ve `--font-mono` satırlarını sil. Yerlerine şunları koy:
```css
  --font-sans: var(--font-nunito);
  --font-heading: var(--font-fraunces);
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  --color-lila: var(--lila);
  --color-pudra: var(--pudra);
  --color-bebek-mavisi: var(--bebek-mavisi);
  --color-adacayi: var(--adacayi);
  --color-seftali: var(--seftali);
  --color-altin: var(--altin);
  --color-erik: var(--erik);
```
`:root { … }` bloğunda aşağıdaki değişkenleri bu değerlerle güncelle. Blokta olmayanları ekle, listede olmayan mevcut değişkenlere dokunma:
```css
  --radius: 1rem;
  --background: #fbf7f2;
  --foreground: #3d2c3e;
  --card: #ffffff;
  --card-foreground: #3d2c3e;
  --popover: #ffffff;
  --popover-foreground: #3d2c3e;
  --primary: #7a5aa6;
  --primary-foreground: #ffffff;
  --secondary: #f3e8f5;
  --secondary-foreground: #3d2c3e;
  --muted: #f4efea;
  --muted-foreground: #6e5e70;
  --accent: #fce3ec;
  --accent-foreground: #3d2c3e;
  --destructive: #c2475a;
  --border: #eadfe6;
  --input: #e3d6de;
  --ring: #b79bd9;
  --chart-1: #c8b6e2;
  --chart-2: #f4c2c2;
  --chart-3: #bfd7ed;
  --chart-4: #b7c9a8;
  --chart-5: #ffd1b3;
  --sidebar: #f7f1f5;
  --sidebar-foreground: #3d2c3e;
  --sidebar-primary: #7a5aa6;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #f3e8f5;
  --sidebar-accent-foreground: #3d2c3e;
  --sidebar-border: #eadfe6;
  --sidebar-ring: #b79bd9;
  --lila: #c8b6e2;
  --pudra: #f4c2c2;
  --bebek-mavisi: #bfd7ed;
  --adacayi: #b7c9a8;
  --seftali: #ffd1b3;
  --altin: #c9a96e;
  --erik: #3d2c3e;
```

- [ ] **Step 7: Kök layout**

`src/app/layout.tsx` (tamamını değiştir):
```tsx
import type { Metadata } from 'next';
import { Fraunces, Nunito } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin', 'latin-ext'], variable: '--font-fraunces', axes: ['SOFT', 'opsz'] });
const nunito = Nunito({ subsets: ['latin', 'latin-ext'], variable: '--font-nunito' });

export const metadata: Metadata = {
  title: { default: 'Burç Stüdyosu', template: '%s · Burç Stüdyosu' },
  description: 'Günlük burç ve tarot içerik stüdyosu',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${fraunces.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        {children}
        <Toaster theme="light" position="top-center" richColors />
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Derleme ve kontroller**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: testler PASS, build başarılı (`○ /robots.txt` listede).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: pastel tema, Fraunces/Nunito fontları, shadcn ve Magic UI temeli, noindex" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Ayarlar şeması ve deposu

**Files:**
- Create: `src/lib/settings/schema.ts`, `src/lib/settings/repository.ts`
- Test: `src/lib/settings/schema.test.ts`, `src/lib/settings/repository.test.ts`

**Interfaces:**
- Consumes: `Db` (`src/db/types.ts`), `settings` tablosu (`src/db/schema.ts`), `createTestDb` (`src/test/db.ts`)
- Produces:
```ts
// src/lib/settings/schema.ts
export const WATERMARK_POSITIONS: readonly ['bottom-center', 'bottom-right'];
export type WatermarkPosition = 'bottom-center' | 'bottom-right';
export const settingsSchema: z.ZodType<Settings>;
export type Settings = { instagramHandle: string | null; watermark: { enabled: boolean; position: WatermarkPosition; opacity: number } };
export type SettingsPatch = { instagramHandle?: string | null; watermark?: Partial<Settings['watermark']> };
export const DEFAULT_SETTINGS: Settings;
export const HANDLE_ERROR: string;
export function normalizeInstagramHandle(input: string): string;
export function parseInstagramHandleInput(input: string): { ok: true; value: string | null } | { ok: false; error: string };
export function mergeSettings(base: Settings, patch: SettingsPatch): Settings; // zod ile doğrular, geçersizse fırlatır
export function parseStoredSettings(raw: unknown): Settings;                  // varsayılanlarla birleştirir
// src/lib/settings/repository.ts
export async function getSettings(db: Db): Promise<Settings>;
export async function saveSettings(db: Db, patch: SettingsPatch): Promise<Settings>;
```

- [ ] **Step 1: Şema için başarısız testi yaz**

`src/lib/settings/schema.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  HANDLE_ERROR,
  mergeSettings,
  normalizeInstagramHandle,
  parseInstagramHandleInput,
  parseStoredSettings,
} from './schema';

describe('normalizeInstagramHandle', () => {
  it.each([
    ['@Foo.Bar ', 'foo.bar'],
    ['https://www.instagram.com/foo.bar/?hl=tr', 'foo.bar'],
    ['instagram.com/foo_bar', 'foo_bar'],
    ['  @@kisi  ', 'kisi'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeInstagramHandle(input)).toBe(expected);
  });
});

describe('parseInstagramHandleInput', () => {
  it('boş değer kullanıcı adını kaldırır', () => {
    expect(parseInstagramHandleInput('   ')).toEqual({ ok: true, value: null });
    expect(parseInstagramHandleInput('@')).toEqual({ ok: true, value: null });
  });

  it('geçerli adı normalize eder', () => {
    expect(parseInstagramHandleInput('@Burc.Studio')).toEqual({ ok: true, value: 'burc.studio' });
  });

  it.each(['foo bar', 'a'.repeat(31), 'Ayşe', 'foo-bar'])('%s reddedilir', (input) => {
    expect(parseInstagramHandleInput(input)).toEqual({ ok: false, error: HANDLE_ERROR });
  });
});

describe('ayar birleştirme', () => {
  it('kayıt yoksa varsayılanlar gelir', () => {
    expect(parseStoredSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({
      instagramHandle: null,
      watermark: { enabled: true, position: 'bottom-center', opacity: 0.55 },
    });
  });

  it('kısmi yama diğer alanları korur', () => {
    const next = mergeSettings(DEFAULT_SETTINGS, { watermark: { position: 'bottom-right' } });
    expect(next.watermark).toEqual({ enabled: true, position: 'bottom-right', opacity: 0.55 });
  });

  it('geçersiz opaklık reddedilir', () => {
    expect(() => mergeSettings(DEFAULT_SETTINGS, { watermark: { opacity: 1.5 } })).toThrow();
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `npx vitest run src/lib/settings/schema.test.ts`
Expected: FAIL — `./schema` bulunamaz.

- [ ] **Step 3: Şemayı yaz**

```bash
npm install zod@4.6.5
```

`src/lib/settings/schema.ts`:
```ts
import { z } from 'zod';

export const WATERMARK_POSITIONS = ['bottom-center', 'bottom-right'] as const;
export type WatermarkPosition = (typeof WATERMARK_POSITIONS)[number];

const HANDLE_PATTERN = /^[a-z0-9._]{1,30}$/;
export const HANDLE_ERROR = 'Kullanıcı adı yalnızca harf, rakam, nokta ve alt çizgi içerebilir (en fazla 30 karakter).';

export const settingsSchema = z.object({
  instagramHandle: z.string().regex(HANDLE_PATTERN, HANDLE_ERROR).nullable(),
  watermark: z.object({
    enabled: z.boolean(),
    position: z.enum(WATERMARK_POSITIONS),
    opacity: z.number().min(0.2).max(1),
  }),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingsPatch = {
  instagramHandle?: string | null;
  watermark?: Partial<Settings['watermark']>;
};

export const DEFAULT_SETTINGS: Settings = {
  instagramHandle: null,
  watermark: { enabled: true, position: 'bottom-center', opacity: 0.55 },
};

export function normalizeInstagramHandle(input: string): string {
  let value = input.trim();
  const fromUrl = value.match(/instagram\.com\/([^/?#\s]+)/i);
  if (fromUrl) value = fromUrl[1];
  return value.replace(/^@+/, '').toLowerCase();
}

export function parseInstagramHandleInput(
  input: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = normalizeInstagramHandle(input);
  if (value === '') return { ok: true, value: null };
  return HANDLE_PATTERN.test(value) ? { ok: true, value } : { ok: false, error: HANDLE_ERROR };
}

export function mergeSettings(base: Settings, patch: SettingsPatch): Settings {
  return settingsSchema.parse({
    ...base,
    ...patch,
    watermark: { ...base.watermark, ...patch.watermark },
  });
}

export function parseStoredSettings(raw: unknown): Settings {
  const stored = (typeof raw === 'object' && raw !== null ? raw : {}) as SettingsPatch;
  return mergeSettings(DEFAULT_SETTINGS, stored);
}
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `npx vitest run src/lib/settings/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Depo için başarısız testi yaz**

`src/lib/settings/repository.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { getSettings, saveSettings } from './repository';
import { DEFAULT_SETTINGS } from './schema';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('ayar deposu', () => {
  it('kayıt yokken varsayılanları döner', async () => {
    expect(await getSettings(db)).toEqual(DEFAULT_SETTINGS);
  });

  it('kaydedilen ayarlar geri okunur ve kısmi yamalar birikir', async () => {
    await saveSettings(db, { instagramHandle: 'burc.studio' });
    await saveSettings(db, { watermark: { opacity: 0.8 } });
    expect(await getSettings(db)).toEqual({
      instagramHandle: 'burc.studio',
      watermark: { enabled: true, position: 'bottom-center', opacity: 0.8 },
    });
  });

  it('geçersiz yama hiçbir şey kaydetmez', async () => {
    await expect(saveSettings(db, { instagramHandle: 'foo bar' })).rejects.toThrow();
    expect(await getSettings(db)).toEqual(DEFAULT_SETTINGS);
  });
});
```

- [ ] **Step 6: Testin başarısız olduğunu gör**

Run: `npx vitest run src/lib/settings/repository.test.ts`
Expected: FAIL — `./repository` bulunamaz.

- [ ] **Step 7: Depoyu yaz**

`src/lib/settings/repository.ts`:
```ts
import { eq } from 'drizzle-orm';
import { settings } from '@/db/schema';
import type { Db } from '@/db/types';
import { mergeSettings, parseStoredSettings, type Settings, type SettingsPatch } from './schema';

export async function getSettings(db: Db): Promise<Settings> {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  return parseStoredSettings(row?.data);
}

export async function saveSettings(db: Db, patch: SettingsPatch): Promise<Settings> {
  const next = mergeSettings(await getSettings(db), patch);
  const now = new Date();
  await db
    .insert(settings)
    .values({ id: 1, data: next, updatedAt: now })
    .onConflictDoUpdate({ target: settings.id, set: { data: next, updatedAt: now } });
  return next;
}
```

- [ ] **Step 8: Testlerin geçtiğini gör**

Run: `npx vitest run src/lib/settings && npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/lib/settings
git commit -m "feat: ayar şeması (Instagram kullanıcı adı, filigran) ve deposu" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Şifre özeti, oturum belirteci ve güvenli yönlendirme

**Files:**
- Create: `src/lib/auth/password.ts`, `src/lib/auth/session.ts`, `src/lib/auth/redirect.ts`, `scripts/hash-password.ts`
- Modify: `package.json` (`hash-password` script'i)
- Test: `src/lib/auth/password.test.ts`, `src/lib/auth/session.test.ts`, `src/lib/auth/redirect.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
```ts
// src/lib/auth/password.ts
export async function hashPassword(password: string): Promise<string>; // 'scrypt:16384:8:1:<salt>:<key>'
export async function verifyPassword(password: string, stored: string): Promise<boolean>;
// src/lib/auth/session.ts
export const SESSION_COOKIE = 'bs_session';
export const SESSION_MAX_AGE_SECONDS: number; // 2_592_000
export async function createSessionToken(): Promise<string>;          // SESSION_SECRET yoksa fırlatır
export async function verifySessionToken(token: string | undefined): Promise<boolean>; // fail closed
export function sessionCookieOptions(): { httpOnly: true; secure: boolean; sameSite: 'lax'; path: '/'; maxAge: number };
// src/lib/auth/redirect.ts
export function safeNextPath(next: string | null | undefined): string;
```

- [ ] **Step 1: Başarısız testleri yaz**

`src/lib/auth/password.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('şifre özeti', () => {
  it('doğru şifre doğrulanır, yanlışı reddedilir', async () => {
    const hash = await hashPassword('dogru-sifre-1234');
    expect(hash).toMatch(/^scrypt:16384:8:1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(await verifyPassword('dogru-sifre-1234', hash)).toBe(true);
    expect(await verifyPassword('yanlis-sifre-1234', hash)).toBe(false);
  });

  it('aynı şifrenin iki özeti tuz nedeniyle farklıdır', async () => {
    expect(await hashPassword('dogru-sifre-1234')).not.toBe(await hashPassword('dogru-sifre-1234'));
  });

  it("özet '$' içermez (.env genişletmesi bozmasın)", async () => {
    expect(await hashPassword('dogru-sifre-1234')).not.toContain('$');
  });

  it('Türkçe karakterler farklı Unicode biçiminde yazılsa da doğrulanır', async () => {
    const hash = await hashPassword('Güneş-Ay-Yıldız-2026');
    expect(await verifyPassword('Güneş-Ay-Yıldız-2026'.normalize('NFD'), hash)).toBe(true);
  });

  it('bozuk özet false döner', async () => {
    expect(await verifyPassword('x', 'bozuk')).toBe(false);
    expect(await verifyPassword('x', 'scrypt:1:2:3:abc')).toBe(false);
  });

  it('12 karakterden kısa şifre reddedilir', async () => {
    await expect(hashPassword('kisa')).rejects.toThrow('12');
  });
});
```

`src/lib/auth/session.test.ts`:
```ts
import { SignJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions, verifySessionToken } from './session';

const SECRET = 'oturum-test-anahtari-'.padEnd(40, 'x');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('oturum belirteci', () => {
  it('oluşturulan belirteç doğrulanır', async () => {
    vi.stubEnv('SESSION_SECRET', SECRET);
    expect(await verifySessionToken(await createSessionToken())).toBe(true);
  });

  it('boş veya değiştirilmiş belirteç reddedilir', async () => {
    vi.stubEnv('SESSION_SECRET', SECRET);
    const token = await createSessionToken();
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken(`${token.slice(0, -2)}aa`)).toBe(false);
  });

  it('süresi dolmuş belirteç reddedilir', async () => {
    vi.stubEnv('SESSION_SECRET', SECRET);
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('owner')
      .setIssuedAt(1_700_000_000)
      .setExpirationTime(1_700_000_060)
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySessionToken(expired)).toBe(false);
  });

  it('SESSION_SECRET kısa ya da yoksa her oturum reddedilir (fail closed)', async () => {
    vi.stubEnv('SESSION_SECRET', SECRET);
    const token = await createSessionToken();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('SESSION_SECRET', 'kisa');
    expect(await verifySessionToken(token)).toBe(false);
    vi.stubEnv('SESSION_SECRET', '');
    expect(await verifySessionToken(token)).toBe(false);
    expect(logged).toHaveBeenCalled();
    await expect(createSessionToken()).rejects.toThrow('SESSION_SECRET');
  });

  it("çerez production'da secure, geliştirmede değil", () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(sessionCookieOptions()).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 2_592_000 });
    vi.stubEnv('NODE_ENV', 'development');
    expect(sessionCookieOptions().secure).toBe(false);
    expect(SESSION_COOKIE).toBe('bs_session');
  });
});
```

`src/lib/auth/redirect.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { safeNextPath } from './redirect';

describe('safeNextPath', () => {
  it.each([
    ['/ayarlar', '/ayarlar'],
    ['/burclar?kitle=erkek', '/burclar?kitle=erkek'],
    ['https://evil.com', '/'],
    ['//evil.com/x', '/'],
    ['/\\evil.com', '/'],
    ['javascript:alert(1)', '/'],
    ['/giris', '/'],
    ['', '/'],
    [null, '/'],
    [undefined, '/'],
  ])('%s → %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
```

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `npx vitest run src/lib/auth`
Expected: FAIL — `./password`, `./session`, `./redirect` bulunamaz.

- [ ] **Step 3: Uygulamaları yaz**

```bash
npm install jose@6.2.12
```

`src/lib/auth/password.ts`:
```ts
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const KEY_LENGTH = 64;
const COST = { N: 16384, r: 8, p: 1 };
const MAX_MEMORY = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, cost: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password.normalize('NFKC'), salt, KEY_LENGTH, { ...cost, maxmem: MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

// Ayraç ':' — '$' kullanılırsa Next'in .env genişletmesi özeti bozar.
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) throw new Error('Şifre en az 12 karakter olmalı');
  const salt = randomBytes(16);
  const key = await derive(password, salt, COST);
  return ['scrypt', COST.N, COST.r, COST.p, salt.toString('base64'), key.toString('base64')].join(':');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, key] = parts;
  const expected = Buffer.from(key, 'base64');
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await derive(password, Buffer.from(salt, 'base64'), { N: Number(n), r: Number(r), p: Number(p) });
  return timingSafeEqual(actual, expected);
}
```

`src/lib/auth/session.ts`:
```ts
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'bs_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SUBJECT = 'owner';

function sessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET tanımlı değil ya da 32 karakterden kısa');
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(SUBJECT)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(sessionKey());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  let key: Uint8Array;
  try {
    key = sessionKey();
  } catch (error) {
    console.error(error);
    return false;
  }
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    return payload.sub === SUBJECT;
  } catch {
    return false;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/' as const,
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
```

`src/lib/auth/redirect.ts`:
```ts
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  const url = new URL(next, 'http://yerel.invalid');
  if (url.origin !== 'http://yerel.invalid' || url.pathname.startsWith('/giris')) return '/';
  return `${url.pathname}${url.search}${url.hash}`;
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npx vitest run src/lib/auth`
Expected: tüm testler PASS.

- [ ] **Step 5: Şifre özeti script'i**

`scripts/hash-password.ts`:
```ts
import { createInterface } from 'node:readline/promises';
import { hashPassword } from '../src/lib/auth/password';

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const password = await rl.question('Giriş şifresi (en az 12 karakter): ');
  rl.close();
  console.log(await hashPassword(password));
}

void main();
```

`package.json` → `scripts` içine ekle:
```json
    "hash-password": "tsx scripts/hash-password.ts",
```

Run: `printf 'deneme-sifre-12345\n' | npm run -s hash-password`
Expected: `scrypt:16384:8:1:…:…` biçiminde tek satır.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/auth scripts/hash-password.ts
git commit -m "feat: scrypt şifre özeti, JWT oturum belirteci ve güvenli yönlendirme" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: İstemci IP'si ve giriş deneme sınırı

**Files:**
- Create: `src/lib/auth/client-ip.ts`, `src/lib/auth/rate-limit.ts`
- Test: `src/lib/auth/client-ip.test.ts`, `src/lib/auth/rate-limit.test.ts`

**Interfaces:**
- Consumes: `Db`, `loginAttempts`, `createTestDb`
- Produces:
```ts
// src/lib/auth/client-ip.ts
export function getClientIp(headers: Headers): string; // XFF'nin ilk adresi → x-real-ip → 'unknown'
// src/lib/auth/rate-limit.ts
export const MAX_FAILED_ATTEMPTS = 5;
export const WINDOW_MS: number; // 15 dk
export type LoginAllowance = { allowed: true } | { allowed: false; retryAfterSeconds: number };
export async function checkLoginAllowed(db: Db, ip: string, now?: Date): Promise<LoginAllowance>;
export async function recordFailedLogin(db: Db, ip: string, now?: Date): Promise<void>;
export async function clearLoginAttempts(db: Db, ip: string): Promise<void>;
```

- [ ] **Step 1: Başarısız testleri yaz**

`src/lib/auth/client-ip.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { getClientIp } from './client-ip';

describe('getClientIp', () => {
  it("x-forwarded-for listesinin ilk adresini alır", () => {
    expect(getClientIp(new Headers({ 'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1' }))).toBe('203.0.113.7');
  });

  it("x-real-ip başlığına düşer", () => {
    expect(getClientIp(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
  });

  it('başlık yoksa unknown döner', () => {
    expect(getClientIp(new Headers())).toBe('unknown');
    expect(getClientIp(new Headers({ 'x-forwarded-for': ' , ' }))).toBe('unknown');
  });
});
```

`src/lib/auth/rate-limit.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { checkLoginAllowed, clearLoginAttempts, recordFailedLogin } from './rate-limit';

const T0 = new Date('2026-09-26T10:00:00Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe('giriş deneme sınırı', () => {
  it('4 hataya kadar izin verir, 5. hatadan sonra kalan süreyle kilitler', async () => {
    for (let i = 0; i < 4; i++) await recordFailedLogin(db, '1.1.1.1', at(i));
    expect(await checkLoginAllowed(db, '1.1.1.1', at(4))).toEqual({ allowed: true });
    await recordFailedLogin(db, '1.1.1.1', at(4));
    expect(await checkLoginAllowed(db, '1.1.1.1', at(5))).toEqual({ allowed: false, retryAfterSeconds: 600 });
  });

  it('pencere dolunca kilit kalkar ve sayaç yeni pencerede sıfırdan başlar', async () => {
    for (let i = 0; i < 5; i++) await recordFailedLogin(db, '1.1.1.1', at(0));
    expect(await checkLoginAllowed(db, '1.1.1.1', at(15))).toEqual({ allowed: true });
    for (let i = 0; i < 4; i++) await recordFailedLogin(db, '1.1.1.1', at(16));
    expect(await checkLoginAllowed(db, '1.1.1.1', at(17))).toEqual({ allowed: true });
  });

  it('başarılı giriş sayacı temizler', async () => {
    for (let i = 0; i < 5; i++) await recordFailedLogin(db, '1.1.1.1', at(0));
    await clearLoginAttempts(db, '1.1.1.1');
    expect(await checkLoginAllowed(db, '1.1.1.1', at(1))).toEqual({ allowed: true });
  });

  it('farklı IP adresleri birbirini etkilemez', async () => {
    for (let i = 0; i < 5; i++) await recordFailedLogin(db, '1.1.1.1', at(0));
    expect(await checkLoginAllowed(db, '2.2.2.2', at(1))).toEqual({ allowed: true });
  });
});
```

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `npx vitest run src/lib/auth/client-ip.test.ts src/lib/auth/rate-limit.test.ts`
Expected: FAIL — modüller bulunamaz.

- [ ] **Step 3: Uygulamaları yaz**

`src/lib/auth/client-ip.ts`:
```ts
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get('x-real-ip')?.trim() || 'unknown';
}
```

`src/lib/auth/rate-limit.ts`:
```ts
import { eq, sql } from 'drizzle-orm';
import { loginAttempts } from '@/db/schema';
import type { Db } from '@/db/types';

export const MAX_FAILED_ATTEMPTS = 5;
export const WINDOW_MS = 15 * 60 * 1000;

export type LoginAllowance = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export async function checkLoginAllowed(db: Db, ip: string, now: Date = new Date()): Promise<LoginAllowance> {
  const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.ip, ip));
  if (!row) return { allowed: true };
  const elapsed = now.getTime() - row.windowStart.getTime();
  if (elapsed >= WINDOW_MS || row.count < MAX_FAILED_ATTEMPTS) return { allowed: true };
  return { allowed: false, retryAfterSeconds: Math.ceil((WINDOW_MS - elapsed) / 1000) };
}

export async function recordFailedLogin(db: Db, ip: string, now: Date = new Date()): Promise<void> {
  const windowExpired = sql`${loginAttempts.windowStart} <= ${new Date(now.getTime() - WINDOW_MS).toISOString()}::timestamptz`;
  await db
    .insert(loginAttempts)
    .values({ ip, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: loginAttempts.ip,
      set: {
        count: sql`case when ${windowExpired} then 1 else ${loginAttempts.count} + 1 end`,
        windowStart: sql`case when ${windowExpired} then ${now.toISOString()}::timestamptz else ${loginAttempts.windowStart} end`,
      },
    });
}

export async function clearLoginAttempts(db: Db, ip: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.ip, ip));
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npx vitest run src/lib/auth && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/client-ip.ts src/lib/auth/client-ip.test.ts src/lib/auth/rate-limit.ts src/lib/auth/rate-limit.test.ts
git commit -m "feat: IP başına giriş deneme sınırı" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Giriş ve çıkış API'leri

**Files:**
- Create: `src/lib/auth/login-handler.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`
- Test: `src/lib/auth/login-handler.test.ts`, `src/app/api/auth/logout/route.test.ts`

**Interfaces:**
- Consumes: `checkLoginAllowed`, `recordFailedLogin`, `clearLoginAttempts` (Task 6); `getClientIp` (Task 6); `verifyPassword`, `hashPassword` (Task 5); `createSessionToken`, `sessionCookieOptions`, `SESSION_COOKIE` (Task 5); `getDb` (Task 2)
- Produces:
```ts
// src/lib/auth/login-handler.ts
export type LoginDeps = { db: Db; passwordHash: string | undefined; now?: Date };
export async function handleLogin(request: Request, deps: LoginDeps): Promise<NextResponse>;
// POST /api/auth/login   body {password: string} → 200 {ok:true} + çerez | 400 | 401 | 429 | 503
// POST /api/auth/logout  → 303 /giris + çerez silme
```

- [ ] **Step 1: Başarısız testleri yaz**

`src/lib/auth/login-handler.test.ts`:
```ts
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loginAttempts } from '@/db/schema';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test/db';
import { handleLogin } from './login-handler';
import { hashPassword } from './password';
import { recordFailedLogin } from './rate-limit';

const T0 = new Date('2026-09-26T10:00:00Z');
let db: Db;
let hash: string;

beforeAll(async () => {
  hash = await hashPassword('dogru-sifre-1234');
});
beforeEach(async () => {
  db = await createTestDb();
  vi.stubEnv('SESSION_SECRET', 'giris-test-anahtari-'.padEnd(40, 'x'));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function loginRequest(body: unknown, ip = '203.0.113.7') {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('handleLogin', () => {
  it('doğru şifre oturum çerezi verir ve deneme sayacını temizler', async () => {
    await recordFailedLogin(db, '203.0.113.7', T0);
    const res = await handleLogin(loginRequest({ password: 'dogru-sifre-1234' }), { db, passwordHash: hash, now: T0 });
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^bs_session=[^;]+; Path=\//);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=lax');
    expect(await db.select().from(loginAttempts)).toHaveLength(0);
  });

  it('yanlış şifre 401 döner ve denemeyi kaydeder', async () => {
    const res = await handleLogin(loginRequest({ password: 'yanlis-sifre-00' }), { db, passwordHash: hash, now: T0 });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Şifre hatalı.' });
    expect(await db.select().from(loginAttempts)).toEqual([{ ip: '203.0.113.7', count: 1, windowStart: T0 }]);
  });

  it('5 hatadan sonra doğru şifre bile 429 alır', async () => {
    for (let i = 0; i < 5; i++) {
      await handleLogin(loginRequest({ password: 'yanlis-sifre-00' }), { db, passwordHash: hash, now: T0 });
    }
    const res = await handleLogin(loginRequest({ password: 'dogru-sifre-1234' }), { db, passwordHash: hash, now: T0 });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('900');
    expect(await res.json()).toEqual({ error: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar dene.' });
  });

  it('APP_PASSWORD_HASH yoksa 503 döner ve kimseyi içeri almaz', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handleLogin(loginRequest({ password: 'dogru-sifre-1234' }), { db, passwordHash: undefined, now: T0 });
    expect(res.status).toBe(503);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('bozuk gövde 400 döner', async () => {
    const res = await handleLogin(loginRequest('{bozuk'), { db, passwordHash: hash, now: T0 });
    expect(res.status).toBe(400);
  });
});
```

`src/app/api/auth/logout/route.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('POST /api/auth/logout', () => {
  it('çerezi silip giriş sayfasına 303 ile yönlendirir', async () => {
    const res = POST(new Request('http://localhost/api/auth/logout', { method: 'POST' }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('http://localhost/giris');
    expect(res.headers.get('set-cookie')).toMatch(/^bs_session=; Path=\/; Expires=Thu, 01 Jan 1970/);
  });
});
```

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `npx vitest run src/lib/auth/login-handler.test.ts src/app/api/auth`
Expected: FAIL — modüller bulunamaz.

- [ ] **Step 3: Uygulamaları yaz**

`src/lib/auth/login-handler.ts`:
```ts
import { NextResponse } from 'next/server';
import type { Db } from '@/db/types';
import { getClientIp } from './client-ip';
import { verifyPassword } from './password';
import { checkLoginAllowed, clearLoginAttempts, recordFailedLogin } from './rate-limit';
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from './session';

export type LoginDeps = { db: Db; passwordHash: string | undefined; now?: Date };

export async function handleLogin(request: Request, deps: LoginDeps): Promise<NextResponse> {
  const now = deps.now ?? new Date();
  const ip = getClientIp(request.headers);

  const allowance = await checkLoginAllowed(deps.db, ip, now);
  if (!allowance.allowed) {
    const minutes = Math.ceil(allowance.retryAfterSeconds / 60);
    return NextResponse.json(
      { error: `Çok fazla hatalı deneme. ${minutes} dakika sonra tekrar dene.` },
      { status: 429, headers: { 'Retry-After': String(allowance.retryAfterSeconds) } },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const password =
    typeof body === 'object' && body !== null && 'password' in body && typeof body.password === 'string'
      ? body.password
      : null;
  if (password === null) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  if (!deps.passwordHash) {
    console.error('APP_PASSWORD_HASH tanımlı değil; giriş kapalı');
    return NextResponse.json({ error: 'Sunucu yapılandırması eksik.' }, { status: 503 });
  }

  if (!(await verifyPassword(password, deps.passwordHash))) {
    await recordFailedLogin(deps.db, ip, now);
    return NextResponse.json({ error: 'Şifre hatalı.' }, { status: 401 });
  }

  await clearLoginAttempts(deps.db, ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions());
  return response;
}
```

`src/app/api/auth/login/route.ts`:
```ts
import { getDb } from '@/db/client';
import { handleLogin } from '@/lib/auth/login-handler';

export async function POST(request: Request) {
  return handleLogin(request, { db: getDb(), passwordHash: process.env.APP_PASSWORD_HASH });
}
```

`src/app/api/auth/logout/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/session';

export function POST(request: Request) {
  const response = NextResponse.redirect(new URL('/giris', request.url), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npx vitest run src/lib/auth src/app/api/auth && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/login-handler.ts src/lib/auth/login-handler.test.ts src/app/api/auth
git commit -m "feat: giriş ve çıkış API'leri" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Proxy ile erişim koruması

**Files:**
- Create: `src/lib/auth/public-paths.ts`, `src/proxy.ts`
- Test: `src/proxy.test.ts`

**Interfaces:**
- Consumes: `SESSION_COOKIE`, `verifySessionToken`, `createSessionToken` (Task 5)
- Produces:
```ts
// src/lib/auth/public-paths.ts
export function isPublicPath(pathname: string): boolean;
// src/proxy.ts
export async function proxy(request: NextRequest): Promise<NextResponse>;
export const config: { matcher: string[] };
```

- [ ] **Step 1: Başarısız testi yaz**

`src/proxy.test.ts`:
```ts
import { NextRequest } from 'next/server';
import { getRedirectUrl, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionToken } from '@/lib/auth/session';
import { config, proxy } from './proxy';

beforeEach(() => vi.stubEnv('SESSION_SECRET', 'proxy-test-anahtari-'.padEnd(40, 'x')));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function request(path: string, token?: string) {
  return new NextRequest(`http://localhost${path}`, token ? { headers: { cookie: `bs_session=${token}` } } : undefined);
}

describe('proxy matcher', () => {
  it.each([
    ['/_next/static/chunks/app.js', false],
    ['/_next/image', false],
    ['/robots.txt', false],
    ['/favicon.ico', false],
    ['/', true],
    ['/ayarlar', true],
    ['/api/cron/daily', true],
  ])('%s → %s', (url, expected) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(expected);
  });
});

describe('proxy', () => {
  it('girişsiz sayfa isteğini next parametresiyle giriş sayfasına yönlendirir', async () => {
    expect(getRedirectUrl(await proxy(request('/ayarlar?sekme=1')))).toBe(
      'http://localhost/giris?next=%2Fayarlar%3Fsekme%3D1',
    );
  });

  it('kök sayfada next parametresi eklemez', async () => {
    expect(getRedirectUrl(await proxy(request('/')))).toBe('http://localhost/giris');
  });

  it('girişsiz API isteğine 401 JSON döner', async () => {
    const res = await proxy(request('/api/generate'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Oturum gerekli.' });
  });

  it.each(['/giris', '/api/auth/login', '/api/cron/daily'])('%s herkese açıktır', async (path) => {
    expect((await proxy(request(path))).headers.get('x-middleware-next')).toBe('1');
  });

  it('geçerli oturumla geçer, bozuk oturum yönlendirilir', async () => {
    const token = await createSessionToken();
    expect((await proxy(request('/ayarlar', token))).headers.get('x-middleware-next')).toBe('1');
    expect(getRedirectUrl(await proxy(request('/ayarlar', 'bozuk')))).toBe('http://localhost/giris?next=%2Fayarlar');
  });

  it('SESSION_SECRET kaybolursa mevcut oturum da reddedilir', async () => {
    const token = await createSessionToken();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('SESSION_SECRET', '');
    expect(getRedirectUrl(await proxy(request('/ayarlar', token)))).toBe('http://localhost/giris?next=%2Fayarlar');
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `npx vitest run src/proxy.test.ts`
Expected: FAIL — `./proxy` bulunamaz.

- [ ] **Step 3: Uygulamayı yaz**

`src/lib/auth/public-paths.ts`:
```ts
const PUBLIC_EXACT = new Set(['/giris']);
const PUBLIC_PREFIXES = ['/api/auth/', '/api/cron/'];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
```

`src/proxy.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server';
import { isPublicPath } from '@/lib/auth/public-paths';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();
  if (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
  const loginUrl = new URL('/giris', request.url);
  if (pathname !== '/') loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npx vitest run src/proxy.test.ts && npm run typecheck && npm run build`
Expected: PASS. Build çıktısında `ƒ Proxy (Middleware)` benzeri bir satır görünür.

- [ ] **Step 5: Commit**

```bash
git add src/proxy.ts src/proxy.test.ts src/lib/auth/public-paths.ts
git commit -m "feat: proxy ile girişsiz erişimi engelle" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: E2E altyapısı, giriş sayfası, uygulama kabuğu ve Bugün sayfası

**Files:**
- Create: `playwright.config.ts`, `e2e/constants.ts`, `e2e/test-server.ts`, `e2e/helpers.ts`, `e2e/auth.spec.ts`
- Create: `src/app/(auth)/giris/page.tsx`, `src/app/(auth)/giris/login-form.tsx`
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`, `src/components/app-shell/nav-items.ts`, `src/components/app-shell/app-nav.tsx`
- Delete: `src/app/page.tsx`
- Modify: `package.json` (`test:e2e`)

**Interfaces:**
- Consumes: `startLocalDb` (Task 2), `hashPassword` (Task 5), `safeNextPath` (Task 5), `formatDateLongTr`, `istanbulDateKey` (Task 1), `/api/auth/login` ve `/api/auth/logout` (Task 7)
- Produces:
```ts
// e2e/constants.ts
export const E2E_PORT = 3100;
export const E2E_PASSWORD = 'e2e-sifre-12345';
export const E2E_CRON_SECRET = 'e2e-cron-anahtari';
// e2e/helpers.ts
export async function login(page: Page, path?: string): Promise<void>;
// src/components/app-shell/nav-items.ts
export const NAV_ITEMS: readonly { href: string; label: string; icon: LucideIcon }[]; // Faz 1 buraya 'Burçlar' ekler
```

- [ ] **Step 1: Playwright'ı kur**

```bash
npm install -D @playwright/test
npx playwright install chromium
```
`package.json` → `scripts` içine ekle:
```json
    "test:e2e": "playwright test",
```

- [ ] **Step 2: E2E sunucusu ve yapılandırma**

`e2e/constants.ts`:
```ts
export const E2E_PORT = 3100;
export const E2E_PASSWORD = 'e2e-sifre-12345';
export const E2E_CRON_SECRET = 'e2e-cron-anahtari';
```

`e2e/test-server.ts`:
```ts
import { spawn } from 'node:child_process';
import { startLocalDb } from '../scripts/local-db';
import { hashPassword } from '../src/lib/auth/password';
import { E2E_CRON_SECRET, E2E_PASSWORD, E2E_PORT } from './constants';

async function main() {
  const db = await startLocalDb({ port: 55433, dataDir: 'memory://' });
  const env = {
    ...process.env,
    DATABASE_URL: db.url,
    SESSION_SECRET: 'e2e-oturum-anahtari-'.padEnd(48, 'x'),
    APP_PASSWORD_HASH: await hashPassword(E2E_PASSWORD),
    CRON_SECRET: E2E_CRON_SECRET,
  };
  const next = spawn('npx', ['next', 'dev', '--port', String(E2E_PORT)], { env, stdio: 'inherit' });
  const stop = () => {
    next.kill('SIGTERM');
    void db.stop().then(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  next.on('exit', (code) => void db.stop().then(() => process.exit(code ?? 0)));
}

void main();
```

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';
import { E2E_PORT } from './e2e/constants';

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  timeout: 60_000,
  use: { baseURL: `http://localhost:${E2E_PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx tsx e2e/test-server.ts',
    url: `http://localhost:${E2E_PORT}/giris`,
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
```

`e2e/helpers.ts`:
```ts
import { expect, type Page } from '@playwright/test';
import { E2E_PASSWORD } from './constants';

export async function login(page: Page, path = '/') {
  await page.goto(path);
  await page.getByLabel('Şifre').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).not.toHaveURL(/\/giris/);
}
```

- [ ] **Step 3: Başarısız E2E testini yaz**

`e2e/auth.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { E2E_PASSWORD } from './constants';
import { login } from './helpers';

test('girişsiz ziyaretçi giriş sayfasına yönlenir, doğru şifreyle hedef sayfaya döner', async ({ page }) => {
  await page.goto('/ayarlar');
  await expect(page).toHaveURL(/\/giris\?next=%2Fayarlar$/);
  await page.getByLabel('Şifre').fill('yanlis-sifre-00');
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page.getByRole('alert')).toHaveText('Şifre hatalı.');
  await page.getByLabel('Şifre').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/ayarlar$/);
});

test('Bugün sayfası tarihi Türkçe gösterir', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Bugün' })).toBeVisible();
  await expect(page.getByText(/\d{1,2} (Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık) \d{4}/)).toBeVisible();
});

test('çıkış yapınca oturum kapanır', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Çıkış yap' }).click();
  await expect(page).toHaveURL(/\/giris$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/giris$/);
});

test('robots.txt ve noindex başlığı', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(await response.text()).toContain('Disallow: /');
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
});

test.describe('mobil', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('alt menüden Ayarlar sayfasına gidilir', async ({ page }) => {
    await login(page);
    await page.getByRole('navigation', { name: 'Alt menü' }).getByRole('link', { name: 'Ayarlar' }).click();
    await expect(page).toHaveURL(/\/ayarlar$/);
  });
});
```

- [ ] **Step 4: Testin başarısız olduğunu gör**

Run: `npm run test:e2e -- e2e/auth.spec.ts`
Expected: FAIL. `/giris` sayfası 404 döner, `Şifre` etiketi bulunmaz.

- [ ] **Step 5: create-next-app'in örnek ana sayfasını sil (yerine `(app)/page.tsx` gelecek)**

```bash
git rm src/app/page.tsx
```

- [ ] **Step 6: Giriş sayfası**

`src/app/(auth)/giris/login-form.tsx`:
```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShimmerButton } from '@/components/ui/shimmer-button';

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    setError(null);
    startTransition(async () => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? 'Giriş yapılamadı.');
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Şifre</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ShimmerButton type="submit" disabled={pending} background="#7a5aa6" className="w-full">
        Giriş yap
      </ShimmerButton>
    </form>
  );
}
```

`src/app/(auth)/giris/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Particles } from '@/components/ui/particles';
import { ShineBorder } from '@/components/ui/shine-border';
import { safeNextPath } from '@/lib/auth/redirect';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Giriş' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <Particles className="absolute inset-0" quantity={90} ease={80} color="#b79bd9" />
      <Card className="relative w-full max-w-sm overflow-hidden">
        <ShineBorder shineColor={['#c8b6e2', '#f4c2c2', '#bfd7ed']} />
        <CardHeader>
          <CardTitle className="font-heading text-3xl">Burç Stüdyosu</CardTitle>
          <CardDescription>Devam etmek için şifreni gir.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={safeNextPath(typeof next === 'string' ? next : null)} />
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 7: Uygulama kabuğu ve Bugün sayfası**

`src/components/app-shell/nav-items.ts`:
```ts
import { Settings, Sun, type LucideIcon } from 'lucide-react';

export const NAV_ITEMS: readonly { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Bugün', icon: Sun },
  { href: '/ayarlar', label: 'Ayarlar', icon: Settings },
];
```

`src/components/app-shell/app-nav.tsx`:
```tsx
'use client';

import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dock, DockIcon } from '@/components/ui/dock';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden border-r border-sidebar-border bg-sidebar p-6 md:flex md:min-h-dvh md:flex-col md:gap-8">
      <Link href="/" className="font-heading text-2xl">
        Burç Stüdyosu
      </Link>
      <nav aria-label="Ana menü" className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(pathname, href) ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent',
              isActive(pathname, href) && 'bg-sidebar-accent font-semibold',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
      <form action="/api/auth/logout" method="post" className="mt-auto">
        <button
          type="submit"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="size-4" aria-hidden />
          Çıkış yap
        </button>
      </form>
    </aside>
  );
}

export function MobileDock() {
  const pathname = usePathname();
  return (
    <nav aria-label="Alt menü" className="fixed inset-x-0 bottom-4 z-50 flex justify-center md:hidden">
      <Dock direction="middle" className="mt-0 bg-card/90 shadow-lg">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <DockIcon key={href}>
            <Link
              href={href}
              aria-label={label}
              aria-current={isActive(pathname, href) ? 'page' : undefined}
              className={cn(
                'flex size-full items-center justify-center rounded-full',
                isActive(pathname, href) && 'bg-secondary',
              )}
            >
              <Icon className="size-5" aria-hidden />
            </Link>
          </DockIcon>
        ))}
        <DockIcon>
          <form action="/api/auth/logout" method="post" className="size-full">
            <button type="submit" aria-label="Çıkış yap" className="flex size-full items-center justify-center rounded-full">
              <LogOut className="size-5" aria-hidden />
            </button>
          </form>
        </DockIcon>
      </Dock>
    </nav>
  );
}
```

`src/app/(app)/layout.tsx`:
```tsx
import { AppSidebar, MobileDock } from '@/components/app-shell/app-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <AppSidebar />
      <main className="px-4 pt-8 pb-32 md:px-10 md:pb-12">{children}</main>
      <MobileDock />
    </div>
  );
}
```

`src/app/(app)/page.tsx`:
```tsx
import Link from 'next/link';
import { connection } from 'next/server';
import { BlurFade } from '@/components/ui/blur-fade';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateLongTr, istanbulDateKey } from '@/lib/date/istanbul';

export default async function TodayPage() {
  await connection();
  const today = istanbulDateKey();
  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <BlurFade>
        <p className="text-sm text-muted-foreground">{formatDateLongTr(today)}</p>
        <h1 className="font-heading text-4xl">Bugün</h1>
      </BlurFade>
      <BlurFade delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle>Günün paketi</CardTitle>
            <CardDescription>
              Burç yorumu üretimi bir sonraki aşamada bu sayfaya eklenecek. Şimdilik ayarlarını hazırlayabilirsin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/ayarlar" className={buttonVariants({ variant: 'outline' })}>
              Ayarlara git
            </Link>
          </CardContent>
        </Card>
      </BlurFade>
    </section>
  );
}
```

- [ ] **Step 8: E2E testlerinin geçtiğini gör**

Run: `npm run test:e2e -- e2e/auth.spec.ts`
Expected: 5 test PASS. İlk derleme için webServer'ın açılması 1-2 dakika sürebilir.

- [ ] **Step 9: Tüm kontroller**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: hepsi başarılı.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: giriş sayfası, uygulama kabuğu, Bugün sayfası ve Playwright E2E altyapısı" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Ayarlar sayfası (kullanıcı adı ve filigran önizlemesi)

**Files:**
- Create: `src/lib/settings/form.ts`, `src/lib/auth/require-session.ts`, `src/app/(app)/ayarlar/page.tsx`, `src/app/(app)/ayarlar/actions.ts`, `src/app/(app)/ayarlar/settings-form.tsx`, `src/app/(app)/ayarlar/watermark-preview.tsx`
- Test: `src/lib/settings/form.test.ts`, `e2e/settings.spec.ts`

**Interfaces:**
- Consumes: `getSettings`, `saveSettings`, `parseInstagramHandleInput`, `normalizeInstagramHandle`, `WATERMARK_POSITIONS`, `Settings`, `SettingsPatch` (Task 4); `getDb` (Task 2); `SESSION_COOKIE`, `verifySessionToken` (Task 5)
- Produces:
```ts
// src/lib/settings/form.ts
export type SettingsFormErrors = Partial<Record<'instagramHandle' | 'watermark', string>>;
export function parseSettingsForm(formData: FormData): { ok: true; patch: SettingsPatch } | { ok: false; errors: SettingsFormErrors };
// src/lib/auth/require-session.ts
export async function requireSession(): Promise<void>; // oturum yoksa fırlatır (server action savunması)
// src/app/(app)/ayarlar/actions.ts
export type SettingsFormState = { status: 'idle' } | { status: 'saved'; savedAt: number } | { status: 'error'; errors: SettingsFormErrors };
export async function saveSettingsAction(prev: SettingsFormState, formData: FormData): Promise<SettingsFormState>;
// src/app/(app)/ayarlar/watermark-preview.tsx
export function WatermarkPreview(props: { handle: string | null; enabled: boolean; position: WatermarkPosition; opacity: number }): JSX.Element;
```

- [ ] **Step 1: Form ayrıştırıcı için başarısız testi yaz**

`src/lib/settings/form.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseSettingsForm } from './form';
import { HANDLE_ERROR } from './schema';

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const valid = { instagramHandle: '@Burc.Studio', watermarkEnabled: 'true', watermarkPosition: 'bottom-right', watermarkOpacity: '70' };

describe('parseSettingsForm', () => {
  it('geçerli formu yamaya çevirir', () => {
    expect(parseSettingsForm(form(valid))).toEqual({
      ok: true,
      patch: { instagramHandle: 'burc.studio', watermark: { enabled: true, position: 'bottom-right', opacity: 0.7 } },
    });
  });

  it('boş kullanıcı adı null olur', () => {
    const result = parseSettingsForm(form({ ...valid, instagramHandle: '' }));
    expect(result.ok && result.patch.instagramHandle).toBeNull();
  });

  it('geçersiz kullanıcı adı ve opaklık hatası döner', () => {
    expect(parseSettingsForm(form({ ...valid, instagramHandle: 'foo bar', watermarkOpacity: '5' }))).toEqual({
      ok: false,
      errors: { instagramHandle: HANDLE_ERROR, watermark: 'Filigran ayarları geçersiz.' },
    });
  });

  it('bilinmeyen konum reddedilir', () => {
    expect(parseSettingsForm(form({ ...valid, watermarkPosition: 'top-left' })).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

Run: `npx vitest run src/lib/settings/form.test.ts`
Expected: FAIL — `./form` bulunamaz.

- [ ] **Step 3: Form ayrıştırıcıyı yaz**

`src/lib/settings/form.ts`:
```ts
import { parseInstagramHandleInput, WATERMARK_POSITIONS, type SettingsPatch, type WatermarkPosition } from './schema';

export type SettingsFormErrors = Partial<Record<'instagramHandle' | 'watermark', string>>;

export function parseSettingsForm(
  formData: FormData,
): { ok: true; patch: SettingsPatch } | { ok: false; errors: SettingsFormErrors } {
  const errors: SettingsFormErrors = {};

  const handle = parseInstagramHandleInput(String(formData.get('instagramHandle') ?? ''));
  if (!handle.ok) errors.instagramHandle = handle.error;

  const position = String(formData.get('watermarkPosition') ?? '');
  const opacityPercent = Number(formData.get('watermarkOpacity'));
  const validPosition = (WATERMARK_POSITIONS as readonly string[]).includes(position);
  const validOpacity = Number.isInteger(opacityPercent) && opacityPercent >= 20 && opacityPercent <= 100;
  if (!validPosition || !validOpacity) errors.watermark = 'Filigran ayarları geçersiz.';

  if (!handle.ok || errors.watermark) return { ok: false, errors };
  return {
    ok: true,
    patch: {
      instagramHandle: handle.value,
      watermark: {
        enabled: formData.get('watermarkEnabled') === 'true',
        position: position as WatermarkPosition,
        opacity: opacityPercent / 100,
      },
    },
  };
}
```

- [ ] **Step 4: Testin geçtiğini gör**

Run: `npx vitest run src/lib/settings/form.test.ts`
Expected: PASS.

- [ ] **Step 5: Başarısız E2E testini yaz**

`e2e/settings.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('kullanıcı adı ve filigran ayarları kaydedilir, önizleme anında güncellenir', async ({ page }) => {
  await login(page, '/ayarlar');
  await page.getByLabel('Instagram kullanıcı adı').fill('@Burc.Studio ');
  await expect(page.getByTestId('watermark')).toHaveText('@burc.studio');
  await page.getByRole('radio', { name: 'Sağ alt' }).click();
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByText('Ayarlar kaydedildi.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Instagram kullanıcı adı')).toHaveValue('burc.studio');
  await expect(page.getByRole('radio', { name: 'Sağ alt' })).toBeChecked();
});

test('filigran kapatılınca önizlemeden kalkar', async ({ page }) => {
  await login(page, '/ayarlar');
  await page.getByLabel('Instagram kullanıcı adı').fill('burc.studio');
  await expect(page.getByTestId('watermark')).toBeVisible();
  await page.getByRole('switch', { name: 'Filigranı göster' }).click();
  await expect(page.getByTestId('watermark')).toHaveCount(0);
});

test('geçersiz kullanıcı adı hata gösterir', async ({ page }) => {
  await login(page, '/ayarlar');
  await page.getByLabel('Instagram kullanıcı adı').fill('foo bar');
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByRole('alert')).toContainText('yalnızca harf, rakam, nokta ve alt çizgi');
});
```

- [ ] **Step 6: E2E testinin başarısız olduğunu gör**

Run: `npm run test:e2e -- e2e/settings.spec.ts`
Expected: FAIL — `/ayarlar` 404.

- [ ] **Step 7: Oturum savunması ve server action**

`src/lib/auth/require-session.ts`:
```ts
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from './session';

export async function requireSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) throw new Error('Oturum gerekli');
}
```

`src/app/(app)/ayarlar/actions.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireSession } from '@/lib/auth/require-session';
import { parseSettingsForm, type SettingsFormErrors } from '@/lib/settings/form';
import { saveSettings } from '@/lib/settings/repository';

export type SettingsFormState =
  | { status: 'idle' }
  | { status: 'saved'; savedAt: number }
  | { status: 'error'; errors: SettingsFormErrors };

export async function saveSettingsAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireSession();
  const parsed = parseSettingsForm(formData);
  if (!parsed.ok) return { status: 'error', errors: parsed.errors };
  await saveSettings(getDb(), parsed.patch);
  revalidatePath('/ayarlar');
  return { status: 'saved', savedAt: Date.now() };
}
```

- [ ] **Step 8: Sayfa, form ve önizleme**

`src/app/(app)/ayarlar/watermark-preview.tsx`:
```tsx
import { cn } from '@/lib/utils';
import type { WatermarkPosition } from '@/lib/settings/schema';

export function WatermarkPreview({
  handle,
  enabled,
  position,
  opacity,
}: {
  handle: string | null;
  enabled: boolean;
  position: WatermarkPosition;
  opacity: number;
}) {
  return (
    <figure
      aria-label="Filigran önizlemesi"
      className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-secondary to-accent shadow-sm"
    >
      <div className="absolute inset-x-6 top-8 space-y-3">
        <p className="font-heading text-3xl">Koç</p>
        <div className="h-2 w-3/4 rounded-full bg-white/70" />
        <div className="h-2 w-2/3 rounded-full bg-white/70" />
        <div className="h-2 w-1/2 rounded-full bg-white/70" />
      </div>
      {enabled && handle && (
        <span
          data-testid="watermark"
          className={cn(
            'absolute bottom-3 text-[11px] tracking-wide text-erik',
            position === 'bottom-center' ? 'left-1/2 -translate-x-1/2' : 'right-4',
          )}
          style={{ opacity }}
        >
          @{handle}
        </span>
      )}
    </figure>
  );
}
```

`src/app/(app)/ayarlar/settings-form.tsx`:
```tsx
'use client';

import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { parseInstagramHandleInput, type Settings, type WatermarkPosition } from '@/lib/settings/schema';
import { saveSettingsAction, type SettingsFormState } from './actions';
import { WatermarkPreview } from './watermark-preview';

const INITIAL_STATE: SettingsFormState = { status: 'idle' };

export function SettingsForm({ initial }: { initial: Settings }) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, INITIAL_STATE);
  const [handle, setHandle] = useState(initial.instagramHandle ?? '');
  const [enabled, setEnabled] = useState(initial.watermark.enabled);
  const [position, setPosition] = useState<WatermarkPosition>(initial.watermark.position);
  const [opacity, setOpacity] = useState(Math.round(initial.watermark.opacity * 100));

  useEffect(() => {
    if (state.status === 'saved') toast.success('Ayarlar kaydedildi.');
  }, [state]);

  const previewHandle = parseInstagramHandleInput(handle);
  const errors = state.status === 'error' ? state.errors : {};

  return (
    <form action={formAction} className="grid gap-10 md:grid-cols-[1fr_260px]">
      <div className="space-y-8">
        <div className="space-y-2">
          <Label htmlFor="instagramHandle">Instagram kullanıcı adı</Label>
          <Input
            id="instagramHandle"
            name="instagramHandle"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="kullaniciadi"
            autoComplete="off"
          />
          <p className="text-sm text-muted-foreground">
            Sayfanın adı belli olunca buraya yaz. Boş bırakırsan filigran görünmez.
          </p>
          {errors.instagramHandle && (
            <p role="alert" className="text-sm text-destructive">
              {errors.instagramHandle}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium">Filigranı göster</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Filigranı göster" />
          <input type="hidden" name="watermarkEnabled" value={String(enabled)} />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Konum</legend>
          <RadioGroup value={position} onValueChange={(value) => setPosition(value as WatermarkPosition)}>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="bottom-center" aria-label="Alt orta" /> Alt orta
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="bottom-right" aria-label="Sağ alt" /> Sağ alt
            </label>
          </RadioGroup>
          <input type="hidden" name="watermarkPosition" value={position} />
        </fieldset>

        <div className="space-y-3">
          <span className="text-sm font-medium">Opaklık: %{opacity}</span>
          <Slider
            aria-label="Filigran opaklığı"
            value={[opacity]}
            min={20}
            max={100}
            step={5}
            onValueChange={(value) => setOpacity(typeof value === 'number' ? value : value[0])}
          />
          <input type="hidden" name="watermarkOpacity" value={opacity} />
          {errors.watermark && (
            <p role="alert" className="text-sm text-destructive">
              {errors.watermark}
            </p>
          )}
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>

      <WatermarkPreview
        handle={previewHandle.ok ? previewHandle.value : null}
        enabled={enabled}
        position={position}
        opacity={opacity / 100}
      />
    </form>
  );
}
```

`src/app/(app)/ayarlar/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getDb } from '@/db/client';
import { getSettings } from '@/lib/settings/repository';
import { SettingsForm } from './settings-form';

export const metadata: Metadata = { title: 'Ayarlar' };

export default async function SettingsPage() {
  await connection();
  const settings = await getSettings(getDb());
  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <h1 className="font-heading text-4xl">Ayarlar</h1>
      <SettingsForm initial={settings} />
    </section>
  );
}
```

- [ ] **Step 9: E2E ve tüm kontroller**

Run: `npm run test:e2e && npm test && npm run lint && npm run typecheck && npm run build`
Expected: tüm E2E testleri (auth + settings) ve birim testler PASS, build başarılı.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: ayarlar sayfası, Instagram kullanıcı adı ve canlı filigran önizlemesi" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Cron uç noktası iskeleti

**Files:**
- Create: `src/lib/cron/auth.ts`, `src/app/api/cron/daily/route.ts`, `vercel.json`
- Test: `src/lib/cron/auth.test.ts`, `src/app/api/cron/daily/route.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
```ts
// src/lib/cron/auth.ts
export function isAuthorizedCronRequest(headers: Headers, secret: string | undefined): boolean; // secret yoksa false
// GET /api/cron/daily → 401 {error} | 200 {ok: true, generated: []}   (Faz 1 üretimi ekler)
```

- [ ] **Step 1: Başarısız testleri yaz**

`src/lib/cron/auth.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isAuthorizedCronRequest } from './auth';

const headers = (authorization?: string) => new Headers(authorization ? { authorization } : {});

describe('isAuthorizedCronRequest', () => {
  it('doğru Bearer anahtarını kabul eder', () => {
    expect(isAuthorizedCronRequest(headers('Bearer gizli-anahtar'), 'gizli-anahtar')).toBe(true);
  });

  it.each([undefined, 'Bearer yanlis', 'gizli-anahtar', 'Bearer gizli-anahtarX'])('%s reddedilir', (value) => {
    expect(isAuthorizedCronRequest(headers(value), 'gizli-anahtar')).toBe(false);
  });

  it('CRON_SECRET tanımlı değilse her istek reddedilir', () => {
    expect(isAuthorizedCronRequest(headers('Bearer '), undefined)).toBe(false);
    expect(isAuthorizedCronRequest(headers('Bearer '), '')).toBe(false);
  });
});
```

`src/app/api/cron/daily/route.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

afterEach(() => vi.unstubAllEnvs());

describe('GET /api/cron/daily', () => {
  it('anahtarsız istek 401 alır', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-anahtari');
    const res = await GET(new Request('http://localhost/api/cron/daily'));
    expect(res.status).toBe(401);
  });

  it('doğru anahtarla 200 döner', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-anahtari');
    const res = await GET(new Request('http://localhost/api/cron/daily', { headers: { authorization: 'Bearer cron-anahtari' } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, generated: [] });
  });
});
```

- [ ] **Step 2: Testlerin başarısız olduğunu gör**

Run: `npx vitest run src/lib/cron src/app/api/cron`
Expected: FAIL — modüller bulunamaz.

- [ ] **Step 3: Uygulamayı yaz**

`src/lib/cron/auth.ts`:
```ts
import { timingSafeEqual } from 'node:crypto';

export function isAuthorizedCronRequest(headers: Headers, secret: string | undefined): boolean {
  if (!secret) return false;
  const received = Buffer.from(headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
```

`src/app/api/cron/daily/route.ts`:
```ts
import { isAuthorizedCronRequest } from '@/lib/cron/auth';

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers, process.env.CRON_SECRET)) {
    return Response.json({ error: 'Yetkisiz.' }, { status: 401 });
  }
  return Response.json({ ok: true, generated: [] });
}
```

`vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [{ "path": "/api/cron/daily", "schedule": "0 3 * * *" }]
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cron src/app/api/cron vercel.json
git commit -m "feat: CRON_SECRET korumalı günlük cron uç noktası (06:00 TSİ)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Vercel'e yayın, Neon ve canlı doğrulama

> Bu görev hesap onayı ve sır girişi gerektirdiği için **kontrolcü (ana oturum) tarafından, kullanıcıyla birlikte** yürütülür; alt ajana verilmez. Kullanıcının çalıştırması gereken komutlar `!` önekiyle istenir.

**Files:**
- Modify: yok (yalnızca Vercel ve Neon yapılandırması)
- Local only (commit edilmez): `.vercel/`, `.env.production.local`, `.env.local`

**Interfaces:**
- Consumes: tüm Faz 0 çıktıları
- Produces: `burc-studio` Vercel projesi (Git bağlı), Neon veritabanı (`DATABASE_URL`), production ortam değişkenleri (`SESSION_SECRET`, `APP_PASSWORD_HASH`, `CRON_SECRET`), `https://burc-studio.vercel.app`

- [ ] **Step 1: Dalı gönder ve Vercel projesini bağla**

```bash
cd ~/burc-studio
git push -u origin faz-0-iskelet
vercel link --yes
cat .vercel/project.json
git status --short
```
Expected:
- `.vercel/project.json` içinde `"projectName":"burc-studio"` görünür. `--yes`, dizin adıyla yeni proje oluşturur. `--project` yalnızca var olan projeye bağlanır.
- `.vercel/` `.gitignore`'dadır.
- `vercel link` bir `.env.local` yazdıysa içeriğini kontrol et. Yerel geliştirme için `.env.local` yalnızca `.env.example`'daki anahtarları içermeli; Neon adresi yerel dosyaya girmemeli.

- [ ] **Step 2: GitHub bağlantısı**

```bash
vercel git connect https://github.com/serkangunacti/burc-studio
```
Expected: `Connected`. Vercel GitHub uygulaması private repoya erişemiyorsa kullanıcıdan tarayıcıda yetki vermesini iste, sonra komutu tekrarla.

- [ ] **Step 3: Neon'u bağla (kullanıcı onayı gerekir)**

Kullanıcıdan iste: `! vercel integration add neon --no-env-pull`
Ardından:
```bash
vercel env ls
```
Expected: `DATABASE_URL` production, preview ve development ortamlarında listelenir.

- [ ] **Step 4: Sırları ekle**

```bash
printf '%s' "$(openssl rand -base64 48)" | vercel env add SESSION_SECRET production,preview
printf '%s' "$(openssl rand -base64 32)" | vercel env add CRON_SECRET production,preview
```
Kullanıcıdan iste. Önce `! npm run hash-password` ile şifresini girsin, çıktıyı kopyalasın. Sonra `! vercel env add APP_PASSWORD_HASH production,preview` ile yapıştırsın. Şifre sohbete yazılmaz.
Run: `vercel env ls`
Expected: dört değişken de production ve preview'da var.

- [ ] **Step 5: Production veritabanına migration uygula**

```bash
vercel env pull .env.production.local --environment=production
npm run db:migrate:prod
```
Expected: drizzle-kit `migrations applied successfully` (ya da eşdeğer başarı çıktısı).

- [ ] **Step 6: Önizleme deploy'unu doğrula**

```bash
git commit --allow-empty -m "chore: önizleme deploy tetikle" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git push
vercel ls burc-studio | head -5
PREVIEW=<listedeki en yeni önizleme URL'si>
vercel curl /ayarlar --deployment "$PREVIEW" -- -s -o /dev/null -w "%{http_code} %{redirect_url}\n"
vercel curl /robots.txt --deployment "$PREVIEW" -- -s -D - | grep -iE "^x-robots-tag|Disallow"
vercel curl /api/cron/daily --deployment "$PREVIEW" -- -s -o /dev/null -w "%{http_code}\n"
```
Expected:
- `/ayarlar` isteği `307 …/giris?next=%2Fayarlar` döner.
- `robots.txt` yanıtında `x-robots-tag: noindex, nofollow` başlığı ve `Disallow: /` satırı görünür.
- Cron uç noktası 401 döner.

`vercel curl` önizleme korumasını otomatik aşar.

- [ ] **Step 7: Kullanıcıyla tarayıcı doğrulaması (önizleme)**

Kullanıcı önizleme URL'sini açar (Vercel hesabıyla önizleme koruması geçilir). Ardından şunları yapar:
1. Şifresiyle giriş yapar.
2. Ayarlar'da kullanıcı adı alanını boş bırakıp filigran konumunu "Sağ alt" yapar ve kaydeder.
3. Sayfayı yeniler ve ayarların kaldığını görür.
4. Telefonda alt menünün göründüğünü doğrular.

- [ ] **Step 8: Dalı birleştir**

`superpowers:finishing-a-development-branch` skill'ini çalıştır. Kullanıcıya birleştirme seçeneklerini sun: yerel merge + push ya da PR. `main`'e push production deploy'unu tetikler.

- [ ] **Step 9: Production doğrulaması**

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://burc-studio.vercel.app/ayarlar
curl -s -D - https://burc-studio.vercel.app/robots.txt | grep -iE "^x-robots-tag|Disallow"
curl -s -o /dev/null -w "%{http_code}\n" https://burc-studio.vercel.app/api/cron/daily
vercel crons ls
vercel project protection burc-studio --format json
```
Expected:
- `/ayarlar` `307 https://burc-studio.vercel.app/giris?next=%2Fayarlar` döner.
- `robots.txt` noindex başlığı ve `Disallow: /` satırı içerir.
- Cron uç noktası 401 döner.
- `vercel crons ls` çıktısında `/api/cron/daily 0 3 * * *` görünür.
- Koruma çıktısında Vercel Authentication (standart koruma) önizlemeler için açıktır.

Sonuçları kullanıcıya raporla. Doğrulanamayan maddeleri nedeniyle birlikte açıkça yaz.
