import { z } from 'zod';
import { isUniqueViolation } from '@/db/errors';
import type { Db } from '@/db/types';
import { editPost } from './edit';
import { postEditSchema } from './edit-schema';
import { markPostDownloaded, setPostPublished } from './repository';

type Deps = { db: Db; postId: string; now?: Date };

const statusSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('downloaded') }),
  z.object({ action: z.literal('published'), value: z.boolean() }),
]);

const BAD_REQUEST = () => Response.json({ error: 'Geçersiz istek.' }, { status: 400 });
const NOT_FOUND = () => Response.json({ error: 'Gönderi bulunamadı.' }, { status: 404 });

export async function handleEditPost(request: Request, deps: Deps): Promise<Response> {
  const parsed = postEditSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return BAD_REQUEST();
  try {
    const result = await editPost(deps.db, deps.postId, parsed.data, deps.now);
    if (result.status === 'invalid') return Response.json({ error: 'Bazı alanlar geçersiz.', errors: result.errors }, { status: 400 });
    if (result.status === 'not-found') return NOT_FOUND();
    if (result.status === 'stale') return Response.json({ error: 'Bu sürüm artık güncel değil.', currentId: result.currentId }, { status: 409 });
    return Response.json(result);
  } catch (error) {
    if (isUniqueViolation(error)) return Response.json({ error: 'Gönderi bu sırada değişti; sayfayı yenile.' }, { status: 409 });
    throw error;
  }
}

export async function handlePostStatus(request: Request, deps: Deps): Promise<Response> {
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return BAD_REQUEST();
  const row =
    parsed.data.action === 'downloaded'
      ? await markPostDownloaded(deps.db, deps.postId, deps.now)
      : await setPostPublished(deps.db, deps.postId, parsed.data.value, deps.now);
  return row ? Response.json({ status: row.status }) : NOT_FOUND();
}
