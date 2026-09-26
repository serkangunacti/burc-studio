import { eq, sql } from 'drizzle-orm';
import { loginAttempts } from '@/db/schema';
import type { Db } from '@/db/types';

export const MAX_FAILED_ATTEMPTS = 5;
export const WINDOW_MS = 15 * 60 * 1000;

export type LoginAllowance = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export async function clearLoginAttempts(db: Db, ip: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.ip, ip));
}

export async function reserveLoginAttempt(db: Db, ip: string, now: Date = new Date()): Promise<LoginAllowance> {
  const windowExpired = sql`${loginAttempts.windowStart} <= ${new Date(now.getTime() - WINDOW_MS).toISOString()}::timestamptz`;
  const [row] = await db
    .insert(loginAttempts)
    .values({ ip, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: loginAttempts.ip,
      set: {
        count: sql`case when ${windowExpired} then 1 else ${loginAttempts.count} + 1 end`,
        windowStart: sql`case when ${windowExpired} then ${now.toISOString()}::timestamptz else ${loginAttempts.windowStart} end`,
      },
    })
    .returning({ count: loginAttempts.count, windowStart: loginAttempts.windowStart });
  if (row.count <= MAX_FAILED_ATTEMPTS) return { allowed: true };
  const remaining = WINDOW_MS - (now.getTime() - row.windowStart.getTime());
  return { allowed: false, retryAfterSeconds: Math.ceil(remaining / 1000) };
}
