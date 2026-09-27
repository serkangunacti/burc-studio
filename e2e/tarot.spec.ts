import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { istanbulDateKey } from '../src/lib/date/istanbul';
import { LONGEST_BODY } from '../src/remotion/fixtures';
import { downloadPostZip, login } from './helpers';
import { jpegSize } from './jpeg';
import { mp4Info } from './mp4';

const TODAY = istanbulDateKey();

async function tarotPost(page: Page, audience: 'kadin' | 'erkek'): Promise<string> {
  const response = await page.request.post('/api/generate', { data: { date: TODAY, audience, kind: 'tarot', force: true } });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { postId: string }).postId;
}

const cardOfSlide = (page: Page, position: number) =>
  page.getByRole('button', { name: new RegExp(`^Slayt ${position}:`) }).locator('[data-card]').first().getAttribute('data-card');

test('tarot gönderisi 14 slayt ve tarot dosya adlarıyla indirilir; en uzun yorum sığar', async ({ page }) => {
  await login(page);
  const id = await tarotPost(page, 'kadin');
  await page.goto(`/gonderi/${id}`);
  await expect(page.getByRole('heading', { name: 'Kadın tarot yorumları' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Slayt \d+:/ })).toHaveCount(14);
  await page.getByRole('button', { name: /^Slayt 10: Yay/ }).click();
  await page.getByLabel('Başlık').fill('Çığır açan, güçlü bir gün geçireceksin');
  await page.getByLabel('Yorum', { exact: true }).fill(LONGEST_BODY);
  await page.getByRole('button', { name: 'Değişiklikleri kaydet' }).click();
  await expect(page).not.toHaveURL(new RegExp(id));
  await expect(page.getByRole('button', { name: /^Slayt 10: Yay/ })).toBeVisible();
  expect(
    await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-slot="body"]')].every((element) => element.scrollHeight <= element.clientHeight + 1)),
  ).toBe(true);
  const files = await downloadPostZip(page);
  expect(Object.keys(files)).toEqual(expect.arrayContaining([`${TODAY}_kadin-tarot_01-kapak.jpg`, `${TODAY}_kadin-tarot_06-aslan.jpg`, 'caption.txt']));
  expect(jpegSize(files[`${TODAY}_kadin-tarot_06-aslan.jpg`])).toEqual({ width: 1080, height: 1350 });
});

test('tek burcun kartı yeniden çekilir; tüm kartlar yeniden çekilir', async ({ page }) => {
  await login(page);
  const id = await tarotPost(page, 'erkek');
  await page.goto(`/gonderi/${id}`);
  const before = await cardOfSlide(page, 6);
  await page.getByRole('button', { name: /^Slayt 6: Aslan/ }).click();
  await page.getByRole('button', { name: 'Aslan: kartı yeniden çek' }).click();
  await expect(page).not.toHaveURL(new RegExp(id));
  await expect(page.getByRole('heading', { name: 'Erkek tarot yorumları' })).toBeVisible();
  await expect.poll(() => cardOfSlide(page, 6)).not.toBe(before);

  const second = page.url();
  const version = Number((await page.locator('header').getByText(/^Sürüm \d+$/).textContent())!.replace('Sürüm ', ''));
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Tüm kartları yeniden çek' }).click();
  await expect(page).not.toHaveURL(second);
  await expect(page.locator('header').getByText(`Sürüm ${version + 1}`)).toBeVisible();
});

test('arşiv tarot gönderilerini türe göre süzer', async ({ page }) => {
  await login(page);
  await tarotPost(page, 'kadin');
  await page.goto('/arsiv');
  await page.getByRole('navigation', { name: 'Tür' }).getByRole('link', { name: 'Tarot' }).click();
  await expect(page).toHaveURL(/tur=tarot/);
  await expect(page.getByRole('link', { name: /Kadın tarot yorumları$/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /burç yorumları$/ })).toHaveCount(0);
});

test('tarot gönderisinin müzikli Reels videosu tarot dosya adıyla üretilir', async ({ page }) => {
  test.setTimeout(600_000);
  await login(page);
  const id = await tarotPost(page, 'kadin');
  await page.goto(`/gonderi/${id}`);
  await page.getByRole('button', { name: "Reels'i hazırla" }).click();
  await expect(page.getByRole('button', { name: 'MP4 indir' })).toBeVisible({ timeout: 540_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'MP4 indir' }).click()]);
  expect(download.suggestedFilename()).toBe(`${TODAY}_kadin-tarot_reels.mp4`);
  expect(mp4Info(new Uint8Array(await readFile(await download.path())))).toMatchObject({ width: 1080, height: 1920, hasAudio: true });
});

test('tüm kartları yeniden çekerken bağlantı koparsa hata gösterilir ve düğme yeniden kullanılabilir', async ({ page }) => {
  await login(page);
  const id = await tarotPost(page, 'kadin');
  await page.goto(`/gonderi/${id}`);
  await page.route('**/api/generate', (route) => route.abort('internetdisconnected'));
  page.once('dialog', (dialog) => void dialog.accept());
  const button = page.getByRole('button', { name: 'Tüm kartları yeniden çek' });
  await button.click();
  await expect(page.getByText('Kartlar yeniden çekilemedi; bağlantını kontrol et.')).toBeVisible();
  await expect(button).toBeEnabled();
});
