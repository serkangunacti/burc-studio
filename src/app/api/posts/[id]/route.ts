import { getDb } from '@/db/client';
import { handleEditPost } from '@/lib/posts/http';

export async function PATCH(request: Request, ctx: RouteContext<'/api/posts/[id]'>) {
  const { id } = await ctx.params;
  return handleEditPost(request, { db: getDb(), postId: id });
}
