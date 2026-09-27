import { describeSkyTr, type SkySnapshot } from '@/lib/astro/sky';
import { formatDateLongTr, formatDateShortTr, type DateKey } from '@/lib/date/istanbul';
import type { TarotCard } from '@/lib/tarot/deck';
import { SIGNS, getSign, type SignSlug } from '@/lib/zodiac/signs';
import { LUCKY_COLOR_IDS } from './lucky-colors';
import type { QualityIssue } from './quality';
import type { Audience, RecentHeadline } from './types';

export const TAROT_PROMPT_VERSION = 'tarot-v1';

export const TAROT_INSTRUCTIONS = [
  "Sen Instagram'da paylaşılacak günlük tarot yorumları yazan, Türkçe konuşan bir tarot ve astroloji içerik yazarısın.",
  '',
  'Üslup:',
  '- Okura "sen" diye hitap et; sıcak, pozitif ve cesaretlendirici ol, yer yer hafif ve zararsız bir espri kat.',
  '- Her burç için sana verilen günün kartının anlamını o burcun bugününe yorumla; kartın adını yorumda doğal biçimde an.',
  '- Kartlar düz (ters değil) çekildi; zorlu kartları (Ölüm, Kule, Şeytan gibi) dönüşüm, uyanış ve farkındalık olarak anlat, korkutucu ya da kaderci kehanetlerde bulunma.',
  '- Her yorum somut bir öneri ya da küçük bir gözlem içersin; her burca uyacak genel cümlelerden kaçın.',
  '- Emoji ölçülü olsun: yorumda en fazla 2, kısa metinde ve başlıkta en fazla 1.',
  '- Sağlık, ilaç, yatırım, borsa, kripto ya da bahis konusunda talimat verme.',
  '- Kadın ve erkek okurlara yazılan yorumlar bakış açısı ve örnek senaryolar bakımından farklılaşsın; aşağılayıcı ya da klişe cinsiyet kalıplarına başvurma.',
  '',
  'Biçim kuralları:',
  '- "baslik": en fazla 40 karakter; kartın mesajını özetlesin.',
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

export type TarotPromptInput = { dateKey: DateKey; audience: Audience; sky: SkySnapshot; cards: ReadonlyMap<SignSlug, TarotCard>; recent: RecentHeadline[] };

const AUDIENCE_TEXT: Record<Audience, string> = {
  kadin: 'Bu yorumlar kadın okurlar için. Örneklerini ve senaryolarını onların gündelik hayatından seç.',
  erkek: 'Bu yorumlar erkek okurlar için. Örneklerini ve senaryolarını onların gündelik hayatından seç.',
};

const ENTRY_SHAPE =
  '{"burc": "koc", "baslik": "...", "yorum": "...", "kisa": "...", "puanlar": {"ask": 4, "para": 3, "saglik": 5}, "sansliRenk": "lila", "sansliSayi": 7}';

function signLine(sign: SignSlug, cards: ReadonlyMap<SignSlug, TarotCard>): string {
  const info = getSign(sign);
  const card = cards.get(sign);
  return `- ${info.name} (${info.slug}, ${info.dateRange}): ${info.traits}${card ? ` — günün kartı: ${card.name} (${card.keywords})` : ''}`;
}

function contextLines(input: TarotPromptInput): string[] {
  return ['GÜNLÜK TAROT', `Tarih: ${formatDateLongTr(input.dateKey)}.`, AUDIENCE_TEXT[input.audience], '', 'Günün gökyüzü:', describeSkyTr(input.sky), ''];
}

function recentSection(recent: RecentHeadline[]): string {
  if (recent.length === 0) return 'Son günlerde yazılmış tarot yorumu yok.';
  return [
    'Son günlerde yazdıkların (tekrar etme, farklı açılar bul):',
    ...recent.map((item) => `- ${formatDateShortTr(item.date)} ${getSign(item.sign).name}: ${item.headline} — ${item.short}`),
  ].join('\n');
}

export function buildTarotBatchPrompt(input: TarotPromptInput): { instructions: string; prompt: string } {
  const prompt = [
    ...contextLines(input),
    'Burçlar ve günün kartları:',
    ...SIGNS.map((sign) => signLine(sign.slug, input.cards)),
    '',
    recentSection(input.recent),
    '',
    'Her burç için günün kartını yorumla ve şu JSON biçiminde yanıt ver:',
    `{"kapakKanca": "...", "caption": "...", "hashtagler": ["#..."], "burclar": [${ENTRY_SHAPE}]}`,
    '"burclar" dizisinde 12 burcun her biri tam bir kez, yukarıdaki sırayla ve "burc" alanında parantez içindeki kimlikle yer almalı.',
  ].join('\n');
  return { instructions: TAROT_INSTRUCTIONS, prompt };
}

export function buildTarotSignPrompt(input: TarotPromptInput & { sign: SignSlug; issues: QualityIssue[] }): { instructions: string; prompt: string } {
  const sign = getSign(input.sign);
  const prompt = [
    ...contextLines(input),
    `Yalnızca şu burç için yaz: ${sign.name} (${sign.slug})`,
    signLine(input.sign, input.cards),
    '',
    recentSection(input.recent.filter((item) => item.sign === input.sign)),
    '',
    ...(input.issues.length
      ? ['Önceki denemede şu sorunlar vardı, bunları düzelt:', ...input.issues.map((issue) => `- ${issue.field}: ${issue.message}`), '']
      : []),
    'Şu JSON biçiminde yanıt ver:',
    `{"burc": ${ENTRY_SHAPE.replace('"koc"', `"${sign.slug}"`)}}`,
  ].join('\n');
  return { instructions: TAROT_INSTRUCTIONS, prompt };
}
