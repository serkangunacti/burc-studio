import { describe, expect, it } from 'vitest';
import { automationStartReason } from './start';

describe('otomasyon başlangıç sınırı', () => {
  it('TSİ gece yarısını UTC gününden bağımsız uygular', () => {
    const start = '2026-10-05';
    expect(automationStartReason(start, start, new Date('2026-10-04T20:59:59.999Z'))).toContain(start);
    expect(automationStartReason(start, start, new Date('2026-10-04T21:00:00Z'))).toBeNull();
    expect(automationStartReason(start, start, new Date('2026-10-05T00:00:00Z'))).toBeNull();
  });

  it('başlangıç geçtikten sonra eski planları kalıcı olarak engeller', () => {
    expect(automationStartReason('2026-10-05', '2026-10-04', new Date('2026-10-06T12:00:00Z'))).not.toBeNull();
    expect(automationStartReason('2026-10-05', '2026-10-06', new Date('2026-10-06T12:00:00Z'))).toBeNull();
    expect(automationStartReason(null, '2026-10-04', new Date('2026-10-04T12:00:00Z'))).toBeNull();
  });
});
