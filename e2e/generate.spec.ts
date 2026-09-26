import { expect, test } from '@playwright/test';
import { E2E_CRON_SECRET } from './constants';
import { login } from './helpers';

test('günün paketi tek tıkla üretilir, burçlar sayfasında 12 yorum görünür', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Günün paketini oluştur' }).click();
  await expect(page.getByText('Paket hazır')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('navigation', { name: 'Ana menü' }).getByRole('link', { name: 'Burçlar' }).click();
  await expect(page.getByRole('article')).toHaveCount(12);
  await expect(page.getByRole('heading', { name: /Koç$/ })).toBeVisible();
  await page.getByRole('link', { name: 'Erkek' }).click();
  await expect(page).toHaveURL(/kitle=erkek/);
  await expect(page.getByRole('article')).toHaveCount(12);
});

test('tek burç yeniden üretilir', async ({ page }) => {
  await login(page, '/burclar');
  await page.getByRole('button', { name: 'Aslan yorumunu yeniden üret' }).click();
  await expect(page.getByText('Aslan yorumu yenilendi.')).toBeVisible({ timeout: 30_000 });
});

test('cron uç noktası anahtarla çalışır ve mevcut paketi atlar', async ({ request }) => {
  const response = await request.get('/api/cron/daily', { headers: { authorization: `Bearer ${E2E_CRON_SECRET}` } });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.generated.map((entry: { result: { status: string } }) => entry.result.status)).toEqual(['skipped', 'skipped']);
});
