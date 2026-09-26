import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.join(process.cwd(), 'src/remotion/templates/pastel-v1-reels');

// pastel@1 Reels'i yayımlanmış videolarda kullanılıyor; değişiklik yeni klasörde (pastel-v2-reels) yapılır.
const FROZEN: Record<string, string> = {
  'index.ts': '6aa9b89ca0a4778fe369ecaf224c2f9bdfe522ad52811415a7728edcced48676',
  'intro-scene.tsx': 'aa27817041a65fba85e92caad2562eb69f3449a5f55dbec7256ef8bf5531c569',
  'motion.ts': 'd618b1315a8aab163e8c5048db466b3180e9d34e28ab48a63c00811a46db89e7',
  'outro-scene.tsx': 'ff8245710635722bbb0f619766eadab0e7b36919bb6db9c1eab628031e128e98',
  'reels.tsx': '1d0c1a9434037fe5ac2bf9770a4e67b90174304ae2109f0004596cc350825fe3',
  'sign-scene.tsx': 'bbae85433c81f10d97730e22ed1a4fd35b32b38bce480983e3e9766fdc382514',
  'watermark.tsx': 'ee27e93c472f617d13a137672ed4f59c0dac43240e0d63bdf13b9228d284b0ac',
};

describe('pastel@1 Reels', () => {
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
