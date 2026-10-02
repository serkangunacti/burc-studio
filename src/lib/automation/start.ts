import { istanbulDateKey, type DateKey } from '@/lib/date/istanbul';

// Hem gerçek zamanı hem planın tarihini denetler: gelecek gün erken, eski gün geç çalıştırılamaz.
export function automationStartReason(startDate: DateKey | null, date: DateKey, now = new Date()): string | null {
  if (!startDate) return null;
  if (date < startDate) return `Bu plan başlangıç tarihinden (${startDate}) önce; yeniden çalıştırılmayacak.`;
  if (istanbulDateKey(now) < startDate) return `Otomasyon ${startDate} 00:00 TSİ itibarıyla başlayacak.`;
  return null;
}
