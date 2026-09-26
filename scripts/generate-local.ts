import { closeDb, getDb } from '../src/db/client';
import { generateDailyPackage } from '../src/lib/content/daily-package';
import { isDateKey, istanbulDateKey } from '../src/lib/date/istanbul';
import { availableProviders, resolveProviderChain } from '../src/lib/llm/providers';
import { getSettings } from '../src/lib/settings/repository';

async function main() {
  const date = process.argv[2] ?? istanbulDateKey();
  if (!isDateKey(date)) throw new Error(`Geçersiz tarih: ${date}`);
  const db = getDb();
  const settings = await getSettings(db);
  const env = { ...process.env, OLLAMA_LOCAL_MODEL: process.env.OLLAMA_LOCAL_MODEL ?? 'gemma4:26b' };
  const chain = resolveProviderChain([], availableProviders(env), 'ollama-local');
  console.log(`${date} için yerel üretim başlıyor (${chain[0].model})…`);
  const results = await generateDailyPackage(
    { db, chain, baseHashtags: settings.baseHashtags, timeoutMs: 600_000 },
    { date, items: settings.dailyPlan, trigger: 'local', skipIfExists: true },
  );
  for (const entry of results) {
    console.log(`${entry.item.audience}: ${'result' in entry ? entry.result.status : `HATA — ${entry.error}`}`);
  }
  if (results.some((entry) => 'error' in entry)) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
