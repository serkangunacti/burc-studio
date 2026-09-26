export type DateKey = string;

const TIME_ZONE = 'Europe/Istanbul';
const keyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const longFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const shortFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'long',
});

export function istanbulDateKey(instant: Date = new Date()): DateKey {
  return keyFormatter.format(instant);
}

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// TSİ 2016'dan beri sabit UTC+3 (yaz saati yok); sabit ofset bu yüzden güvenli.
export function istanbulDayStart(key: DateKey): Date {
  return new Date(`${key}T00:00:00+03:00`);
}

export function istanbulNoon(key: DateKey): Date {
  return new Date(`${key}T12:00:00+03:00`);
}

export function formatDateLongTr(key: DateKey): string {
  return longFormatter.format(istanbulNoon(key));
}

export function formatDateShortTr(key: DateKey): string {
  return shortFormatter.format(istanbulNoon(key));
}

export function weekLabelTr(monday: DateKey): string {
  return `${formatDateShortTr(monday)} – ${formatDateShortTr(addDays(monday, 6))}`;
}
