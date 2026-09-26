import { foldTurkish } from '@/lib/text/turkish';

export const SIGN_SLUGS = ['koc', 'boga', 'ikizler', 'yengec', 'aslan', 'basak', 'terazi', 'akrep', 'yay', 'oglak', 'kova', 'balik'] as const;
export type SignSlug = (typeof SIGN_SLUGS)[number];
export type Element = 'ates' | 'toprak' | 'hava' | 'su';
export type Sign = { slug: SignSlug; name: string; glyph: string; dateRange: string; element: Element; ruler: string; traits: string };

// Glifler U+FE0E ile biter: iOS'ta renkli emoji yerine metin olarak çizilsin.
export const SIGNS: readonly Sign[] = [
  { slug: 'koc', name: 'Koç', glyph: '♈︎', dateRange: '21 Mart – 19 Nisan', element: 'ates', ruler: 'Mars', traits: 'cesur, girişken, sabırsız, enerjik' },
  { slug: 'boga', name: 'Boğa', glyph: '♉︎', dateRange: '20 Nisan – 20 Mayıs', element: 'toprak', ruler: 'Venüs', traits: 'sabırlı, güvenilir, keyfine düşkün, inatçı' },
  { slug: 'ikizler', name: 'İkizler', glyph: '♊︎', dateRange: '21 Mayıs – 20 Haziran', element: 'hava', ruler: 'Merkür', traits: 'meraklı, konuşkan, çok yönlü, kararsız' },
  { slug: 'yengec', name: 'Yengeç', glyph: '♋︎', dateRange: '21 Haziran – 22 Temmuz', element: 'su', ruler: 'Ay', traits: 'duygusal, koruyucu, sezgisel, alıngan' },
  { slug: 'aslan', name: 'Aslan', glyph: '♌︎', dateRange: '23 Temmuz – 22 Ağustos', element: 'ates', ruler: 'Güneş', traits: 'cömert, özgüvenli, yaratıcı, ilgi seven' },
  { slug: 'basak', name: 'Başak', glyph: '♍︎', dateRange: '23 Ağustos – 22 Eylül', element: 'toprak', ruler: 'Merkür', traits: 'titiz, analitik, yardımsever, eleştirel' },
  { slug: 'terazi', name: 'Terazi', glyph: '♎︎', dateRange: '23 Eylül – 22 Ekim', element: 'hava', ruler: 'Venüs', traits: 'uyumlu, zarif, adil, kararsız' },
  { slug: 'akrep', name: 'Akrep', glyph: '♏︎', dateRange: '23 Ekim – 21 Kasım', element: 'su', ruler: 'Plüton', traits: 'tutkulu, derin, kararlı, gizemli' },
  { slug: 'yay', name: 'Yay', glyph: '♐︎', dateRange: '22 Kasım – 21 Aralık', element: 'ates', ruler: 'Jüpiter', traits: 'özgür ruhlu, iyimser, maceracı, dobra' },
  { slug: 'oglak', name: 'Oğlak', glyph: '♑︎', dateRange: '22 Aralık – 19 Ocak', element: 'toprak', ruler: 'Satürn', traits: 'disiplinli, hırslı, sorumluluk sahibi, ağırbaşlı' },
  { slug: 'kova', name: 'Kova', glyph: '♒︎', dateRange: '20 Ocak – 18 Şubat', element: 'hava', ruler: 'Uranüs', traits: 'özgün, yenilikçi, bağımsız, mesafeli' },
  { slug: 'balik', name: 'Balık', glyph: '♓︎', dateRange: '19 Şubat – 20 Mart', element: 'su', ruler: 'Neptün', traits: 'hayalperest, şefkatli, sezgisel, dağınık' },
];

const BY_SLUG = Object.fromEntries(SIGNS.map((sign) => [sign.slug, sign])) as Record<SignSlug, Sign>;
const ENGLISH_NAMES: Record<string, SignSlug> = {
  aries: 'koc', taurus: 'boga', gemini: 'ikizler', cancer: 'yengec', leo: 'aslan', virgo: 'basak',
  libra: 'terazi', scorpio: 'akrep', sagittarius: 'yay', capricorn: 'oglak', aquarius: 'kova', pisces: 'balik',
};

export function getSign(slug: SignSlug): Sign {
  return BY_SLUG[slug];
}

export function signFromLongitude(longitude: number): SignSlug {
  const normalized = ((longitude % 360) + 360) % 360;
  return SIGN_SLUGS[Math.floor(normalized / 30)];
}

export function normalizeSignName(input: string): SignSlug | null {
  const folded = foldTurkish(input).replace(/burcu$/, '');
  if ((SIGN_SLUGS as readonly string[]).includes(folded)) return folded as SignSlug;
  return ENGLISH_NAMES[folded] ?? null;
}
