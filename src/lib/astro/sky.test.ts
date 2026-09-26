import { describe, expect, it } from 'vitest';
import { describeSkyTr, getSkySnapshot, moonPhaseName, skyHeadlineTr } from './sky';

describe('moonPhaseName', () => {
  it.each([
    [0, 'yeni-ay'],
    [350, 'yeni-ay'],
    [45, 'hilal'],
    [90, 'ilk-dordun'],
    [151.6, 'buyuyen-ay'],
    [175.9, 'dolunay'],
    [225, 'kuculen-ay'],
    [270, 'son-dordun'],
    [315, 'balsamik-ay'],
  ])('%s° → %s', (angle, expected) => {
    expect(moonPhaseName(angle)).toBe(expected);
  });
});

describe('getSkySnapshot', () => {
  it("Güneş 23 Eylül'de Terazi'ye geçer", () => {
    expect(getSkySnapshot('2026-09-22').sunSign).toBe('basak');
    const equinox = getSkySnapshot('2026-09-23');
    expect(equinox.sunSign).toBe('terazi');
    expect(equinox.ingresses).toContainEqual({ body: 'Sun', sign: 'terazi' });
  });

  it("26 Eylül öğleninde Ay Balık'ta ve evresi dolunaydır", () => {
    const sky = getSkySnapshot('2026-09-26');
    expect(sky.moonPhase).toBe('dolunay');
    expect(sky.moonSign).toBe('balik');
  });

  it("24 Eylül'den bakınca yaklaşan olay Koç'taki dolunaydır", () => {
    const sky = getSkySnapshot('2026-09-24');
    expect(sky.moonPhase).toBe('buyuyen-ay');
    expect(sky.upcomingLunation).toEqual({ kind: 'dolunay', dateKey: '2026-09-26', sign: 'koc' });
  });

  it('Merkür retrosunu doğru tarihlerde bulur', () => {
    expect(getSkySnapshot('2026-03-10').retrogrades).toContain('Mercury');
    expect(getSkySnapshot('2026-04-01').retrogrades).not.toContain('Mercury');
    expect(getSkySnapshot('2026-10-30').retrogrades).toContain('Mercury');
    expect(getSkySnapshot('2026-11-20').retrogrades).not.toContain('Mercury');
  });
});

describe('Türkçe gökyüzü özetleri', () => {
  it('prompt özeti burç ve evre adlarını içerir', () => {
    const text = describeSkyTr(getSkySnapshot('2026-09-24'));
    expect(text).toContain('Güneş Terazi burcunda.');
    expect(text).toContain('Ay Balık burcunda; evresi: Büyüyen Ay.');
    expect(text).toContain('Yaklaşan: 26 Eylül tarihinde Koç burcunda Dolunay.');
  });

  it('arayüz başlığı tek satırdır', () => {
    expect(skyHeadlineTr(getSkySnapshot('2026-09-26'))).toMatch(/^Güneş: Terazi · Ay: Balık · Dolunay/);
  });
});
