import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { istanbulDateKey } from '../src/lib/date/istanbul';
import { LONGEST_BODY } from '../src/remotion/fixtures';
import { downloadPostZip, freshPost, login } from './helpers';
import { jpegSize } from './jpeg';

async function bodiesFit(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-slot="body"]')].every((element) => element.scrollHeight <= element.clientHeight + 1),
  );
}

async function save(page: Page) {
  await page.getByRole('button', { name: 'Değişiklikleri kaydet' }).click();
  await expect(page.getByText('Yeni sürüm kaydedildi.').first()).toBeVisible();
}

test('gönderi 14 JPEG ve caption içeren ZIP olarak indirilir, durum İndirildi olur', async ({ page }) => {
  await login(page);
  const id = await freshPost(page);
  await page.goto(`/gonderi/${id}`);
  await expect(page.getByRole('button', { name: /^Slayt \d+:/ })).toHaveCount(14);
  const files = await downloadPostZip(page);
  const date = istanbulDateKey();
  const names = Object.keys(files).sort();
  expect(names).toHaveLength(15);
  expect(names).toEqual(expect.arrayContaining([`${date}_kadin-burc_01-kapak.jpg`, `${date}_kadin-burc_06-aslan.jpg`, `${date}_kadin-burc_14-kapanis.jpg`, 'caption.txt']));
  for (const name of names.filter((entry) => entry.endsWith('.jpg'))) {
    expect(jpegSize(files[name])).toEqual({ width: 1080, height: 1350 });
  }
  expect(new TextDecoder().decode(files['caption.txt'])).toContain('#yıldızlar');
  await expect(page.getByTestId('post-status')).toHaveText('İndirildi');
});

test('en uzun yorum iki formatta da kartına sığar, Türkçe harfler yüklenen fontla çizilir', async ({ page }) => {
  await login(page);
  const id = await freshPost(page);
  await page.goto(`/gonderi/${id}`);
  await page.getByRole('button', { name: /^Slayt 10: Yay/ }).click();
  await page.getByLabel('Başlık').fill('Çığır açan, güçlü bir gün İstanbul!');
  await page.getByLabel('Yorum', { exact: true }).fill(LONGEST_BODY);
  await save(page);
  await expect(page).not.toHaveURL(new RegExp(id));
  expect(await bodiesFit(page)).toBe(true);

  const fontsLoaded = await page.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts].filter((face) => face.status === 'loaded');
    const covers = (range: string, codePoint: number) =>
      range.split(',').some((part) => {
        const [low, high] = part.trim().slice(2).split('-');
        return codePoint >= parseInt(low, 16) && codePoint <= parseInt(high ?? low, 16);
      });
    const drawsTurkish = (family: string) =>
      [...'ğşıİöüçĞŞÖÜÇ'].every((char) =>
        faces.some((face) => face.family.replaceAll('"', '') === family && covers(face.unicodeRange, char.codePointAt(0)!)),
      );
    return drawsTurkish('Fraunces') && drawsTurkish('Nunito');
  });
  expect(fontsLoaded).toBe(true);

  await page.getByLabel('3:4 (1080×1440)').check();
  await save(page);
  expect(await bodiesFit(page)).toBe(true);
  const files = await downloadPostZip(page);
  expect(jpegSize(files[`${istanbulDateKey()}_kadin-burc_10-yay.jpg`])).toEqual({ width: 1080, height: 1440 });
});

test('eski sürüm salt okunurdur ve güncel sürüme bağlantı verir', async ({ page }) => {
  await login(page);
  const id = await freshPost(page);
  await page.goto(`/gonderi/${id}`);
  await page.getByLabel('Caption').fill('Eski sürüm testi için yeni açıklama.');
  await save(page);
  await page.goto(`/gonderi/${id}`);
  await expect(page.getByText('Bu eski bir sürüm; yalnızca indirilebilir.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Değişiklikleri kaydet' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Güncel sürüme git' }).click();
  await expect(page.getByLabel('Caption')).toHaveValue('Eski sürüm testi için yeni açıklama.');
});

test('caption kopyalanır, paylaşıldı işaretlenir, tek burç yenilenince yeni sürüme gidilir', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await login(page);
  const id = await freshPost(page);
  await page.goto(`/gonderi/${id}`);
  await page.getByRole('button', { name: "Caption'ı kopyala" }).click();
  await expect(page.getByText('Caption kopyalandı.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('#yıldızlar');
  await page.getByRole('button', { name: 'Paylaşıldı olarak işaretle' }).click();
  await expect(page.getByTestId('post-status')).toHaveText('Paylaşıldı');
  await expect(page.getByRole('button', { name: 'Paylaşıldı işaretini kaldır' })).toBeVisible();

  await page.getByRole('button', { name: /^Slayt 6: Aslan/ }).click();
  await page.getByRole('button', { name: 'Aslan yorumunu yeniden üret' }).click();
  await expect(page.getByText('Aslan yorumu yenilendi.')).toBeVisible({ timeout: 30_000 });
  await expect(page).not.toHaveURL(new RegExp(id));
});

test('geçersiz düzenleme alan hatası gösterir ve sürüm açmaz', async ({ page }) => {
  await login(page);
  const id = await freshPost(page);
  await page.goto(`/gonderi/${id}`);
  await page.getByLabel('Caption').fill('Hashtag yasak #burç');
  await page.getByRole('button', { name: 'Değişiklikleri kaydet' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Caption hashtag içermemeli' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(id));
});

test('her slayt sağ üst köşesindeki butonla tek başına JPEG olarak indirilir', async ({ page }) => {
  await login(page);
  const id = await freshPost(page);
  await page.goto(`/gonderi/${id}`);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Aslan slaytını indir' }).click()]);
  expect(download.suggestedFilename()).toBe(`${istanbulDateKey()}_kadin-burc_06-aslan.jpg`);
  expect(jpegSize(new Uint8Array(await readFile(await download.path())))).toEqual({ width: 1080, height: 1350 });
  await page.getByLabel('Caption').fill('Kaydedilmemiş değişiklik varken tek slayt indirilemez.');
  await expect(page.getByRole('button', { name: 'Kapak slaytını indir' })).toBeDisabled();
});

test('yalnızca boşluk eklenen kayıt sürüm açmaz ve indirmeyi kilitli bırakmaz', async ({ page }) => {
  await login(page);
  const id = await freshPost(page);
  await page.goto(`/gonderi/${id}`);
  const caption = page.getByLabel('Caption');
  await caption.fill(`${await caption.inputValue()}   `);
  await page.getByRole('button', { name: 'Değişiklikleri kaydet' }).click();
  await expect(page.getByText('Değişiklik yok.')).toBeVisible();
  await expect(page.getByText('Kaydedilmemiş değişiklikler var.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Kapak slaytını indir' })).toBeEnabled();
  await expect(page).toHaveURL(new RegExp(id));
});
