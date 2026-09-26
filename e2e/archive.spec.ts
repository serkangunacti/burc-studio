import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { addDays, istanbulDateKey } from '../src/lib/date/istanbul';
import { downloadPostZip, freshPost, login } from './helpers';

// Arşiv testleri alfabetik olarak generate.spec'ten önce koşar. Bugünün paketini doldurup
// oradaki "Günün paketini oluştur" düğmesini devre dışı bırakmamak için yarının tarihi kullanılır.
const TOMORROW = addDays(istanbulDateKey(), 1);

function imageHashes(files: Record<string, Uint8Array>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files)
      .filter(([name]) => name.endsWith('.jpg'))
      .map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')]),
  );
}

test('arşiv güncel gönderileri listeler, kitleye göre süzer ve gönderiyi açar', async ({ page }) => {
  await login(page);
  for (const audience of ['kadin', 'erkek'] as const) {
    await page.request.post('/api/generate', { data: { date: TOMORROW, audience } });
  }
  await page.getByRole('navigation', { name: 'Ana menü' }).getByRole('link', { name: 'Arşiv' }).click();
  await expect(page.getByRole('link', { name: /Kadın burç yorumları$/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Erkek burç yorumları$/ }).first()).toBeVisible();
  await page.getByRole('navigation', { name: 'Kitle' }).getByRole('link', { name: 'Erkek' }).click();
  await expect(page).toHaveURL(/kitle=erkek/);
  await expect(page.getByRole('link', { name: /Kadın burç yorumları$/ })).toHaveCount(0);
  await page.getByRole('link', { name: /Erkek burç yorumları$/ }).first().click();
  await expect(page).toHaveURL(/\/gonderi\//);
});

test('arşivdeki eski sürüm ilk indirmedeki görsellerle birebir aynı yeniden üretilir', async ({ page }) => {
  await login(page);
  const oldId = await freshPost(page, 'kadin', TOMORROW);
  await page.goto(`/gonderi/${oldId}`);
  const before = imageHashes(await downloadPostZip(page));
  expect(Object.keys(before)).toHaveLength(14);

  await page.getByLabel('Kapak cümlesi').fill('Yeni sürümün kapak cümlesi');
  await page.getByRole('button', { name: 'Değişiklikleri kaydet' }).click();
  await expect(page).not.toHaveURL(new RegExp(oldId));

  await page.getByRole('navigation', { name: 'Ana menü' }).getByRole('link', { name: 'Arşiv' }).click();
  await page.getByRole('link', { name: /Kadın burç yorumları$/ }).first().click();
  await page.getByRole('navigation', { name: 'Sürümler' }).locator(`a[href="/gonderi/${oldId}"]`).click();
  await expect(page.getByText('Bu eski bir sürüm; yalnızca indirilebilir.')).toBeVisible();
  expect(imageHashes(await downloadPostZip(page))).toEqual(before);
});

test('Bugün sayfasından hazır gönderi açılır', async ({ page }) => {
  await login(page);
  await page.request.post('/api/generate', { data: { date: istanbulDateKey(), audience: 'kadin' } });
  await page.goto('/');
  await page.getByRole('link', { name: 'Gönderiyi aç' }).first().click();
  await expect(page).toHaveURL(/\/gonderi\//);
  await expect(page.getByRole('button', { name: /^Slayt \d+:/ })).toHaveCount(14);
});
