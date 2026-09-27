import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { addDays, istanbulDateKey } from '../src/lib/date/istanbul';
import { LONGEST_WEEKLY_BODY } from '../src/remotion/fixtures';
import { downloadPostZip, login } from './helpers';
import { jpegSize } from './jpeg';
import { mp4Info } from './mp4';

// Üretim en fazla 7 gün geriye izin verir; en yakın pazartesi (bugün pazartesiyse bugün) her zaman bu aralıktadır.
function lastMonday(): string {
  const today = istanbulDateKey();
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  return addDays(today, -((weekday + 6) % 7));
}
const MONDAY = lastMonday();

async function weeklyPost(page: Page, audience: 'kadin' | 'erkek'): Promise<string> {
  const response = await page.request.post('/api/generate', { data: { date: MONDAY, audience, kind: 'weekly', force: true } });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { postId: string }).postId;
}

test('haftalık gönderi 14 slayt ve haftalık dosya adlarıyla indirilir; en uzun yorum sığar', async ({ page }) => {
  await login(page);
  const id = await weeklyPost(page, 'kadin');
  await page.goto(`/gonderi/${id}`);
  await expect(page.getByRole('heading', { name: 'Kadın haftalık yorumlar' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Slayt \d+:/ })).toHaveCount(14);

  await page.getByRole('button', { name: /^Slayt 10: Yay/ }).click();
  await page.getByLabel('Yorum', { exact: true }).fill(LONGEST_WEEKLY_BODY);
  await page.getByRole('button', { name: 'Değişiklikleri kaydet' }).click();
  await expect(page.getByText('Yeni sürüm kaydedildi.').first()).toBeVisible();
  await expect(page).not.toHaveURL(new RegExp(id));
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-slot="text"]')].every((element) => element.scrollHeight <= element.clientHeight + 1),
    ),
  ).toBe(true);

  const files = await downloadPostZip(page);
  const names = Object.keys(files);
  expect(names).toEqual(expect.arrayContaining([`${MONDAY}_kadin-haftalik_01-kapak.jpg`, `${MONDAY}_kadin-haftalik_10-yay.jpg`, 'caption.txt']));
  expect(jpegSize(files[`${MONDAY}_kadin-haftalik_10-yay.jpg`])).toEqual({ width: 1080, height: 1350 });
});

test('haftalık burç yeniden üretilince haftalık gönderinin yeni sürümü açılır', async ({ page }) => {
  await login(page);
  const id = await weeklyPost(page, 'erkek');
  await page.goto(`/gonderi/${id}`);
  await page.getByRole('button', { name: /^Slayt 6: Aslan/ }).click();
  await page.getByRole('button', { name: 'Aslan yorumunu yeniden üret' }).click();
  await expect(page).not.toHaveURL(new RegExp(id));
  await expect(page.getByRole('heading', { name: 'Erkek haftalık yorumlar' })).toBeVisible();
  await expect(page.locator('header').getByText('Sürüm 2')).toBeVisible();
});

test('arşiv haftalık gönderileri türe göre süzer', async ({ page }) => {
  await login(page);
  await weeklyPost(page, 'kadin');
  await page.goto('/arsiv');
  await page.getByRole('navigation', { name: 'Tür' }).getByRole('link', { name: 'Haftalık' }).click();
  await expect(page).toHaveURL(/tur=haftalik/);
  await expect(page.getByRole('link', { name: /Kadın haftalık yorumlar$/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /burç yorumları$/ })).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Tür' }).getByRole('link', { name: 'Günlük' }).click();
  await expect(page.getByRole('link', { name: /haftalık yorumlar$/ })).toHaveCount(0);
});

test('pazartesi olmayan gün için haftalık üretim reddedilir', async ({ page }) => {
  await login(page);
  const response = await page.request.post('/api/generate', { data: { date: addDays(MONDAY, 1), audience: 'kadin', kind: 'weekly' } });
  expect(response.status()).toBe(400);
});

test('haftalık gönderinin müzikli Reels videosu haftalık dosya adıyla üretilir', async ({ page }) => {
  test.setTimeout(600_000);
  await login(page);
  const id = await weeklyPost(page, 'erkek');
  await page.goto(`/gonderi/${id}`);
  await expect(page.getByRole('heading', { name: 'Reels videosu' })).toBeVisible();
  await page.getByRole('button', { name: "Reels'i hazırla" }).click();
  await expect(page.getByRole('button', { name: 'MP4 indir' })).toBeVisible({ timeout: 540_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'MP4 indir' }).click()]);
  expect(download.suggestedFilename()).toBe(`${MONDAY}_erkek-haftalik_reels.mp4`);
  const info = mp4Info(new Uint8Array(await readFile(await download.path())));
  expect(info).toMatchObject({ width: 1080, height: 1920, hasAudio: true });
});
