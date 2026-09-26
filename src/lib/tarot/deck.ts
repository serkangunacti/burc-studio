export type TarotSuit = 'kupa' | 'degnek' | 'kilic' | 'tilsim';
export type TarotCard = { id: string; name: string; arcana: 'buyuk' | 'kucuk'; suit: TarotSuit | null; keywords: string };

const MAJOR: [string, string, string][] = [
  ['deli', 'Deli', 'yeni başlangıç, cesaret, kendiliğindenlik, bilinmeyene adım'],
  ['buyucu', 'Büyücü', 'irade, beceri, kaynakları kullanma, yaratıcı güç'],
  ['basrahibe', 'Başrahibe', 'sezgi, iç bilgelik, sessizlik, gizli bilgi'],
  ['imparatorice', 'İmparatoriçe', 'bolluk, şefkat, üretkenlik, doğayla bağ'],
  ['imparator', 'İmparator', 'düzen, yapı, liderlik, sınır koyma'],
  ['basrahip', 'Başrahip', 'gelenek, öğrenme, rehberlik, değerler'],
  ['asiklar', 'Âşıklar', 'sevgi, uyum, önemli bir seçim, değerlerle hizalanma'],
  ['savas-arabasi', 'Savaş Arabası', 'kararlılık, ilerleme, irade, zafer'],
  ['guc', 'Güç', 'içsel güç, sabır, şefkatli cesaret, öz denetim'],
  ['ermis', 'Ermiş', 'içe dönüş, arayış, yalnız kalma, bilgelik'],
  ['kader-carki', 'Kader Çarkı', 'döngüler, şans, dönüm noktası, değişim'],
  ['adalet', 'Adalet', 'denge, dürüstlük, sonuçlar, doğru karar'],
  ['asilan-adam', 'Asılan Adam', 'bekleyiş, farklı bakış açısı, teslimiyet, duraklama'],
  ['olum', 'Ölüm', 'dönüşüm, bir dönemin kapanması, yenilenme, bırakma'],
  ['olculuk', 'Ölçülülük', 'denge, sabır, uyum, orta yol'],
  ['seytan', 'Şeytan', 'bağımlılıklar, alışkanlıklar, cazibe, farkındalık çağrısı'],
  ['kule', 'Kule', 'ani değişim, uyanış, eski yapıların yıkılması, özgürleşme'],
  ['yildiz', 'Yıldız', 'umut, ilham, iyileşme, yenilenmiş inanç'],
  ['ay', 'Ay', 'sezgi, belirsizlik, rüyalar, bilinçaltı'],
  ['gunes', 'Güneş', 'neşe, başarı, canlılık, açıklık'],
  ['yargi', 'Yargı', 'uyanış, iç ses, ikinci şans, değerlendirme'],
  ['dunya', 'Dünya', 'tamamlanma, bütünlük, kutlama, yeni bir döngünün eşiği'],
];

const SUITS: [TarotSuit, string, string][] = [
  ['kupa', 'Kupa', 'duygular ve ilişkiler'],
  ['degnek', 'Değnek', 'tutku, yaratıcılık ve eylem'],
  ['kilic', 'Kılıç', 'düşünceler, iletişim ve kararlar'],
  ['tilsim', 'Tılsım', 'para, iş ve somut hayat'],
];

const RANKS: [string, string, string][] = [
  ['as', 'Ası', 'yeni bir fırsat, tohum'],
  ['2', 'İkilisi', 'denge, ortaklık, seçim'],
  ['3', 'Üçlüsü', 'büyüme, paylaşım, kutlama'],
  ['4', 'Dörtlüsü', 'istikrar, dinlenme, yerleşme'],
  ['5', 'Beşlisi', 'zorluk, kayıp, yeniden değerlendirme'],
  ['6', 'Altılısı', 'uyum, yardımlaşma, ilerleme'],
  ['7', 'Yedilisi', 'sabır, strateji, seçenekler'],
  ['8', 'Sekizlisi', 'hareket, emek, hızlanma'],
  ['9', 'Dokuzlusu', 'doyum, dayanıklılık, hedefe yakınlık'],
  ['10', 'Onlusu', 'tamamlanma, sonuç, yeni döngü'],
  ['prens', 'Prensi', 'merak, haber, öğrenme'],
  ['sovalye', 'Şövalyesi', 'atılım, hareket, kararlılık'],
  ['kralice', 'Kraliçesi', 'olgunluk, şefkat, sezgisel ustalık'],
  ['kral', 'Kralı', 'liderlik, ustalık, sorumluluk'],
];

export const TAROT_DECK: readonly TarotCard[] = [
  ...MAJOR.map(([id, name, keywords]): TarotCard => ({ id, name, arcana: 'buyuk', suit: null, keywords })),
  ...SUITS.flatMap(([suit, suitName, suitTheme]) =>
    RANKS.map(([rank, rankName, rankTheme]): TarotCard => ({
      id: `${suit}-${rank}`,
      name: `${suitName} ${rankName}`,
      arcana: 'kucuk',
      suit,
      keywords: `${rankTheme}; ${suitTheme}`,
    })),
  ),
];

export function getTarotCard(id: string): TarotCard {
  const card = TAROT_DECK.find((candidate) => candidate.id === id);
  if (!card) throw new Error(`Bilinmeyen tarot kartı: ${id}`);
  return card;
}
