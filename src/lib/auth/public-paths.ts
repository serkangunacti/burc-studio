const PUBLIC_EXACT = new Set(['/giris']);
const PUBLIC_PREFIXES = ['/api/auth/', '/api/cron/'];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
