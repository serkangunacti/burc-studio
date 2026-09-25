import { eq, sql } from 'drizzle-orm';
import { loginAttempts } from '@/db/schema';
import type { Db } from '@/db/types';

export const MAX_FAILED_ATTEMPTS = 5;
export const WINDOW_MS = 15 * 60 * 1000;

export type LoginAllowance = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export async function checkLoginAllowed(db: Db, ip: string, now: Date = new Date()): Promise<LoginAllowance> {
  const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.ip, ip));
  if (!row) return { allowed: true };
  const elapsed = now.getTime() - row.windowStart.getTime();
  if (elapsed >= WINDOW_MS || row.count < MAX_FAILED_ATTEMPTS) return { allowed: true };
  return { allowed: false, retryAfterSeconds: Math.ceil((WINDOW_MS - elapsed) / 1000) };
}

export async function recordFailedLogin(db: Db, ip: string, now: Date = new Date()): Promise<void> {
  const windowExpired = sql`${loginAttempts.windowStart} <= ${new Date(now.getTime() - WINDOW_MS).toISOString()}::timestamptz`;
  await db
    .insert(loginAttempts)
    .values({ ip, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: loginAttempts.ip,
      set: {
        count: sql`case when ${windowExpired} then 1 else ${loginAttempts.count} + 1 end`,
        windowStart: sql`case when ${windowExpired} then ${now.toISOString()}::timestamptz else ${loginAttempts.windowStart} end`,
      },
    });
}

export async function clearLoginAttempts(db: Db, ip: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.ip, ip));
}
