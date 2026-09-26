import { expect, test } from '@playwright/test';
import { E2E_PASSWORD } from './constants';
import { login } from './helpers';

test('girişsiz ziyaretçi giriş sayfasına yönlenir, doğru şifreyle hedef sayfaya döner', async ({ page }) => {
  await page.goto('/ayarlar');
  await expect(page).toHaveURL(/\/giris\?next=%2Fayarlar$/);
  await expect(page.getByRole('img', { name: 'kozmikarkan logosu' })).toBeVisible();
  await page.getByLabel('Şifre').fill('yanlis-sifre-00');
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Şifre hatalı.' })).toBeVisible();
  await page.getByLabel('Şifre').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/ayarlar$/);
});

test('Bugün sayfası tarihi Türkçe gösterir', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Bugün' })).toBeVisible();
  await expect(page.getByText(/\d{1,2} (Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık) \d{4}/)).toBeVisible();
});

test('çıkış yapınca oturum kapanır', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Çıkış yap' }).click();
  await expect(page).toHaveURL(/\/giris$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/giris$/);
});

test('robots.txt ve noindex başlığı', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(await response.text()).toContain('Disallow: /');
  expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
});

test.describe('mobil', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('alt menüden Ayarlar sayfasına gidilir', async ({ page }) => {
    await login(page);
    await page.getByRole('navigation', { name: 'Alt menü' }).getByRole('link', { name: 'Ayarlar' }).click();
    await expect(page).toHaveURL(/\/ayarlar$/);
  });
});
