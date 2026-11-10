// Cards, deck and a small seedable random number generator.
// Nothing in here knows about cribbage scoring.

export type Suit = 'C' | 'D' | 'H' | 'S';
export const SUITS: readonly Suit[] = ['C', 'D', 'H', 'S'];

/** rank: 1 = Ace, 11 = Jack, 12 = Queen, 13 = King */
export interface Card {
  rank: number;
  suit: Suit;
}

const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_SYMBOLS: Record<Suit, string> = { C: '♣', D: '♦', H: '♥', S: '♠' };

/** Counting value of a card: face cards are 10, ace is 1. */
export function cardValue(card: Card): number {
  return Math.min(card.rank, 10);
}

export function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

/** "5♥", "10♠", "J♦" */
export function cardToString(card: Card): string {
  return RANK_LABELS[card.rank - 1] + SUIT_SYMBOLS[card.suit];
}

export function cardsToString(cards: readonly Card[]): string {
  return cards.map(cardToString).join(' ');
}

/** Parses "5H", "10s", "td", "jc", "AS". Throws on anything else. */
export function parseCard(text: string): Card {
  const match = /^(10|[A2-9TJQK])([CDHS])$/i.exec(text.trim());
  if (!match) throw new Error(`Not a card: "${text}"`);
  const rankText = match[1].toUpperCase();
  const rank = rankText === 'T' ? 10 : RANK_LABELS.indexOf(rankText) + 1;
  return { rank, suit: match[2].toUpperCase() as Suit };
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) deck.push({ rank, suit });
  }
  return deck;
}

/**
 * Seedable RNG (mulberry32). The state is a plain number so the whole game
 * state stays serializable and any game can be replayed from its seed.
 * Returns a value in [0, 1) and the next state.
 */
export function nextRandom(state: number): [value: number, nextState: number] {
  const next = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** Fisher-Yates shuffle. Returns a new array and the advanced RNG state. */
export function shuffle<T>(items: readonly T[], rngState: number): { items: T[]; rngState: number } {
  const result = [...items];
  let state = rngState;
  for (let i = result.length - 1; i > 0; i--) {
    let r: number;
    [r, state] = nextRandom(state);
    const j = Math.floor(r * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return { items: result, rngState: state };
}
