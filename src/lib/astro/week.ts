import { NextMoonQuarter, SearchMoonQuarter } from 'astronomy-engine';
import { addDays, formatDateShortTr, istanbulDateKey, istanbulDayStart, type DateKey } from '@/lib/date/istanbul';
import { getSign, signFromLongitude, type SignSlug } from '@/lib/zodiac/signs';
import { BODY_NAMES_TR, PLANETS, eclipticLongitude, getSkySnapshot } from './sky';

export type WeekSky = { monday: DateKey; label: string; sunSigns: SignSlug[]; events: string[] };

const QUARTER_NAMES = ['Yeni Ay', 'İlk Dördün', 'Dolunay', 'Son Dördün'] as const;

export function isMonday(date: DateKey): boolean {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 1;
}

export function weekLabelTr(monday: DateKey): string {
  return `${formatDateShortTr(monday)} – ${formatDateShortTr(addDays(monday, 6))}`;
}

export function getWeekSky(monday: DateKey): WeekSky {
  if (!isMonday(monday)) throw new Error('Haftalık gökyüzü pazartesi tarihiyle istenmeli');
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const snapshots = days.map((day) => getSkySnapshot(day));
  const before = getSkySnapshot(addDays(monday, -1));
  // Aynı gün içinde sıra: burç geçişleri, ay evresi, retro başlangıç ve bitişleri.
  const dated: { at: number; text: string }[] = [];

  snapshots.forEach((snapshot, index) => {
    const at = istanbulDayStart(snapshot.dateKey).getTime();
    const label = formatDateShortTr(snapshot.dateKey);
    for (const ingress of snapshot.ingresses) {
      if (ingress.body === 'Moon') continue;
      dated.push({ at: at + 1, text: `${label}: ${BODY_NAMES_TR[ingress.body]} ${getSign(ingress.sign).name} burcuna geçiyor.` });
    }
    const previous = index === 0 ? before : snapshots[index - 1];
    for (const planet of PLANETS) {
      const was = previous.retrogrades.includes(planet);
      const is = snapshot.retrogrades.includes(planet);
      if (!was && is) dated.push({ at: at + 3, text: `${label}: ${BODY_NAMES_TR[planet]} retrosu başlıyor.` });
      if (was && !is) dated.push({ at: at + 3, text: `${label}: ${BODY_NAMES_TR[planet]} retrosu bitiyor.` });
    }
  });

  const end = istanbulDayStart(addDays(monday, 7));
  for (let quarter = SearchMoonQuarter(istanbulDayStart(monday)); quarter.time.date < end; quarter = NextMoonQuarter(quarter)) {
    const key = istanbulDateKey(quarter.time.date);
    const sign = getSign(signFromLongitude(eclipticLongitude('Moon', quarter.time.date))).name;
    dated.push({ at: istanbulDayStart(key).getTime() + 2, text: `${formatDateShortTr(key)}: ${QUARTER_NAMES[quarter.quarter]} (${sign}).` });
  }

  return {
    monday,
    label: weekLabelTr(monday),
    sunSigns: [...new Set(snapshots.map((snapshot) => snapshot.sunSign))],
    events: dated.sort((a, b) => a.at - b.at).map((event) => event.text),
  };
}

export function describeWeekSkyTr(week: WeekSky): string {
  const sun =
    week.sunSigns.length === 1
      ? `Güneş hafta boyunca ${getSign(week.sunSigns[0]).name} burcunda.`
      : `Güneş bu hafta ${week.sunSigns.map((sign) => getSign(sign).name).join(' burcundan ')} burcuna geçiyor.`;
  return [sun, ...(week.events.length ? week.events : ['Bu hafta büyük bir gökyüzü olayı yok; mevcut akış sürüyor.'])].join('\n');
}
