import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('kullanıcı adı ve filigran ayarları kaydedilir, önizleme anında güncellenir', async ({ page }) => {
  await login(page, '/ayarlar');
  await page.getByLabel('Instagram kullanıcı adı').fill('@Burc.Studio ');
  await expect(page.getByTestId('watermark')).toHaveText('@burc.studio');
  await page.getByRole('radio', { name: 'Sağ alt' }).click();
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
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
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'yalnızca harf, rakam, nokta ve alt çizgi' })).toBeVisible();
});

test('otomatik üretim kapatılır ve temel hashtag kaydedilir', async ({ page }) => {
  await login(page, '/ayarlar');
  await page.getByRole('switch', { name: 'Her sabah otomatik üret' }).click();
  await page.getByLabel('1. temel hashtag').fill('Günlük Burç');
  await page.getByRole('button', { name: 'Üretim ayarlarını kaydet' }).click();
  await expect(page.getByText('Üretim ayarları kaydedildi.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Her sabah otomatik üret' })).not.toBeChecked();
  await expect(page.getByLabel('1. temel hashtag')).toHaveValue('#günlükburç');
  await expect(page.getByRole('table', { name: 'Son 7 günün sağlayıcı kullanımı' })).toBeVisible();
});

test('varsayılan gönderi formatı kaydedilir', async ({ page }) => {
  await login(page, '/ayarlar');
  await page.getByLabel('3:4 dikey (1080×1440)').check();
  await page.getByRole('button', { name: 'Üretim ayarlarını kaydet' }).click();
  await expect(page.getByText('Üretim ayarları kaydedildi.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('3:4 dikey (1080×1440)')).toBeChecked();
  await page.getByLabel('4:5 dikey (1080×1350)').check();
  await page.getByRole('button', { name: 'Üretim ayarlarını kaydet' }).click();
  await expect(page.getByText('Üretim ayarları kaydedildi.').first()).toBeVisible();
});
