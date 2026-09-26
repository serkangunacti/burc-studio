import { Body, Ecliptic, EclipticGeoMoon, GeoVector, MoonPhase, NextMoonQuarter, SearchMoonQuarter, SunPosition } from 'astronomy-engine';
import { formatDateShortTr, istanbulDateKey, istanbulDayStart, istanbulNoon, type DateKey } from '@/lib/date/istanbul';
import { getSign, signFromLongitude, type SignSlug } from '@/lib/zodiac/signs';

export const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
export type Planet = (typeof PLANETS)[number];
export type SkyBody = 'Sun' | 'Moon' | Planet;

export const BODY_NAMES_TR: Record<SkyBody, string> = {
  Sun: 'Güneş', Moon: 'Ay', Mercury: 'Merkür', Venus: 'Venüs', Mars: 'Mars',
  Jupiter: 'Jüpiter', Saturn: 'Satürn', Uranus: 'Uranüs', Neptune: 'Neptün', Pluto: 'Plüton',
};

export type MoonPhaseName = 'yeni-ay' | 'hilal' | 'ilk-dordun' | 'buyuyen-ay' | 'dolunay' | 'kuculen-ay' | 'son-dordun' | 'balsamik-ay';
const PHASE_ORDER: MoonPhaseName[] = ['yeni-ay', 'hilal', 'ilk-dordun', 'buyuyen-ay', 'dolunay', 'kuculen-ay', 'son-dordun', 'balsamik-ay'];
export const MOON_PHASE_NAMES_TR: Record<MoonPhaseName, string> = {
  'yeni-ay': 'Yeni Ay', hilal: 'Hilal', 'ilk-dordun': 'İlk Dördün', 'buyuyen-ay': 'Büyüyen Ay',
  dolunay: 'Dolunay', 'kuculen-ay': 'Küçülen Ay', 'son-dordun': 'Son Dördün', 'balsamik-ay': 'Balsamik Ay',
};

export type Lunation = { kind: 'yeni-ay' | 'dolunay'; dateKey: DateKey; sign: SignSlug };
export type SkySnapshot = {
  dateKey: DateKey;
  sunSign: SignSlug;
  moonSign: SignSlug;
  moonPhase: MoonPhaseName;
  retrogrades: Planet[];
  ingresses: { body: SkyBody; sign: SignSlug }[];
  upcomingLunation: Lunation | null;
};

const DAY_MS = 86_400_000;
const INGRESS_BODIES: SkyBody[] = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

export function moonPhaseName(angle: number): MoonPhaseName {
  const normalized = ((angle % 360) + 360) % 360;
  return PHASE_ORDER[Math.floor(((normalized + 22.5) % 360) / 45)];
}

export function eclipticLongitude(body: SkyBody, at: Date): number {
  if (body === 'Sun') return SunPosition(at).elon;
  if (body === 'Moon') return EclipticGeoMoon(at).lon;
  return Ecliptic(GeoVector(Body[body], at, true)).elon;
}

function isRetrograde(planet: Planet, at: Date): boolean {
  let motion = eclipticLongitude(planet, new Date(at.getTime() + DAY_MS / 2)) - eclipticLongitude(planet, new Date(at.getTime() - DAY_MS / 2));
  if (motion > 180) motion -= 360;
  if (motion < -180) motion += 360;
  return motion < 0;
}

function findUpcomingLunation(from: Date, days: number): Lunation | null {
  const until = from.getTime() + days * DAY_MS;
  for (let quarter = SearchMoonQuarter(from); quarter.time.date.getTime() < until; quarter = NextMoonQuarter(quarter)) {
    if (quarter.quarter === 0 || quarter.quarter === 2) {
      return {
        kind: quarter.quarter === 0 ? 'yeni-ay' : 'dolunay',
        dateKey: istanbulDateKey(quarter.time.date),
        sign: signFromLongitude(eclipticLongitude('Moon', quarter.time.date)),
      };
    }
  }
  return null;
}

export function getSkySnapshot(dateKey: DateKey): SkySnapshot {
  const noon = istanbulNoon(dateKey);
  const dayStart = istanbulDayStart(dateKey);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);
  return {
    dateKey,
    sunSign: signFromLongitude(eclipticLongitude('Sun', noon)),
    moonSign: signFromLongitude(eclipticLongitude('Moon', noon)),
    moonPhase: moonPhaseName(MoonPhase(noon)),
    retrogrades: PLANETS.filter((planet) => isRetrograde(planet, noon)),
    ingresses: INGRESS_BODIES.flatMap((body) => {
      const before = signFromLongitude(eclipticLongitude(body, dayStart));
      const after = signFromLongitude(eclipticLongitude(body, dayEnd));
      return before === after ? [] : [{ body, sign: after }];
    }),
    upcomingLunation: findUpcomingLunation(dayStart, 3),
  };
}

export function describeSkyTr(sky: SkySnapshot): string {
  const lines = [
    `Güneş ${getSign(sky.sunSign).name} burcunda.`,
    `Ay ${getSign(sky.moonSign).name} burcunda; evresi: ${MOON_PHASE_NAMES_TR[sky.moonPhase]}.`,
    sky.retrogrades.length
      ? `Retrodaki gezegenler: ${sky.retrogrades.map((planet) => BODY_NAMES_TR[planet]).join(', ')}.`
      : 'Retroda gezegen yok.',
    ...sky.ingresses.map(({ body, sign }) => `Bugün ${BODY_NAMES_TR[body]} ${getSign(sign).name} burcuna geçiyor.`),
  ];
  if (sky.upcomingLunation) {
    const { kind, dateKey, sign } = sky.upcomingLunation;
    lines.push(`Yaklaşan: ${formatDateShortTr(dateKey)} tarihinde ${getSign(sign).name} burcunda ${kind === 'dolunay' ? 'Dolunay' : 'Yeni Ay'}.`);
  }
  return lines.join('\n');
}

export function skyHeadlineTr(sky: SkySnapshot): string {
  const parts = [
    `Güneş: ${getSign(sky.sunSign).name}`,
    `Ay: ${getSign(sky.moonSign).name}`,
    MOON_PHASE_NAMES_TR[sky.moonPhase],
  ];
  if (sky.retrogrades.length) parts.push(`Retro: ${sky.retrogrades.map((planet) => BODY_NAMES_TR[planet]).join(', ')}`);
  return parts.join(' · ');
}
