import type { HoroscopeBatchRaw, HoroscopeEntryRaw } from '@/lib/content/horoscope-schema';
import { SIGN_SLUGS, getSign, type SignSlug } from '@/lib/zodiac/signs';

export function mockHoroscopeEntry(slug: SignSlug): HoroscopeEntryRaw {
  const { name, traits } = getSign(slug);
  const trait = traits.split(', ')[0];
  return {
    burc: name,
    baslik: `${name} için ışıltılı bir gün`,
    yorum: `Bugün ${name} burcu olarak ${trait} yanın öne çıkıyor. Gökyüzündeki hareketlilik sana küçük ama anlamlı fırsatlar getiriyor; bir arkadaşının önerisi aklına yepyeni bir fikir düşürebilir. İşte acele etmeden adım atarsan emeğinin karşılığını görürsün. Akşam saatlerinde kendine vakit ayır ve sevdiğin bir şarkıyla güne tatlı bir kapanış yap ✨`,
    kisa: `${name}: Küçük fırsatlara açık ol, akşamı kendine ayır ✨`,
    puanlar: { ask: 4, para: 3, saglik: 4 },
    sansliRenk: 'lila',
    sansliSayi: SIGN_SLUGS.indexOf(slug) + 7,
  };
}

export function mockHoroscopeBatch(): HoroscopeBatchRaw {
  return {
    kapakKanca: 'Bugün yıldızlar senden yana ✨',
    caption: 'Günün burç yorumları hazır! Burcunu bul, kaydet ve sevdiğinle paylaş. Sen hangi burçsun? Yorumlarda buluşalım 💫',
    hashtagler: ['#günlükburç', '#yıldızlar'],
    burclar: SIGN_SLUGS.map(mockHoroscopeEntry),
  };
}

export function mockWeeklyEntry(slug: SignSlug): HoroscopeEntryRaw {
  const daily = mockHoroscopeEntry(slug);
  const { name } = getSign(slug);
  return {
    ...daily,
    baslik: `${name} için geniş bir hafta`,
    yorum: `${daily.yorum.replace(/ ✨$/, '.')} Haftanın ortasında işlerin hızlandığını hissedeceksin; yarım kalan bir konuşmayı tamamlamak için doğru an çarşamba gibi görünüyor. Hafta sonuna doğru ise kendine ayırdığın zaman sana yeni bir bakış açısı kazandıracak, sevdiklerinle kuracağın küçük planlar moralini yükseltecek ✨`,
    kisa: `${name}: Haftanın ortasında hızlan, hafta sonunu kendine ayır ✨`,
  };
}

export function mockWeeklyBatch(): HoroscopeBatchRaw {
  return { ...mockHoroscopeBatch(), kapakKanca: 'Haftanın yıldızları senin için ne diyor? ✨', burclar: SIGN_SLUGS.map(mockWeeklyEntry) };
}
