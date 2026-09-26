import { countEmoji, graphemeLength, looksTurkish } from '@/lib/text/turkish';
import { SIGN_SLUGS, getSign, normalizeSignName, type SignSlug } from '@/lib/zodiac/signs';
import { mergeHashtags } from './hashtags';
import type { HoroscopeBatchRaw, HoroscopeEntryRaw, HoroscopeSingleRaw } from './horoscope-schema';
import { LUCKY_COLOR_IDS, normalizeLuckyColor, type LuckyColorId } from './lucky-colors';

export const MAX_FAILED_SIGNS = 6;

export type QualityIssue = { field: string; message: string };
export type HoroscopeEntry = {
  sign: SignSlug;
  headline: string;
  body: string;
  short: string;
  scores: { love: number; money: number; health: number };
  luckyColor: LuckyColorId;
  luckyNumber: number;
};
export type HoroscopePostFields = { coverHook: string; caption: string; hashtags: string[] };
export type BatchCheck = {
  entries: Map<SignSlug, HoroscopeEntry>;
  failedSigns: { sign: SignSlug; issues: QualityIssue[] }[];
  post: HoroscopePostFields | null;
  postIssues: QualityIssue[];
};

const BANNED_PHRASES = [
  'doktora gitmene gerek yok',
  'ilacını bırak',
  'yatırım tavsiyesi',
  'hisse senedi al',
  'kripto al',
  'bahis oyna',
  'kaza geçireceksin',
  'hastalanacaksın',
  'öleceksin',
  'ayrılacaksınız',
];

function textIssues(field: string, text: string, limits: { min: number; max: number; maxEmoji: number }): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const length = graphemeLength(text.trim());
  if (length < limits.min || length > limits.max) {
    issues.push({ field, message: `${limits.min}-${limits.max} karakter olmalı (şu an ${length}).` });
  }
  if (countEmoji(text) > limits.maxEmoji) issues.push({ field, message: `En fazla ${limits.maxEmoji} emoji kullanılmalı.` });
  const lower = text.toLocaleLowerCase('tr-TR');
  const banned = BANNED_PHRASES.find((phrase) => lower.includes(phrase));
  if (banned) issues.push({ field, message: `Yasaklı ifade: "${banned}".` });
  return issues;
}

function scoreIssues(raw: HoroscopeEntryRaw): QualityIssue[] {
  return (['ask', 'para', 'saglik'] as const).flatMap((key) => {
    const value = raw.puanlar[key];
    return Number.isInteger(value) && value >= 1 && value <= 5
      ? []
      : [{ field: `puanlar.${key}`, message: '1 ile 5 arasında tam sayı olmalı.' }];
  });
}

export function checkHoroscopeEntry(raw: HoroscopeEntryRaw): { sign: SignSlug | null; entry: HoroscopeEntry | null; issues: QualityIssue[] } {
  const sign = normalizeSignName(raw.burc);
  const luckyColor = normalizeLuckyColor(raw.sansliRenk);
  const issues: QualityIssue[] = [
    ...(sign ? [] : [{ field: 'burc', message: `Tanınmayan burç adı: "${raw.burc}".` }]),
    ...textIssues('baslik', raw.baslik, { min: 3, max: 40, maxEmoji: 1 }),
    ...textIssues('yorum', raw.yorum, { min: 280, max: 420, maxEmoji: 2 }),
    ...textIssues('kisa', raw.kisa, { min: 20, max: 140, maxEmoji: 1 }),
    ...(looksTurkish(`${raw.baslik} ${raw.yorum} ${raw.kisa}`) ? [] : [{ field: 'yorum', message: 'Metin Türkçe görünmüyor.' }]),
    ...scoreIssues(raw),
    ...(luckyColor ? [] : [{ field: 'sansliRenk', message: `Şu kimliklerden biri olmalı: ${LUCKY_COLOR_IDS.join(', ')}.` }]),
    ...(Number.isInteger(raw.sansliSayi) && raw.sansliSayi >= 1 && raw.sansliSayi <= 99
      ? []
      : [{ field: 'sansliSayi', message: '1 ile 99 arasında tam sayı olmalı.' }]),
  ];
  if (issues.length > 0 || !sign || !luckyColor) return { sign, entry: null, issues };
  return {
    sign,
    issues: [],
    entry: {
      sign,
      headline: raw.baslik.trim(),
      body: raw.yorum.trim(),
      short: raw.kisa.trim(),
      scores: { love: raw.puanlar.ask, money: raw.puanlar.para, health: raw.puanlar.saglik },
      luckyColor,
      luckyNumber: raw.sansliSayi,
    },
  };
}

export function checkSingleSign(raw: HoroscopeSingleRaw, expected: SignSlug): { entry: HoroscopeEntry | null; issues: QualityIssue[] } {
  const { sign, entry, issues } = checkHoroscopeEntry(raw.burc);
  if (sign !== expected) return { entry: null, issues: [{ field: 'burc', message: `${getSign(expected).name} için yazılmalıydı.` }] };
  return { entry, issues };
}

export function checkHoroscopeBatch(raw: HoroscopeBatchRaw, baseHashtags: readonly string[]): BatchCheck {
  const entries = new Map<SignSlug, HoroscopeEntry>();
  const issuesBySign = new Map<SignSlug, QualityIssue[]>();
  for (const item of raw.burclar) {
    const { sign, entry, issues } = checkHoroscopeEntry(item);
    if (!sign || entries.has(sign)) continue;
    if (entry) {
      entries.set(sign, entry);
      issuesBySign.delete(sign);
    } else if (!issuesBySign.has(sign)) {
      issuesBySign.set(sign, issues);
    }
  }
  const failedSigns = SIGN_SLUGS.filter((sign) => !entries.has(sign)).map((sign) => ({
    sign,
    issues: issuesBySign.get(sign) ?? [{ field: 'burc', message: 'Bu burç yanıtta yok.' }],
  }));
  const postIssues = [
    ...textIssues('kapakKanca', raw.kapakKanca, { min: 5, max: 60, maxEmoji: 1 }),
    ...textIssues('caption', raw.caption, { min: 40, max: 700, maxEmoji: 4 }),
    ...(raw.caption.includes('#') ? [{ field: 'caption', message: 'Caption hashtag içermemeli; hashtagler ayrı alanda.' }] : []),
  ];
  const post = postIssues.length
    ? null
    : { coverHook: raw.kapakKanca.trim(), caption: raw.caption.trim(), hashtags: mergeHashtags(baseHashtags, raw.hashtagler) };
  return { entries, failedSigns, post, postIssues };
}

export function batchIssues(check: BatchCheck): QualityIssue[] {
  return [
    ...check.postIssues,
    ...(check.failedSigns.length > MAX_FAILED_SIGNS
      ? [{ field: 'burclar', message: `${check.failedSigns.length} burç geçersiz ya da eksik.` }]
      : []),
  ];
}
