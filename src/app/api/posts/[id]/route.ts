import { getDb } from '@/db/client';
import { requireSession } from '@/lib/auth/require-session';
import { handleEditPost } from '@/lib/posts/http';

export async function PATCH(request: Request, ctx: RouteContext<'/api/posts/[id]'>) {
  try {
    await requireSession();
  } catch {
    return Response.json({ error: 'Oturum gerekli.' }, { status: 401 });
  }
  const { id } = await ctx.params;
  return handleEditPost(request, { db: getDb(), postId: id });
}
