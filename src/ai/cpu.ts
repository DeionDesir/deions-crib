// The computer player, at three difficulty levels.
//
//   easy   - picks loosely among decent discards and often pegs at random
//   normal - keeps the best-scoring hand and pegs for the most points now
//   hard   - also weighs whose crib the discards feed, and avoids pegging
//            plays that set the opponent up to score

import { Card, cardValue, createDeck, sameCard } from '../engine/cards';
import { GameState, Player, legalPlays, otherPlayer } from '../engine/game';
import { scoreHand, scorePegging } from '../engine/scoring';

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

/** Returns a number in [0, 1). Pass a seeded one to make the CPU repeatable. */
export type Rng = () => number;

export interface DiscardOption {
  discards: Card[];
  keep: Card[];
  /** Expected points for this choice; higher is better. */
  value: number;
}

const CRIB_SAMPLES = 60;

const pegPoints = (sequence: Card[], state: GameState) =>
  scorePegging(sequence, state.rules).reduce((sum, item) => sum + item.points, 0);

/** Every way to split the dealt hand, best first. */
export function rankDiscards(
  state: GameState,
  player: Player,
  difficulty: Difficulty,
  rng: Rng = Math.random,
): DiscardOption[] {
  const hand = state.hands[player];
  const unseen = createDeck().filter((c) => !hand.some((h) => sameCard(c, h)));

  // For the crib estimate, imagine the same random starters and opponent
  // discards for every option, so the options are compared fairly.
  const samples: [Card, Card, Card][] = [];
  if (difficulty === 'hard') {
    while (samples.length < CRIB_SAMPLES) {
      const picks = [0, 0, 0].map(() => unseen[Math.floor(rng() * unseen.length)]);
      const distinct = !sameCard(picks[0], picks[1]) && !sameCard(picks[0], picks[2]) && !sameCard(picks[1], picks[2]);
      if (distinct) samples.push(picks as [Card, Card, Card]);
    }
  }
  const cribIsMine = state.dealer === player;

  const options: DiscardOption[] = [];
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const keep = hand.filter((_, k) => k !== i && k !== j);
      const discards = [hand[i], hand[j]];

      // Average hand score over every card that could be cut as the starter.
      let value =
        unseen.reduce((sum, starter) => sum + scoreHand(keep, starter, false, state.rules).total, 0) / unseen.length;

      if (difficulty === 'hard') {
        const crib =
          samples.reduce(
            (sum, [starter, a, b]) => sum + scoreHand([...discards, a, b], starter, true, state.rules).total,
            0,
          ) / samples.length;
        value += cribIsMine ? crib : -crib;
      }
      options.push({ discards, keep, value });
    }
  }
  return options.sort((a, b) => b.value - a.value);
}

export function chooseDiscard(
  state: GameState,
  player: Player,
  difficulty: Difficulty,
  rng: Rng = Math.random,
): Card[] {
  const options = rankDiscards(state, player, difficulty, rng);
  // Easy mode takes any of its five best ideas instead of the best one.
  const pick = difficulty === 'easy' ? Math.floor(rng() * Math.min(5, options.length)) : 0;
  return options[pick].discards;
}

export function choosePlay(
  state: GameState,
  player: Player,
  difficulty: Difficulty,
  rng: Rng = Math.random,
): Card {
  const options = legalPlays(state, player);
  if (options.length === 0) throw new Error('No legal play');
  if (difficulty === 'easy' && rng() < 0.5) return options[Math.floor(rng() * options.length)];

  let best = options[0];
  let bestValue = -Infinity;
  for (const card of options) {
    const sequence = [...state.play.sequence, card];
    let value = pegPoints(sequence, state) + cardValue(card) * 0.05; // ties: shed high cards first
    if (difficulty === 'hard') value -= 0.8 * replyRisk(state, player, sequence);
    if (value > bestValue) {
      best = card;
      bestValue = value;
    }
  }
  return best;
}

/**
 * Roughly how many points the opponent can expect to score in reply to this
 * play, judged from the cards this player has not seen.
 */
function replyRisk(state: GameState, player: Player, sequence: Card[]): number {
  const opponentCards = state.play.remaining[otherPlayer(player)].length;
  if (opponentCards === 0) return 0;

  const myDiscards = [...state.events].reverse().find((e) => e.type === 'discard' && e.player === player);
  const seen: Card[] = [
    ...state.hands[player],
    ...(myDiscards?.type === 'discard' ? myDiscards.cards : []),
    ...(state.starter ? [state.starter] : []),
    ...state.play.history.map((p) => p.card),
  ];
  const unseen = createDeck().filter((c) => !seen.some((s) => sameCard(c, s)));
  const count = sequence.reduce((sum, c) => sum + cardValue(c), 0);

  let risk = 0;
  for (let rank = 1; rank <= 13; rank++) {
    const copies = unseen.filter((c) => c.rank === rank);
    if (copies.length === 0 || count + cardValue(copies[0]) > state.rules.maxCount) continue;
    const chanceHeld = Math.min(1, (opponentCards * copies.length) / unseen.length);
    risk += chanceHeld * pegPoints([...sequence, copies[0]], state);
  }
  return risk;
}
