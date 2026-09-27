import { AbsoluteFill } from 'remotion';
import { TAROT_DECK } from '@/lib/tarot/deck';
import { PALETTE } from '../templates/pastel-v1/tokens';
import { TarotCardArt } from './tarot-card';

// Studio'da tasarım onayı için 78 kartın tamamı.
export function TarotDeckSheet() {
  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.cream, padding: 40, display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignContent: 'flex-start' }}>
      {TAROT_DECK.map((card) => (
        <TarotCardArt key={card.id} cardId={card.id} width={150} />
      ))}
    </AbsoluteFill>
  );
}
