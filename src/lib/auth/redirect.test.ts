import { describe, expect, it } from 'vitest';
import { safeNextPath } from './redirect';

describe('safeNextPath', () => {
  it.each([
    ['/ayarlar', '/ayarlar'],
    ['/burclar?kitle=erkek', '/burclar?kitle=erkek'],
    ['https://evil.com', '/'],
    ['//evil.com/x', '/'],
    ['/\\evil.com', '/'],
    ['javascript:alert(1)', '/'],
    ['/giris', '/'],
    ['', '/'],
    [null, '/'],
    [undefined, '/'],
  ])('%s → %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
