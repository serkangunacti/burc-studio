import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from './session';

export async function requireSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) throw new Error('Oturum gerekli');
}
