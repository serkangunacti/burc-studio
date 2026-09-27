import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, telegramWebhookSecret } from './secrets';

const KEY = randomBytes(32).toString('base64');

describe('anahtar şifreleme', () => {
  it('şifreler, çözer ve her seferinde farklı çıktı üretir', () => {
    const sealed = encryptSecret('IGAA-gizli', KEY);
    expect(sealed).not.toContain('IGAA');
    expect(encryptSecret('IGAA-gizli', KEY)).not.toBe(sealed);
    expect(decryptSecret(sealed, KEY)).toBe('IGAA-gizli');
  });

  it('başka anahtarla ya da bozulmuş veriyle çözmez', () => {
    const sealed = encryptSecret('IGAA-gizli', KEY);
    expect(() => decryptSecret(sealed, randomBytes(32).toString('base64'))).toThrow();
    expect(() => decryptSecret(`${sealed.slice(0, -2)}xx`, KEY)).toThrow();
    expect(() => encryptSecret('x', undefined)).toThrow('INTEGRATIONS_KEY');
  });

  it('webhook sırrı Telegramın izin verdiği karakterlerden oluşur ve kararlıdır', () => {
    expect(telegramWebhookSecret('s')).toMatch(/^[a-f0-9]{64}$/);
    expect(telegramWebhookSecret('s')).toBe(telegramWebhookSecret('s'));
  });
});
