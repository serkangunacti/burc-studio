import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.join(process.cwd(), 'src/remotion/templates/pastel-v1');

// pastel@1 yayımlanmış gönderilerde kullanılıyor; görünüm değişikliği yeni klasörde (pastel-v2) yapılır.
const FROZEN: Record<string, string> = {
  'cover-slide.tsx': 'cf8163ab127ee12f2476956b804e39a9d40e573bf3603faafe731d70c9bcd717',
  'cta-slide.tsx': 'cd56b52267af4fd3e18c034c9b59cf0395e1c0b10dda0838600af777b908214d',
  'fonts.ts': '2c713f62b2cbeb3aabe09133894c8fe5b89f8b1b45d0122b1dea1c00741e35ab',
  'index.ts': '9676ce7db1595db0f28bee42f9804722d20bd2be12c75d1a30a3658116362b93',
  'ornaments.tsx': 'e634d44e11dd117207aefa28a21d05872e7aaff8e9293217bff6e67ba6e62a40',
  'sign-slide.tsx': '59c09918da3c590adffc921d5113276a2d0307d7342de11f3ca36a65ce55e48c',
  'slide.tsx': 'eff9dbaeebf2c976c0eb171cb4a3bcd407244f994460b0380236070744425b6d',
  'tokens.ts': 'd84cd3350ea2e684d9905d0f75323887d24abf922152fd1d3e6a9432be9d0b01',
  'watermark.tsx': 'b08cf8bb1de6f1632f23990241a9667a20d37d0d28443b8169ecae98d3adcf2a',
  'zodiac.tsx': 'e55d3b26d40d185a0202405592a83810f8262dc8c7eb4e49fdcffbba0df447cd',
};

describe('pastel@1', () => {
  it('dondurulmuş şablon dosyaları değişmedi', () => {
    const actual = Object.fromEntries(
      readdirSync(DIR)
        .filter((file) => !/\.test\.tsx?$/.test(file))
        .sort()
        .map((file) => [file, createHash('sha256').update(readFileSync(path.join(DIR, file))).digest('hex')]),
    );
    expect(actual).toEqual(FROZEN);
  });
});
