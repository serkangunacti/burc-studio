import {describe,expect,it} from 'vitest';
import {googleDailyQuotaResetForIstanbulDate,isGoogleQuotaResetForIstanbulDay,nextGoogleDailyQuotaReset} from './quota-reset.mjs';

describe('Gemini günlük kota sıfırlama zamanı',()=>{
  it('Türkiye takvim tarihinin Pasifik gece yarısı karşılığını DST ile hesaplar',()=>{
    expect(googleDailyQuotaResetForIstanbulDate('2026-10-09').toISOString()).toBe('2026-10-09T07:00:00.000Z');
    expect(googleDailyQuotaResetForIstanbulDate('2026-11-02').toISOString()).toBe('2026-11-02T08:00:00.000Z');
  });
  it('9 Ekimde 10:00, Kasım kış saatinde 11:00 öncesi renderı bekletir',()=>{
    expect(isGoogleQuotaResetForIstanbulDay(new Date('2026-10-09T06:59:59Z'))).toBe(false);
    expect(isGoogleQuotaResetForIstanbulDay(new Date('2026-10-09T07:00:00Z'))).toBe(true);
    expect(isGoogleQuotaResetForIstanbulDay(new Date('2026-11-02T07:10:00Z'))).toBe(false);
    expect(isGoogleQuotaResetForIstanbulDay(new Date('2026-11-02T08:10:00Z'))).toBe(true);
  });
  it('kotası dolmuş anahtarı sıradaki Pasifik gece yarısında yeniden açar',()=>{
    expect(nextGoogleDailyQuotaReset(new Date('2026-10-09T12:00:00Z')).toISOString()).toBe('2026-10-10T07:00:00.000Z');
    expect(nextGoogleDailyQuotaReset(new Date('2026-11-01T20:00:00Z')).toISOString()).toBe('2026-11-02T08:00:00.000Z');
  });
});
