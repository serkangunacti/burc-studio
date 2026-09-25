import { NextResponse } from 'next/server';
import type { Db } from '@/db/types';
import { getClientIp } from './client-ip';
import { verifyPassword } from './password';
import { checkLoginAllowed, clearLoginAttempts, recordFailedLogin } from './rate-limit';
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from './session';

export type LoginDeps = { db: Db; passwordHash: string | undefined; now?: Date };

export async function handleLogin(request: Request, deps: LoginDeps): Promise<NextResponse> {
  const now = deps.now ?? new Date();
  const ip = getClientIp(request.headers);

  const allowance = await checkLoginAllowed(deps.db, ip, now);
  if (!allowance.allowed) {
    const minutes = Math.ceil(allowance.retryAfterSeconds / 60);
    return NextResponse.json(
      { error: `Çok fazla hatalı deneme. ${minutes} dakika sonra tekrar dene.` },
      { status: 429, headers: { 'Retry-After': String(allowance.retryAfterSeconds) } },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const password =
    typeof body === 'object' && body !== null && 'password' in body && typeof body.password === 'string'
      ? body.password
      : null;
  if (password === null) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 });

  if (!deps.passwordHash) {
    console.error('APP_PASSWORD_HASH tanımlı değil; giriş kapalı');
    return NextResponse.json({ error: 'Sunucu yapılandırması eksik.' }, { status: 503 });
  }

  if (!(await verifyPassword(password, deps.passwordHash))) {
    await recordFailedLogin(deps.db, ip, now);
    return NextResponse.json({ error: 'Şifre hatalı.' }, { status: 401 });
  }

  await clearLoginAttempts(deps.db, ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions());
  return response;
}
