export function getClientIp(headers: Headers): string {
  const vercelIp = headers.get('x-vercel-ip')?.trim();
  if (vercelIp) return vercelIp;
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return 'unknown';
}
