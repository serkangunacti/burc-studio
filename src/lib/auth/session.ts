import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'bs_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SUBJECT = 'owner';

function sessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET tanımlı değil ya da 32 karakterden kısa');
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(SUBJECT)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(sessionKey());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  let key: Uint8Array;
  try {
    key = sessionKey();
  } catch (error) {
    console.error(error);
    return false;
  }
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    return payload.sub === SUBJECT;
  } catch {
    return false;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/' as const,
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
