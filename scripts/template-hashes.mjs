import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.join('src/remotion/templates', process.argv[2] ?? 'pastel-v1');
const hashes = Object.fromEntries(
  readdirSync(dir)
    .filter((file) => !/\.test\.tsx?$/.test(file))
    .sort()
    .map((file) => [file, createHash('sha256').update(readFileSync(path.join(dir, file))).digest('hex')]),
);
console.log(JSON.stringify(hashes, null, 2));
