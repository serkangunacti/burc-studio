import { getDb } from '@/db/client';
import { handleMedia } from '@/lib/automation/http';

export async function GET(_request: Request, ctx: RouteContext<'/api/media/[id]'>) {
  const { id } = await ctx.params;
  return handleMedia(id, { db: getDb() });
}
