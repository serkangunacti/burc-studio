import type { DateKey } from '@/lib/date/istanbul';

export const RENDER_WORKFLOW = 'render-publications.yml';

const githubHeaders = (token: string) => ({
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
});

// Günlük üretim biter bitmez GitHub'daki hazırlık işini başlatır; GitHub zamanlamaları yalnız yedektir.
export async function dispatchRenderWorkflow(input: {
  token: string | undefined;
  repository: string;
  date: DateKey;
  force?: boolean;
  only?: string;
  fetch?: typeof fetch;
}): Promise<{ dispatched: boolean; reason?: string }> {
  if (!input.token) return { dispatched: false, reason: 'GitHub anahtarı bağlı değil' };
  const response = await (input.fetch ?? fetch)(`https://api.github.com/repos/${input.repository}/actions/workflows/${RENDER_WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      ...githubHeaders(input.token),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main', inputs: { date: input.date, force: input.force ? 'true' : 'false', ...(input.only ? { only: input.only } : {}) } }),
  });
  if (response.status === 204) return { dispatched: true };
  return { dispatched: false, reason: `GitHub ${response.status}: ${(await response.text()).slice(0, 200)}` };
}

// GitHub dispatch 204 dönse bile kota/ödeme/runner hatasında iş birkaç saniye içinde başlamadan "failure" olur.
export async function checkRecentRenderFailure(input: {
  token: string | undefined;
  repository: string;
  since: Date;
  fetch?: typeof fetch;
}): Promise<string | null> {
  if (!input.token) return 'GitHub anahtarı bağlı değil';
  const fetchImpl = input.fetch ?? fetch;
  try {
    const runsRes = await fetchImpl(`https://api.github.com/repos/${input.repository}/actions/workflows/${RENDER_WORKFLOW}/runs?per_page=3`, {
      headers: githubHeaders(input.token),
    });
    if (!runsRes.ok) return null;
    const runsData = (await runsRes.json()) as {
      workflow_runs?: Array<{ id: number; status: string; conclusion: string | null; created_at: string }>;
    };
    const recentRun = (runsData.workflow_runs ?? []).find((run) => Date.parse(run.created_at) >= input.since.getTime() - 15_000);
    if (!recentRun) return null;
    if (recentRun.status !== 'completed' || !recentRun.conclusion || ['success', 'skipped', 'neutral'].includes(recentRun.conclusion)) {
      return null;
    }

    const jobsRes = await fetchImpl(`https://api.github.com/repos/${input.repository}/actions/runs/${recentRun.id}/jobs?per_page=5`, {
      headers: githubHeaders(input.token),
    });
    if (jobsRes.ok) {
      const jobsData = (await jobsRes.json()) as { jobs?: Array<{ id: number; conclusion: string | null }> };
      const failedJob = (jobsData.jobs ?? []).find((j) => j.conclusion === 'failure' || j.conclusion === 'cancelled');
      if (failedJob) {
        const annRes = await fetchImpl(`https://api.github.com/repos/${input.repository}/check-runs/${failedJob.id}/annotations`, {
          headers: githubHeaders(input.token),
        });
        if (annRes.ok) {
          const annotations = (await annRes.json()) as Array<{ message?: string }>;
          const messages = annotations.map((a) => a.message?.trim()).filter(Boolean);
          if (messages.length > 0) {
            return `GitHub Actions işi başlatılamadı (Run #${recentRun.id}): ${messages.join(' | ')}`;
          }
        }
      }
    }
    return `GitHub Actions işi başarısız oldu (Run #${recentRun.id}, durum: ${recentRun.conclusion})`;
  } catch {
    return null;
  }
}

// Anahtarın bu depodaki hazırlık iş akışını görebildiğini doğrular (ince ayarlı anahtar: Actions okuma-yazma).
export async function verifyRenderWorkflowAccess(input: { token: string; repository: string; fetch?: typeof fetch }): Promise<boolean> {
  const response = await (input.fetch ?? fetch)(`https://api.github.com/repos/${input.repository}/actions/workflows/${RENDER_WORKFLOW}`, {
    headers: githubHeaders(input.token),
  });
  return response.ok;
}
