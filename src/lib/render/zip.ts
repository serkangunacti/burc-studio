import { zipSync, type Zippable } from 'fflate';

export type ZipEntry = { name: string; data: Uint8Array };

export function buildZip(entries: readonly ZipEntry[]): Uint8Array {
  const tree: Zippable = {};
  for (const entry of entries) {
    if (entry.name in tree) throw new Error(`Aynı adlı iki dosya: ${entry.name}`);
    // JPEG zaten sıkıştırılmış; tekrar sıkıştırmak yalnızca süre harcar.
    tree[entry.name] = [entry.data, { level: 0 }];
  }
  return zipSync(tree);
}
