export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  const url = new URL(next, 'http://yerel.invalid');
  if (url.origin !== 'http://yerel.invalid' || url.pathname.startsWith('/giris')) return '/';
  return `${url.pathname}${url.search}${url.hash}`;
}
