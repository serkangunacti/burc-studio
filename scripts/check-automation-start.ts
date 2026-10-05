import { appendFile } from 'node:fs/promises';
import { closeDb, getDb } from '../src/db/client';
import { automationStartReason } from '../src/lib/automation/start';
import { isDateKey, istanbulDateKey } from '../src/lib/date/istanbul';
import { getSettings } from '../src/lib/settings/repository';

// GitHub ağır render araçlarını kurmadan önce canlıdaki başlangıç kuralını okur.
async function main() {
  const date = process.env.RENDER_DATE || istanbulDateKey();
  if (!isDateKey(date)) throw new Error('Geçersiz tarih');
  const { automation } = await getSettings(getDb());
  const paused = automationStartReason(automation.startDate, date);
  const allowed = automation.enabled && !paused;
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `allowed=${allowed}\ndate=${date}\n`);
  console.log(allowed ? 'Otomasyon başlangıç kontrolü geçti.' : paused ?? 'Otomatik paylaşım kapalı.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => closeDb());
