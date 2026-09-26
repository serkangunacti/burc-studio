import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.join(process.cwd(), 'src/remotion/templates/pastel-v1');

// pastel@1 yayımlanmış gönderilerde kullanılıyor; görünüm değişikliği yeni klasörde (pastel-v2) yapılır.
const FROZEN: Record<string, string> = {
  'cover-slide.tsx': 'cf8163ab127ee12f2476956b804e39a9d40e573bf3603faafe731d70c9bcd717',
  'cta-slide.tsx': '2aa475e4706f994b71d1618269b7c8a57eb15a523c97e00dc632a93e813ebf07',
  'fonts.ts': '2c713f62b2cbeb3aabe09133894c8fe5b89f8b1b45d0122b1dea1c00741e35ab',
  'index.ts': '9676ce7db1595db0f28bee42f9804722d20bd2be12c75d1a30a3658116362b93',
  'ornaments.tsx': 'e634d44e11dd117207aefa28a21d05872e7aaff8e9293217bff6e67ba6e62a40',
  'sign-slide.tsx': '3022f95d887c1774423fefdd1154144226efd292fb46ae654e2cfe29e7cc9747',
  'slide.tsx': 'eff9dbaeebf2c976c0eb171cb4a3bcd407244f994460b0380236070744425b6d',
  'tokens.ts': 'd84cd3350ea2e684d9905d0f75323887d24abf922152fd1d3e6a9432be9d0b01',
  'watermark.tsx': '5a07495980e9877c4c257dc989cff701f8ce938e2d9565d08f7f02a5df7ad475',
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
