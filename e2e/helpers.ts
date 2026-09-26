import { readFile } from 'node:fs/promises';
import { expect, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { istanbulDateKey } from '../src/lib/date/istanbul';
import { E2E_PASSWORD } from './constants';

export async function login(page: Page, path = '/') {
  await page.goto(path);
  await page.getByLabel('Şifre').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).not.toHaveURL(/\/giris/);
}

export async function freshPost(page: Page, audience: 'kadin' | 'erkek' = 'kadin', date: string = istanbulDateKey()): Promise<string> {
  const response = await page.request.post('/api/generate', { data: { date, audience, force: true } });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { postId: string }).postId;
}

export async function downloadPostZip(page: Page): Promise<Record<string, Uint8Array>> {
  await page.getByRole('button', { name: "JPEG'leri hazırla" }).click();
  await expect(page.getByText('14/14 görsel hazır')).toBeVisible({ timeout: 90_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'ZIP indir' }).click()]);
  return unzipSync(new Uint8Array(await readFile(await download.path())));
}
