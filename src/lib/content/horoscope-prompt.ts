import { describeSkyTr, type SkySnapshot } from '@/lib/astro/sky';
import { formatDateLongTr, formatDateShortTr, type DateKey } from '@/lib/date/istanbul';
import { SIGNS, getSign, type SignSlug } from '@/lib/zodiac/signs';
import { LUCKY_COLOR_IDS } from './lucky-colors';
import type { QualityIssue } from './quality';
import type { Audience, RecentHeadline } from './types';

export const HOROSCOPE_PROMPT_VERSION = 'burc-v1';

export const HOROSCOPE_INSTRUCTIONS = [
  "Sen Instagram'da paylaşılacak günlük burç yorumları yazan, Türkçe konuşan bir astroloji içerik yazarısın.",
  '',
  'Üslup:',
  '- Okura "sen" diye hitap et; sıcak, pozitif ve cesaretlendirici ol, yer yer hafif ve zararsız bir espri kat.',
  '- Her yorum somut bir öneri ya da küçük bir gözlem içersin; her burca uyacak genel cümlelerden kaçın.',
  '- Emoji ölçülü olsun: yorumda en fazla 2, kısa metinde ve başlıkta en fazla 1.',
  '- Sağlık, ilaç, yatırım, borsa, kripto ya da bahis konusunda talimat verme; korkutucu ya da kaderci kehanetlerde bulunma.',
  '- Kadın ve erkek okurlara yazılan yorumlar bakış açısı ve örnek senaryolar bakımından farklılaşsın; aşağılayıcı ya da klişe cinsiyet kalıplarına başvurma.',
  '- Astrolojiyi eğlenceli bir rehber gibi sun; kesin gelecek iddiasında bulunma.',
  '',
  'Biçim kuralları:',
  '- "baslik": en fazla 40 karakter.',
  '- "yorum": 280–420 karakter arası tek paragraf.',
  '- "kisa": en fazla 140 karakter; Reels videosunda gösterilecek özet.',
  '- "puanlar": ask, para ve saglik için 1–5 arası tam sayılar.',
  `- "sansliRenk": yalnızca şu kimliklerden biri: ${LUCKY_COLOR_IDS.join(', ')}.`,
  '- "sansliSayi": 1–99 arası tam sayı.',
  '- "kapakKanca": carousel kapağı için en fazla 60 karakterlik merak uyandıran cümle.',
  '- "caption": Instagram açıklaması; en fazla 700 karakter, hashtag içermez, okuru kaydetmeye ve arkadaşını etiketlemeye davet eder.',
  '- "hashtagler": en fazla 3 Türkçe hashtag önerisi.',
  '- Yanıtı yalnızca istenen JSON nesnesi olarak ver; önüne ya da arkasına açıklama ekleme.',
].join('\n');

export type HoroscopePromptInput = { dateKey: DateKey; audience: Audience; sky: SkySnapshot; recent: RecentHeadline[] };

const AUDIENCE_TEXT: Record<Audience, string> = {
  kadin: 'Bu yorumlar kadın okurlar için. Örneklerini ve senaryolarını onların gündelik hayatından seç.',
  erkek: 'Bu yorumlar erkek okurlar için. Örneklerini ve senaryolarını onların gündelik hayatından seç.',
};

const ENTRY_SHAPE =
  '{"burc": "koc", "baslik": "...", "yorum": "...", "kisa": "...", "puanlar": {"ask": 4, "para": 3, "saglik": 5}, "sansliRenk": "lila", "sansliSayi": 7}';

function recentSection(recent: RecentHeadline[]): string {
  if (recent.length === 0) return 'Son günlerde yazılmış yorum yok.';
  return [
    'Son günlerde yazdıkların (tekrar etme, farklı açılar bul):',
    ...recent.map((item) => `- ${formatDateShortTr(item.date)} ${getSign(item.sign).name}: ${item.headline} — ${item.short}`),
  ].join('\n');
}

function contextLines(input: HoroscopePromptInput): string[] {
  return [`Tarih: ${formatDateLongTr(input.dateKey)}.`, AUDIENCE_TEXT[input.audience], '', 'Günün gökyüzü:', describeSkyTr(input.sky), ''];
}

export function buildHoroscopeBatchPrompt(input: HoroscopePromptInput): { instructions: string; prompt: string } {
  const prompt = [
    ...contextLines(input),
    'Burçlar:',
    ...SIGNS.map((sign) => `- ${sign.name} (${sign.slug}, ${sign.dateRange}): ${sign.traits}`),
    '',
    recentSection(input.recent),
    '',
    'Her burç için bir yorum yaz ve şu JSON biçiminde yanıt ver:',
    `{"kapakKanca": "...", "caption": "...", "hashtagler": ["#..."], "burclar": [${ENTRY_SHAPE}]}`,
    '"burclar" dizisinde 12 burcun her biri tam bir kez, yukarıdaki sırayla ve "burc" alanında parantez içindeki kimlikle yer almalı.',
  ].join('\n');
  return { instructions: HOROSCOPE_INSTRUCTIONS, prompt };
}

export function buildHoroscopeSignPrompt(
  input: HoroscopePromptInput & { sign: SignSlug; issues: QualityIssue[] },
): { instructions: string; prompt: string } {
  const sign = getSign(input.sign);
  const prompt = [
    ...contextLines(input),
    `Yalnızca şu burç için yaz: ${sign.name} (${sign.slug}), ${sign.dateRange}: ${sign.traits}`,
    '',
    recentSection(input.recent.filter((item) => item.sign === input.sign)),
    '',
    ...(input.issues.length
      ? ['Önceki denemede şu sorunlar vardı, bunları düzelt:', ...input.issues.map((issue) => `- ${issue.field}: ${issue.message}`), '']
      : []),
    'Şu JSON biçiminde yanıt ver:',
    `{"burc": ${ENTRY_SHAPE.replace('"koc"', `"${sign.slug}"`)}}`,
  ].join('\n');
  return { instructions: HOROSCOPE_INSTRUCTIONS, prompt };
}
