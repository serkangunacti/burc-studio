import { randomInt } from 'node:crypto';
import { TAROT_DECK, type TarotCard } from './deck';

// Fisher–Yates; `random(max)` 0 ≤ n < max döndürür.
export function drawCards(count: number, random: (max: number) => number = randomInt): TarotCard[] {
  const deck = [...TAROT_DECK];
  for (let index = deck.length - 1; index > 0; index--) {
    const swap = random(index + 1);
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }
  return deck.slice(0, count);
}
