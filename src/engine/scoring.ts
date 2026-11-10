// Scoring for the show (hands and crib) and for pegging.
// Pure functions: cards in, points and a breakdown out.

import { Card, cardValue } from './cards';
import { Ruleset, STANDARD_RULES } from './rules';

export type HandScoreKind = 'fifteen' | 'pair' | 'run' | 'flush' | 'nobs';

export interface HandScoreItem {
  kind: HandScoreKind;
  points: number;
  cards: Card[];
}

export interface HandScore {
  total: number;
  items: HandScoreItem[];
}

/** Every subset of `cards` with at least `minSize` cards. */
function subsets(cards: readonly Card[], minSize: number): Card[][] {
  const result: Card[][] = [];
  for (let mask = 1; mask < 1 << cards.length; mask++) {
    const subset = cards.filter((_, i) => mask & (1 << i));
    if (subset.length >= minSize) result.push(subset);
  }
  return result;
}

/** True when the cards are consecutive ranks with no duplicates (ace is low). */
function isRun(cards: readonly Card[]): boolean {
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

/**
 * Scores a four-card hand (or crib) together with the starter.
 * `isCrib` matters only for flushes: a crib needs all five cards in one suit.
 */
export function scoreHand(
  hand: readonly Card[],
  starter: Card,
  isCrib = false,
  rules: Ruleset = STANDARD_RULES,
): HandScore {
  const all = [...hand, starter];
  const items: HandScoreItem[] = [];

  // Fifteens: every combination of cards adding up to 15.
  for (const subset of subsets(all, 2)) {
    if (subset.reduce((sum, c) => sum + cardValue(c), 0) === 15) {
      items.push({ kind: 'fifteen', points: rules.points.fifteen, cards: subset });
    }
  }

  // Pairs: every two cards of the same rank.
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (all[i].rank === all[j].rank) {
        items.push({ kind: 'pair', points: rules.points.pair, cards: [all[i], all[j]] });
      }
    }
  }

  // Runs: only the longest run length counts, once per distinct combination.
  // (3-3-4-5 is two runs of three; 3-4-5-6 is one run of four, not two of three.)
  for (let size = all.length; size >= 3; size--) {
    const runs = subsets(all, size).filter((s) => s.length === size && isRun(s));
    if (runs.length > 0) {
      for (const run of runs) items.push({ kind: 'run', points: size, cards: run });
      break;
    }
  }

  // Flush: four in hand, or five with the starter. A crib needs all five.
  const handFlush = hand.every((c) => c.suit === hand[0].suit);
  if (handFlush && starter.suit === hand[0].suit) {
    items.push({ kind: 'flush', points: all.length, cards: all });
  } else if (handFlush && !isCrib) {
    items.push({ kind: 'flush', points: hand.length, cards: [...hand] });
  }

  // Nobs: a jack in hand matching the starter's suit.
  const nobs = hand.find((c) => c.rank === 11 && c.suit === starter.suit);
  if (nobs) items.push({ kind: 'nobs', points: rules.points.nobs, cards: [nobs] });

  return { total: items.reduce((sum, item) => sum + item.points, 0), items };
}

export type PegScoreKind = 'fifteen' | 'thirtyone' | 'pair' | 'run';

export interface PegScoreItem {
  kind: PegScoreKind;
  points: number;
}

/**
 * Points earned by the card just played during pegging.
 * `sequence` is every card played since the count last reset, including the
 * new one at the end. Go and last card are handled by the game flow, not here.
 */
export function scorePegging(
  sequence: readonly Card[],
  rules: Ruleset = STANDARD_RULES,
): PegScoreItem[] {
  const items: PegScoreItem[] = [];
  const count = sequence.reduce((sum, c) => sum + cardValue(c), 0);

  if (count === 15) items.push({ kind: 'fifteen', points: rules.points.fifteen });
  if (count === rules.maxCount) items.push({ kind: 'thirtyone', points: rules.points.thirtyOne });

  // Pairs: how many cards in a row at the end share the last card's rank.
  // 2 in a row = 1 pair, 3 = 3 pairs, 4 = 6 pairs.
  const last = sequence[sequence.length - 1];
  let matching = 1;
  while (matching < sequence.length && sequence[sequence.length - 1 - matching].rank === last.rank) {
    matching++;
  }
  if (matching >= 2) {
    items.push({ kind: 'pair', points: (rules.points.pair * matching * (matching - 1)) / 2 });
  }

  // Runs: the longest stretch at the end that forms a run, in any order.
  for (let size = sequence.length; size >= 3; size--) {
    if (isRun(sequence.slice(-size))) {
      items.push({ kind: 'run', points: size });
      break;
    }
  }

  return items;
}
