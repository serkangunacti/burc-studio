export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  const url = new URL(next, 'http://yerel.invalid');
  // Nokta segmentleri çözümlendikten sonra `//host` oluşabilir; kontrol normalize edilmiş çıktıya yapılır.
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (url.origin !== 'http://yerel.invalid' || path.startsWith('//') || url.pathname.startsWith('/giris')) return '/';
  return path;
}
