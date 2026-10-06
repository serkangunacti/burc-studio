import { getDb } from '@/db/client';
import { requireSession } from '@/lib/auth/require-session';
import { handlePostStatus } from '@/lib/posts/http';

export async function POST(request: Request, ctx: RouteContext<'/api/posts/[id]/status'>) {
  try {
    await requireSession();
  } catch {
    return Response.json({ error: 'Oturum gerekli.' }, { status: 401 });
  }
  const { id } = await ctx.params;
  return handlePostStatus(request, { db: getDb(), postId: id });
}
