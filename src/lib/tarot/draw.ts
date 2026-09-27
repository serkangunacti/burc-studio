import { randomInt } from 'node:crypto';
import { TAROT_DECK, type TarotCard } from './deck';

// Fisher–Yates; `random(max)` 0 ≤ n < max döndürür. `exclude` içindeki kartlar desteye girmez.
export function drawCards(count: number, random: (max: number) => number = randomInt, exclude: ReadonlySet<string> = new Set()): TarotCard[] {
  const deck = TAROT_DECK.filter((card) => !exclude.has(card.id));
  for (let index = deck.length - 1; index > 0; index--) {
    const swap = random(index + 1);
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }
  return deck.slice(0, count);
}
