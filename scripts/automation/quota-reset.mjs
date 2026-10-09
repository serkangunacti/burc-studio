const ISTANBUL = 'Europe/Istanbul';
const PACIFIC = 'America/Los_Angeles';

function dateParts(value, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  return Object.fromEntries(parts.map(({type, value: part}) => [type, Number(part)]));
}

export function dateKeyInTimezone(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Tarih geçersiz');
  const parts = dateParts(date, timeZone);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function zonedMidnight(dateKey, timeZone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error('Tarih YYYY-AA-GG olmalı');
  const [year, month, day] = dateKey.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);
  if (new Date(target).toISOString().slice(0, 10) !== dateKey) throw new Error('Takvim tarihi geçersiz');
  let guess = target;
  // Resolve the timezone offset at the target midnight itself, including DST transition dates.
  for (let attempt = 0; attempt < 5; attempt++) {
    const local = dateParts(new Date(guess), timeZone);
    const represented = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    const adjustment = target - represented;
    if (adjustment === 0) return new Date(guess);
    guess += adjustment;
  }
  throw new Error(`Gece yarısı ${timeZone} saat dilimine çevrilemedi`);
}

export function istanbulDateKey(value) {
  return dateKeyInTimezone(value, ISTANBUL);
}

export function googleDailyQuotaResetForIstanbulDate(dateKey) {
  return zonedMidnight(dateKey, PACIFIC);
}

export function isGoogleQuotaResetForIstanbulDay(value = new Date()) {
  const now = value instanceof Date ? value : new Date(value);
  return Number.isFinite(now.getTime()) && now >= googleDailyQuotaResetForIstanbulDate(istanbulDateKey(now));
}

export function nextGoogleDailyQuotaReset(value = new Date()) {
  const now = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(now.getTime())) throw new Error('Tarih geçersiz');
  const pacificToday = dateKeyInTimezone(now, PACIFIC);
  const [year, month, day] = pacificToday.split('-').map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  return zonedMidnight(nextDate, PACIFIC);
}
