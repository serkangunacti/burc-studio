import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const KEY_LENGTH = 64;
const COST = { N: 16384, r: 8, p: 1 };
const MAX_MEMORY = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, cost: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password.normalize('NFKC'), salt, KEY_LENGTH, { ...cost, maxmem: MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

// Ayraç ':' — '$' kullanılırsa Next'in .env genişletmesi özeti bozar.
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) throw new Error('Şifre en az 12 karakter olmalı');
  const salt = randomBytes(16);
  const key = await derive(password, salt, COST);
  return ['scrypt', COST.N, COST.r, COST.p, salt.toString('base64'), key.toString('base64')].join(':');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, key] = parts;
  const expected = Buffer.from(key, 'base64');
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await derive(password, Buffer.from(salt, 'base64'), { N: Number(n), r: Number(r), p: Number(p) });
  return timingSafeEqual(actual, expected);
}
