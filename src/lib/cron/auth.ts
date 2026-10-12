import { timingSafeEqual } from 'node:crypto';

export function isAuthorizedCronRequest(headers: Headers, secret: string | undefined | (string | undefined)[]): boolean {
  if (!secret) return false;
  const list = Array.isArray(secret) ? secret : [secret];
  const received = Buffer.from(headers.get('authorization') ?? '');
  for (const s of list) {
    if (!s) continue;
    const expected = Buffer.from(`Bearer ${s}`);
    if (received.length === expected.length && timingSafeEqual(received, expected)) return true;
  }
  return false;
}
