import { expect, type Page } from '@playwright/test';
import { E2E_PASSWORD } from './constants';

export async function login(page: Page, path = '/') {
  await page.goto(path);
  await page.getByLabel('Şifre').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).not.toHaveURL(/\/giris/);
}
