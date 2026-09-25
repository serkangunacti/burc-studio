import { describe, expect, it } from 'vitest';
import { getClientIp } from './client-ip';

describe('getClientIp', () => {
  it("x-forwarded-for listesinin ilk adresini alır", () => {
    expect(getClientIp(new Headers({ 'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1' }))).toBe('203.0.113.7');
  });

  it("x-real-ip başlığına düşer", () => {
    expect(getClientIp(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
  });

  it('başlık yoksa unknown döner', () => {
    expect(getClientIp(new Headers())).toBe('unknown');
    expect(getClientIp(new Headers({ 'x-forwarded-for': ' , ' }))).toBe('unknown');
  });
});
