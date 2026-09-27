import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

// AES-256-GCM; anahtar INTEGRATIONS_KEY (32 bayt, base64). Biçim: iv.tag.şifreli (base64url).
function keyFrom(encoded: string | undefined): Buffer {
  const key = Buffer.from(encoded ?? '', 'base64');
  if (key.length !== 32) throw new Error('INTEGRATIONS_KEY 32 baytlık base64 anahtar olmalı');
  return key;
}

export function encryptSecret(plain: string, encodedKey: string | undefined): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(encodedKey), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join('.');
}

export function decryptSecret(sealed: string, encodedKey: string | undefined): string {
  const [iv, tag, data] = sealed.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !data) throw new Error('Şifreli anahtar bozuk');
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(encodedKey), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// Telegram webhook'unun gizli başlığı otomasyon sırrından türetilir; ayrı bir env gerekmez.
export function telegramWebhookSecret(automationSecret: string): string {
  return createHmac('sha256', automationSecret).update('telegram-webhook').digest('hex');
}
