import { getDb } from '@/db/client';
import { handleLogin } from '@/lib/auth/login-handler';

export async function POST(request: Request) {
  return handleLogin(request, { db: getDb(), passwordHash: process.env.APP_PASSWORD_HASH });
}
