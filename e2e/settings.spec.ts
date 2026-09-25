import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('kullanıcı adı ve filigran ayarları kaydedilir, önizleme anında güncellenir', async ({ page }) => {
  await login(page, '/ayarlar');
  await page.getByLabel('Instagram kullanıcı adı').fill('@Burc.Studio ');
  await expect(page.getByTestId('watermark')).toHaveText('@burc.studio');
  await page.getByRole('radio', { name: 'Sağ alt' }).click();
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByText('Ayarlar kaydedildi.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Instagram kullanıcı adı')).toHaveValue('burc.studio');
  await expect(page.getByRole('radio', { name: 'Sağ alt' })).toBeChecked();
});

test('filigran kapatılınca önizlemeden kalkar', async ({ page }) => {
  await login(page, '/ayarlar');
  await page.getByLabel('Instagram kullanıcı adı').fill('burc.studio');
  await expect(page.getByTestId('watermark')).toBeVisible();
  await page.getByRole('switch', { name: 'Filigranı göster' }).click();
  await expect(page.getByTestId('watermark')).toHaveCount(0);
});

test('geçersiz kullanıcı adı hata gösterir', async ({ page }) => {
  await login(page, '/ayarlar');
  await page.getByLabel('Instagram kullanıcı adı').fill('foo bar');
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'yalnızca harf, rakam, nokta ve alt çizgi' })).toBeVisible();
});
