import { z } from 'zod';
import type { DateKey } from '@/lib/date/istanbul';
import { AllProvidersFailedError, NoProvidersConfiguredError } from '@/lib/llm/router';
import { SIGN_SLUGS } from '@/lib/zodiac/signs';
import { isAllowedGenerationDate } from './dates';
import { generateHoroscopeSet, regenerateSign, type GenerationDeps } from './horoscope-service';
import { PostConflictError } from './repository';

export type HttpDeps = GenerationDeps & { today: DateKey };

const audienceSchema = z.enum(['kadin', 'erkek']);
const generateSchema = z.object({ date: z.string(), audience: audienceSchema, force: z.boolean().optional() });
const signSchema = z.object({ date: z.string(), audience: audienceSchema, sign: z.enum(SIGN_SLUGS) });

const BAD_REQUEST = () => Response.json({ error: 'Geçersiz istek.' }, { status: 400 });
const BUSY = () => Response.json({ error: 'Bu içerik şu anda üretiliyor.' }, { status: 409 });

async function readBody<T>(request: Request, schema: z.ZodType<T>, today: DateKey): Promise<T | null> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return null;
  const date = (parsed.data as { date: string }).date;
  return isAllowedGenerationDate(date, today) ? parsed.data : null;
}

function failure(error: unknown): Response {
  if (error instanceof NoProvidersConfiguredError) return Response.json({ error: error.message }, { status: 503 });
  if (error instanceof PostConflictError) return Response.json({ error: error.message }, { status: 409 });
  if (error instanceof AllProvidersFailedError) {
    return Response.json(
      {
        error: 'Tüm yapay zekâ sağlayıcıları başarısız oldu. Ayarlar sayfasındaki kullanım tablosuna bak ya da yerel üretimi dene.',
        attempts: error.attempts.map((attempt) => ({ provider: attempt.providerId, status: attempt.status, error: attempt.error })),
      },
      { status: 502 },
    );
  }
  throw error;
}

export async function handleGenerate(request: Request, deps: HttpDeps): Promise<Response> {
  const body = await readBody(request, generateSchema, deps.today);
  if (!body) return BAD_REQUEST();
  try {
    const result = await generateHoroscopeSet(deps, { date: body.date, audience: body.audience, trigger: 'button', skipIfExists: !body.force });
    return result.status === 'busy' ? BUSY() : Response.json(result);
  } catch (error) {
    return failure(error);
  }
}

export async function handleRegenerateSign(request: Request, deps: HttpDeps): Promise<Response> {
  const body = await readBody(request, signSchema, deps.today);
  if (!body) return BAD_REQUEST();
  try {
    const result = await regenerateSign(deps, body);
    if (result.status === 'missing') return Response.json({ error: 'Önce bu günün yorumlarını üret.' }, { status: 404 });
    return result.status === 'busy' ? BUSY() : Response.json(result);
  } catch (error) {
    return failure(error);
  }
}
