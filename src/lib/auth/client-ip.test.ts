import { describe, expect, it } from 'vitest';
import { getClientIp } from './client-ip';

describe('getClientIp', () => {
  it('öncelikle güvenilir x-vercel-ip başlığını alır', () => {
    expect(getClientIp(new Headers({ 'x-vercel-ip': '203.0.113.99', 'x-forwarded-for': '10.0.0.1' }))).toBe('203.0.113.99');
  });

  it('x-vercel-ip yoksa x-real-ip başlığını alır', () => {
    expect(getClientIp(new Headers({ 'x-real-ip': '198.51.100.2', 'x-forwarded-for': '10.0.0.1' }))).toBe('198.51.100.2');
  });

  it('x-real-ip yoksa x-forwarded-for listesinin ilk adresini alır', () => {
    expect(getClientIp(new Headers({ 'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1' }))).toBe('203.0.113.7');
  });

  it('başlık yoksa unknown döner', () => {
    expect(getClientIp(new Headers())).toBe('unknown');
    expect(getClientIp(new Headers({ 'x-forwarded-for': ' , ' }))).toBe('unknown');
  });
});
