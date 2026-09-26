import { describeWeekSkyTr, type WeekSky } from '@/lib/astro/week';
import type { DateKey } from '@/lib/date/istanbul';
import type { TarotCard } from '@/lib/tarot/deck';
import { SIGNS, getSign, type SignSlug } from '@/lib/zodiac/signs';
import { LUCKY_COLOR_IDS } from './lucky-colors';
import type { QualityIssue } from './quality';
import type { Audience, RecentHeadline } from './types';

export const WEEKLY_PROMPT_VERSION = 'haftalik-v1';

export const WEEKLY_INSTRUCTIONS = [
  "Sen Instagram'da her pazartesi paylaşılan haftalık burç yorumları yazan, Türkçe konuşan bir astroloji içerik yazarısın.",
  '',
  'Üslup:',
  '- Okura "sen" diye hitap et; sıcak, pozitif, cesaretlendirici ol, yer yer hafif ve zararsız bir espri kat.',
  '- Haftayı geniş bir bakışla anlat: haftanın başı, ortası ve sonu için somut öneriler ve küçük senaryolar ver; her burca uyacak genel cümlelerden kaçın.',
  '- Her burç için sana verilen haftanın kartının temasını yorumun içine doğal biçimde ör; kartın adını, "tarot" ya da "kart" kelimesini kullanma, metni burç ve tarot diye bölme.',
  '- Gökyüzü olaylarını gündelik dille yorumla; teknik terimleri gerekiyorsa tek cümleyle aç.',
  '- Bir olaydan gün adıyla söz edeceksen gün adlarını gökyüzü listesindeki tarihlerle birebir kullan; listede olmayan bir güne olay yakıştırma.',
  '- Emoji ölçülü olsun: yorumda en fazla 3, kısa metinde ve başlıkta en fazla 1.',
  '- Sağlık, ilaç, yatırım, borsa, kripto ya da bahis konusunda talimat verme; korkutucu ya da kaderci kehanetlerde bulunma.',
  '- Kadın ve erkek okurlara yazılan yorumlar bakış açısı ve örneklerle farklılaşsın; aşağılayıcı ya da klişe cinsiyet kalıplarına başvurma; "Koç kadını" gibi kalıplarla hitap etme.',
  '',
  'Biçim kuralları:',
  '- "baslik": en fazla 40 karakter; burcun adını başlıkta tekrarlama, kartta zaten yazıyor.',
  '- "yorum": 600–850 karakter arası TEK paragraf; satır sonu kullanma.',
  '- "kisa": en fazla 140 karakter; haftanın özü.',
  '- "puanlar": ask, para ve saglik için haftalık 1–5 arası tam sayılar.',
  `- "sansliRenk": yalnızca şu kimliklerden biri: ${LUCKY_COLOR_IDS.join(', ')}.`,
  '- "sansliSayi": 1–99 arası tam sayı.',
  '- "kapakKanca": carousel kapağı için en fazla 60 karakterlik, haftayı özetleyen merak uyandıran cümle.',
  '- "caption": Instagram açıklaması; en fazla 700 karakter, hashtag içermez, okuru kaydetmeye ve arkadaşını etiketlemeye davet eder.',
  '- "hashtagler": en fazla 3 Türkçe hashtag önerisi.',
  '- Yanıtı yalnızca istenen JSON nesnesi olarak ver; önüne ya da arkasına açıklama ekleme.',
].join('\n');

export type WeeklyPromptInput = {
  monday: DateKey;
  audience: Audience;
  week: WeekSky;
  cards: ReadonlyMap<SignSlug, TarotCard>;
  recent: RecentHeadline[];
};

const AUDIENCE_TEXT: Record<Audience, string> = {
  kadin: 'Bu yorumlar kadın okurlar için. Örneklerini ve senaryolarını onların gündelik hayatından seç.',
  erkek: 'Bu yorumlar erkek okurlar için. Örneklerini ve senaryolarını onların gündelik hayatından seç.',
};

const ENTRY_SHAPE =
  '{"burc": "koc", "baslik": "...", "yorum": "...", "kisa": "...", "puanlar": {"ask": 4, "para": 3, "saglik": 5}, "sansliRenk": "lila", "sansliSayi": 7}';

function signLine(sign: SignSlug, cards: ReadonlyMap<SignSlug, TarotCard>): string {
  const info = getSign(sign);
  const card = cards.get(sign);
  return `- ${info.name} (${info.slug}, ${info.dateRange}): ${info.traits}${card ? ` — haftanın kartı: ${card.name} (${card.keywords})` : ''}`;
}

function contextLines(input: WeeklyPromptInput): string[] {
  return ['HAFTALIK YORUM', `Hafta: ${input.week.label}.`, AUDIENCE_TEXT[input.audience], '', 'Haftanın gökyüzü:', describeWeekSkyTr(input.week), ''];
}

function recentSection(recent: RecentHeadline[]): string {
  if (recent.length === 0) return 'Geçen hafta yazılmış yorum yok.';
  return ['Geçen hafta yazdıkların (tekrar etme):', ...recent.map((item) => `- ${getSign(item.sign).name}: ${item.headline} — ${item.short}`)].join('\n');
}

export function buildWeeklyBatchPrompt(input: WeeklyPromptInput): { instructions: string; prompt: string } {
  const prompt = [
    ...contextLines(input),
    'Burçlar:',
    ...SIGNS.map((sign) => signLine(sign.slug, input.cards)),
    '',
    recentSection(input.recent),
    '',
    'Her burç için bir haftalık yorum yaz ve şu JSON biçiminde yanıt ver:',
    `{"kapakKanca": "...", "caption": "...", "hashtagler": ["#..."], "burclar": [${ENTRY_SHAPE}]}`,
    '"burclar" dizisinde 12 burcun her biri tam bir kez, yukarıdaki sırayla ve "burc" alanında parantez içindeki kimlikle yer almalı.',
  ].join('\n');
  return { instructions: WEEKLY_INSTRUCTIONS, prompt };
}

export function buildWeeklySignPrompt(input: WeeklyPromptInput & { sign: SignSlug; issues: QualityIssue[] }): { instructions: string; prompt: string } {
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
  return { instructions: WEEKLY_INSTRUCTIONS, prompt };
}
