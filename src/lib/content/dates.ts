import { addDays, isDateKey, type DateKey } from '@/lib/date/istanbul';

export function isAllowedGenerationDate(date: unknown, today: DateKey): date is DateKey {
  return isDateKey(date) && date >= addDays(today, -7) && date <= addDays(today, 1);
}
