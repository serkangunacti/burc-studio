import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { istanbulDateKey } from '../src/lib/date/istanbul';
import { freshPost, login } from './helpers';
import { mp4Info } from './mp4';

test('Reels 1080×1920, 59 saniyelik, müzikli MP4 olarak üretilir ve indirilir', async ({ page }) => {
  test.setTimeout(600_000);
  await login(page);
  const id = await freshPost(page);
  await page.goto(`/gonderi/${id}`);
  await expect(page.getByRole('heading', { name: 'Reels videosu' })).toBeVisible();
  await page.getByRole('button', { name: "Reels'i hazırla" }).click();
  await expect(page.getByRole('button', { name: 'MP4 indir' })).toBeVisible({ timeout: 540_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'MP4 indir' }).click()]);
  expect(download.suggestedFilename()).toBe(`${istanbulDateKey()}_kadin-burc_reels.mp4`);
  const info = mp4Info(new Uint8Array(await readFile(await download.path())));
  expect(info).toMatchObject({ width: 1080, height: 1920, hasAudio: true });
  expect(info.durationSeconds).toBeCloseTo(59, 0);
});

test('Reels üretimi iptal edilince yeniden başlatılabilir; kaydedilmemiş değişiklikte kapalıdır', async ({ page }) => {
  await login(page);
  const id = await freshPost(page);
  await page.goto(`/gonderi/${id}`);
  await page.getByRole('button', { name: "Reels'i hazırla" }).click();
  await expect(page.getByText(/%\d+ hazır/)).toBeVisible();
  await page.getByRole('button', { name: 'İptal', exact: true }).click();
  await expect(page.getByRole('button', { name: "Reels'i hazırla" })).toBeEnabled();
  await page.getByLabel('Caption').fill('Kaydedilmemiş değişiklik varken Reels üretilmez.');
  await expect(page.getByRole('button', { name: "Reels'i hazırla" })).toBeDisabled();
});

test('video kodlayıcısı olmayan tarayıcıda açıklayıcı mesaj gösterilir', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as { VideoEncoder?: unknown }).VideoEncoder;
  });
  await login(page);
  const id = await freshPost(page);
  await page.goto(`/gonderi/${id}`);
  await expect(page.getByRole('alert').filter({ hasText: 'Bu tarayıcı video üretemiyor' })).toBeVisible();
  await expect(page.getByRole('button', { name: "Reels'i hazırla" })).toBeDisabled();
});
