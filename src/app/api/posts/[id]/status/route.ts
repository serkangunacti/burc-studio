import { getDb } from '@/db/client';
import { handlePostStatus } from '@/lib/posts/http';

export async function POST(request: Request, ctx: RouteContext<'/api/posts/[id]/status'>) {
  const { id } = await ctx.params;
  return handlePostStatus(request, { db: getDb(), postId: id });
}
