import {
  dateKeyInTimezone,
  istanbulDateKey,
} from './quota-reset.mjs';
import {fileURLToPath} from 'node:url';

export function shouldRunScheduledRender({eventName, now = new Date(), workflowRuns = []}) {
  if (eventName !== 'schedule') return {shouldRun: true, reason: 'Manuel çalıştırma'};
  const instant = now instanceof Date ? now : new Date(now);
  const today = istanbulDateKey(instant);
  const alreadySucceeded = workflowRuns.some((run) =>
    run.event === 'schedule' && run.status === 'completed' && run.conclusion === 'success' &&
    typeof run.created_at === 'string' && dateKeyInTimezone(run.created_at, 'Europe/Istanbul') === today
  );
  if (alreadySucceeded) return {shouldRun: false, reason: 'Bugünün zamanlanmış render işi zaten başarıyla tamamlandı'};
  return {shouldRun: true, reason: 'Bugünün render işi henüz başarıyla tamamlanmadı; render başlatılıyor'};
}

async function main() {
  const eventName = process.env.GITHUB_EVENT_NAME;
  let workflowRuns = [];
  if (eventName === 'schedule') {
    const repository = process.env.GITHUB_REPOSITORY;
    const token = process.env.GITHUB_TOKEN;
    if (repository && token) {
      try {
        const response = await fetch(`https://api.github.com/repos/${repository}/actions/workflows/render-publications.yml/runs?event=schedule&per_page=100`, {
          headers: {authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28'},
        });
        if (response.ok) workflowRuns = (await response.json()).workflow_runs ?? [];
        else console.warn(`Ön kontrol geçmişi alınamadı (HTTP ${response.status}); render güvenli tekrar çalıştırma kuralıyla sürdürülecek.`);
      } catch {
        console.warn('Ön kontrol geçmişi alınamadı; render güvenli tekrar çalıştırma kuralıyla sürdürülecek.');
      }
    }
  }
  const result = shouldRunScheduledRender({eventName, now: new Date(), workflowRuns});
  const output = process.env.GITHUB_OUTPUT;
  if (output) {
    const {appendFile} = await import('node:fs/promises');
    await appendFile(output, `should-run=${result.shouldRun}\n`);
  }
  console.log(`${result.shouldRun ? 'Devam' : 'Atlandı'}: ${result.reason}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
