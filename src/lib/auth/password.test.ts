import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('şifre özeti', () => {
  it('doğru şifre doğrulanır, yanlışı reddedilir', async () => {
    const hash = await hashPassword('dogru-sifre-1234');
    expect(hash).toMatch(/^scrypt:16384:8:1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(await verifyPassword('dogru-sifre-1234', hash)).toBe(true);
    expect(await verifyPassword('yanlis-sifre-1234', hash)).toBe(false);
  });

  it('aynı şifrenin iki özeti tuz nedeniyle farklıdır', async () => {
    expect(await hashPassword('dogru-sifre-1234')).not.toBe(await hashPassword('dogru-sifre-1234'));
  });

  it("özet '$' içermez (.env genişletmesi bozmasın)", async () => {
    expect(await hashPassword('dogru-sifre-1234')).not.toContain('$');
  });

  it('Türkçe karakterler farklı Unicode biçiminde yazılsa da doğrulanır', async () => {
    const hash = await hashPassword('Güneş-Ay-Yıldız-2026');
    expect(await verifyPassword('Güneş-Ay-Yıldız-2026'.normalize('NFD'), hash)).toBe(true);
  });

  it('bozuk özet false döner', async () => {
    expect(await verifyPassword('x', 'bozuk')).toBe(false);
    expect(await verifyPassword('x', 'scrypt:1:2:3:abc')).toBe(false);
  });

  it('12 karakterden kısa şifre reddedilir', async () => {
    await expect(hashPassword('kisa')).rejects.toThrow('12');
  });
});
