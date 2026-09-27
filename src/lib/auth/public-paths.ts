const PUBLIC_EXACT = new Set(['/giris']);
// Otomasyon uçları kendi sırlarıyla korunur (cron/otomasyon Bearer, Telegram gizli başlığı, kuyruk imzası);
// medya uçları tahmin edilemez kimlikle Instagram'ın çekebileceği herkese açık görsellerdir.
const PUBLIC_PREFIXES = ['/api/auth/', '/api/cron/', '/api/automation/', '/api/telegram/', '/api/queues/', '/api/media/'];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
