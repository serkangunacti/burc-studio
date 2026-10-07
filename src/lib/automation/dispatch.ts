import type { DateKey } from '@/lib/date/istanbul';

export const RENDER_WORKFLOW = 'render-publications.yml';

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
      authorization: `Bearer ${input.token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main', inputs: { date: input.date, force: input.force ? 'true' : 'false', ...(input.only ? { only: input.only } : {}) } }),
  });
  if (response.status === 204) return { dispatched: true };
  return { dispatched: false, reason: `GitHub ${response.status}: ${(await response.text()).slice(0, 200)}` };
}

// Anahtarın bu depodaki hazırlık iş akışını görebildiğini doğrular (ince ayarlı anahtar: Actions okuma-yazma).
export async function verifyRenderWorkflowAccess(input: { token: string; repository: string; fetch?: typeof fetch }): Promise<boolean> {
  const response = await (input.fetch ?? fetch)(`https://api.github.com/repos/${input.repository}/actions/workflows/${RENDER_WORKFLOW}`, {
    headers: { authorization: `Bearer ${input.token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
  });
  return response.ok;
}
