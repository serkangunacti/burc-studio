import { TAROT_DECK, getTarotCard, type TarotCard, type TarotSuit } from '@/lib/tarot/deck';
import { BODY_FONT, HEADING_FONT } from '../templates/pastel-v1/fonts';
import { PALETTE } from '../templates/pastel-v1/tokens';
import { MAJOR_ICONS } from './major-icons';
import { pipLayout } from './pips';
import { COURT_PATHS, COURT_RANKS, Glyph, SUIT_PATHS, type CourtRank } from './symbols';

export const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'] as const;

const MAJOR_IDS = TAROT_DECK.filter((card) => card.arcana === 'buyuk').map((card) => card.id);
const COURT_LABELS: Record<CourtRank, string> = { prens: 'PRENS', sovalye: 'ŞÖVALYE', kralice: 'KRALİÇE', kral: 'KRAL' };
const TONES: Record<TarotSuit | 'buyuk', { from: string; to: string }> = {
  buyuk: { from: '#E4D6F5', to: '#FFE1CC' },
  kupa: { from: '#D3E4F4', to: '#F1F6FB' },
  degnek: { from: '#FFDCC4', to: '#FFF0E6' },
  kilic: { from: '#E0DCEB', to: '#F4F1F8' },
  tilsim: { from: '#D8E8CF', to: '#F2F5EA' },
};

type Rank = { kind: 'major' } | { kind: 'pips'; count: number } | { kind: 'court'; court: CourtRank };

function rankOf(card: TarotCard): Rank {
  if (card.arcana === 'buyuk') return { kind: 'major' };
  const rank = card.id.slice(card.id.indexOf('-') + 1);
  if (rank === 'as') return { kind: 'pips', count: 1 };
  if ((COURT_RANKS as readonly string[]).includes(rank)) return { kind: 'court', court: rank as CourtRank };
  return { kind: 'pips', count: Number(rank) };
}

function labelOf(card: TarotCard, rank: Rank): string {
  if (rank.kind === 'major') return ROMAN[MAJOR_IDS.indexOf(card.id)];
  if (rank.kind === 'court') return COURT_LABELS[rank.court];
  return rank.count === 1 ? 'AS' : String(rank.count);
}

function Motif({ card, rank, size }: { card: TarotCard; rank: Rank; size: number }) {
  if (rank.kind === 'major') {
    return (
      <div data-icon={card.id} style={{ position: 'absolute', left: 0, top: 0, width: size, height: size }}>
        <Glyph paths={MAJOR_ICONS[card.id]} size={size} color={PALETTE.plum} strokePx={Math.max(2, Math.round(size / 45))} />
      </div>
    );
  }
  const suit = SUIT_PATHS[card.suit as TarotSuit];
  if (rank.kind === 'court') {
    const symbol = Math.round(size * 0.5);
    const mark = Math.round(size * 0.36);
    return (
      <>
        <div data-court={rank.court} style={{ position: 'absolute', left: Math.round((size - mark) / 2), top: Math.round(size * 0.04), width: mark, height: mark }}>
          <Glyph paths={COURT_PATHS[rank.court]} size={mark} color={PALETTE.gold} strokePx={Math.max(2, Math.round(size / 55))} />
        </div>
        <div style={{ position: 'absolute', left: Math.round((size - symbol) / 2), top: Math.round(size * 0.46), width: symbol, height: symbol }}>
          <Glyph paths={suit} size={symbol} color={PALETTE.plum} strokePx={Math.max(2, Math.round(size / 50))} />
        </div>
      </>
    );
  }
  const pip = Math.round(size * (rank.count === 1 ? 0.62 : rank.count <= 3 ? 0.26 : rank.count <= 6 ? 0.22 : 0.19));
  return (
    <>
      {pipLayout(rank.count).map((spot) => (
        <div
          key={`${spot.x}-${spot.y}`}
          data-pip=""
          style={{
            position: 'absolute',
            left: Math.round((spot.x / 100) * size - pip / 2),
            top: Math.round((spot.y / 100) * size - pip / 2),
            width: pip,
            height: pip,
            transform: spot.flip ? 'rotate(180deg)' : undefined,
          }}
        >
          <Glyph paths={suit} size={pip} color={PALETTE.plum} strokePx={Math.max(1.5, Math.round(pip / 20))} />
        </div>
      ))}
    </>
  );
}

// 5:8 oranında minimal tarot kartı; yükseklik genişlikten hesaplanır.
export function TarotCardArt({ cardId, width }: { cardId: string; width: number }) {
  const card = getTarotCard(cardId);
  const rank = rankOf(card);
  const height = Math.round(width * 1.6);
  const tone = TONES[card.suit ?? 'buyuk'];
  const inset = Math.round(width * 0.045);
  const motif = Math.round(width * 0.72);
  return (
    <div
      data-card={card.id}
      style={{
        position: 'relative',
        width,
        height,
        flexShrink: 0,
        overflow: 'hidden',
        borderRadius: Math.round(width * 0.07),
        border: `2px solid ${PALETTE.gold}`,
        backgroundImage: `linear-gradient(160deg, ${tone.from}, ${tone.to})`,
        boxShadow: '0 14px 36px rgba(61, 44, 62, 0.14)',
        color: PALETTE.plum,
        fontFamily: BODY_FONT,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: inset,
          top: inset,
          width: width - inset * 2 - 4,
          height: height - inset * 2 - 4,
          borderRadius: Math.round(width * 0.045),
          border: `1.5px solid ${PALETTE.goldSoft}`,
        }}
      />
      <div style={{ position: 'absolute', left: 0, top: Math.round(height * 0.06), width, fontSize: Math.round(width * 0.075), fontWeight: 700, letterSpacing: 3, color: PALETTE.plumSoft }}>
        {labelOf(card, rank)}
      </div>
      <div style={{ position: 'absolute', left: Math.round((width - motif) / 2), top: Math.round((height - motif) / 2), width: motif, height: motif }}>
        <Motif card={card} rank={rank} size={motif} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: Math.round(height * 0.065),
          width,
          fontFamily: HEADING_FONT,
          fontSize: Math.round(width * 0.068),
          fontWeight: 600,
          letterSpacing: 1,
        }}
      >
        {card.name.toLocaleUpperCase('tr-TR')}
      </div>
    </div>
  );
}
