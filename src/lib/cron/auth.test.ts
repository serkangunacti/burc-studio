import { describe, expect, it } from 'vitest';
import { isAuthorizedCronRequest } from './auth';

const headers = (authorization?: string) => new Headers(authorization ? { authorization } : {});

describe('isAuthorizedCronRequest', () => {
  it('doğru Bearer anahtarını kabul eder', () => {
    expect(isAuthorizedCronRequest(headers('Bearer gizli-anahtar'), 'gizli-anahtar')).toBe(true);
  });

  it.each([undefined, 'Bearer yanlis', 'gizli-anahtar', 'Bearer gizli-anahtarX'])('%s reddedilir', (value) => {
    expect(isAuthorizedCronRequest(headers(value), 'gizli-anahtar')).toBe(false);
  });

  it('CRON_SECRET tanımlı değilse her istek reddedilir', () => {
    expect(isAuthorizedCronRequest(headers('Bearer '), undefined)).toBe(false);
    expect(isAuthorizedCronRequest(headers('Bearer '), '')).toBe(false);
  });
});
