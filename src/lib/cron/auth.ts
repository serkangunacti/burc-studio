import { timingSafeEqual } from 'node:crypto';

export function isAuthorizedCronRequest(headers: Headers, secret: string | undefined): boolean {
  if (!secret) return false;
  const received = Buffer.from(headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
