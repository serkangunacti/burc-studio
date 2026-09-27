import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('paylaşım saatleri kaydedilir; bağlantı kartları kurulum adımını gösterir', async ({ page }) => {
  await login(page, '/ayarlar');
  await expect(page.getByText("Telegram'da @BotFather'a /newbot yaz")).toBeVisible();
  await page.getByLabel('Erkek tarot Reels saati').fill('23:15');
  await page.getByRole('button', { name: 'Paylaşım ayarlarını kaydet' }).click();
  await expect(page.getByText('Paylaşım saatleri kaydedildi.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Erkek tarot Reels saati')).toHaveValue('23:15');
  await page.getByLabel('Erkek tarot Reels saati').fill('22:00');
  await page.getByRole('button', { name: 'Paylaşım ayarlarını kaydet' }).click();
  await expect(page.getByText('Paylaşım saatleri kaydedildi.').first()).toBeVisible();
});

test('yanlış biçimli Telegram anahtarı servise gitmeden reddedilir', async ({ page }) => {
  await login(page, '/ayarlar');
  await page.getByLabel('Telegram bot anahtarı').fill('yanlis');
  await page.getByRole('button', { name: 'Bağla' }).first().click();
  await expect(page.getByRole('alert').filter({ hasText: 'Telegram bot anahtarına benzemiyor' })).toBeVisible();
});

test('paylaşımlar sayfası menüden açılır ve boş günü açıklar', async ({ page }) => {
  await login(page, '/');
  await page.getByRole('navigation', { name: 'Ana menü' }).getByRole('link', { name: 'Paylaşımlar' }).click();
  await expect(page.getByRole('heading', { name: 'Paylaşımlar' })).toBeVisible();
  await page.getByRole('link', { name: '← Önceki gün' }).click();
  await expect(page.getByText('Bu gün için hazırlanmış paylaşım yok.')).toBeVisible();
});
