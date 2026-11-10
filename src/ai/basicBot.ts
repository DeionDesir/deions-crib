// A simple computer player so the text game has an opponent.
// This is a placeholder: the real CPU with difficulty levels is step 4.

import { Card, cardValue, createDeck, sameCard } from '../engine/cards';
import { GameState, Player, legalPlays } from '../engine/game';
import { scoreHand, scorePegging } from '../engine/scoring';

/** Keeps the four cards with the best average score over every possible starter. */
export function chooseDiscard(state: GameState, player: Player): Card[] {
  const hand = state.hands[player];
  const unseen = createDeck().filter((c) => !hand.some((h) => sameCard(c, h)));
  let best: Card[] = [];
  let bestAverage = -1;

  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const keep = hand.filter((_, k) => k !== i && k !== j);
      const total = unseen.reduce((sum, starter) => sum + scoreHand(keep, starter, false, state.rules).total, 0);
      if (total / unseen.length > bestAverage) {
        bestAverage = total / unseen.length;
        best = [hand[i], hand[j]];
      }
    }
  }
  return best;
}

/** Plays whichever card scores the most right now; ties go to the highest card. */
export function choosePlay(state: GameState, player: Player): Card {
  const options = legalPlays(state, player);
  let best = options[0];
  let bestPoints = -1;
  for (const card of options) {
    const points = scorePegging([...state.play.sequence, card], state.rules).reduce((sum, item) => sum + item.points, 0);
    if (points > bestPoints || (points === bestPoints && cardValue(card) > cardValue(best))) {
      best = card;
      bestPoints = points;
    }
  }
  return best;
}
