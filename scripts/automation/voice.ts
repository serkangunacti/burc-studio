import { createHash } from 'node:crypto';
import { z } from 'zod';

const clipSchema = z.object({
  durationSeconds: z.number().positive().max(8),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  base64: z.string().min(10).max(24_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
const assetSchema = z.object({version:z.literal(1),intro:clipSchema,outro:clipSchema});

// Yalnız bir kez üretilmiş konuşma klipleri. Kişisel referans / üretim API anahtarı içermez.
export function decodeVoiceAsset(raw: string | undefined) {
  if (!raw) return null;
  const asset = assetSchema.parse(JSON.parse(raw));
  const decode = (clip:z.infer<typeof clipSchema>) => {
    const data = Buffer.from(clip.base64,'base64');
    if (createHash('sha256').update(data).digest('hex') !== clip.sha256) throw new Error('Ses varlığı doğrulanamadı');
    return {data,durationSeconds:clip.durationSeconds};
  };
  return {intro:decode(asset.intro),outro:decode(asset.outro)};
}
