import { describe, expect, it } from 'vitest';
import { Card, nextRandom, parseCard, sameCard } from '../src/engine/cards';
import {
  GameState,
  Player,
  discard,
  legalPlays,
  newGame,
  nextHand,
  playCard,
  playersToAct,
} from '../src/engine/game';

const cards = (text: string): Card[] => (text ? text.split(' ').map(parseCard) : []);

/**
 * Builds a game that is already in the pegging phase with known cards.
 * Player 1 is the dealer, so player 0 leads.
 */
function peggingGame(hand0: string, hand1: string, options: { starter?: string; scores?: [number, number] } = {}): GameState {
  const state = newGame({ seed: 1, firstDealer: 1 });
  state.phase = 'play';
  state.hands = [cards(hand0), cards(hand1)];
  state.crib = cards('2C 6D 8H QS');
  state.starter = parseCard(options.starter ?? 'KD');
  state.scores = options.scores ?? [0, 0];
  state.play.remaining = [cards(hand0), cards(hand1)];
  state.play.turn = 0;
  return state;
}

/** Plays cards in turn order, e.g. play(state, 'KS QH JS'). */
function play(state: GameState, sequence: string): GameState {
  for (const card of cards(sequence)) state = playCard(state, state.play.turn, card);
  return state;
}

/** Points scored during pegging only (ignores the show). */
function pegged(state: GameState, player: Player): number {
  return state.events
    .filter((e) => e.type === 'score')
    .filter((e) => e.type === 'score' && e.player === player && e.reason !== 'hand' && e.reason !== 'crib')
    .reduce((sum, e) => sum + (e.type === 'score' ? e.points : 0), 0);
}

describe('deal and discard', () => {
  it('deals six cards each and waits for both players to discard', () => {
    const state = newGame({ seed: 7 });
    expect(state.phase).toBe('discard');
    expect(state.hands[0]).toHaveLength(6);
    expect(state.hands[1]).toHaveLength(6);
    expect(playersToAct(state)).toEqual([0, 1]);
  });

  it('is repeatable from a seed', () => {
    expect(newGame({ seed: 99 }).hands).toEqual(newGame({ seed: 99 }).hands);
    expect(newGame({ seed: 99 }).hands).not.toEqual(newGame({ seed: 100 }).hands);
  });

  it('moves to pegging once both have discarded, non-dealer to lead', () => {
    let state = newGame({ seed: 7, firstDealer: 0 });
    state = discard(state, 0, state.hands[0].slice(0, 2));
    expect(state.phase).toBe('discard');
    state = discard(state, 1, state.hands[1].slice(0, 2));
    expect(state.phase).toBe('play');
    expect(state.crib).toHaveLength(4);
    expect(state.starter).not.toBeNull();
    expect(state.play.turn).toBe(1);
  });

  it('does not change the state it was given', () => {
    const before = newGame({ seed: 7 });
    const snapshot = structuredClone(before);
    discard(before, 0, before.hands[0].slice(0, 2));
    expect(before).toEqual(snapshot);
  });

  it('rejects bad discards', () => {
    const state = newGame({ seed: 7 });
    const [a, b] = state.hands[0];
    expect(() => discard(state, 0, [a])).toThrow();
    expect(() => discard(state, 0, [a, a])).toThrow();
    expect(() => discard(state, 0, [a, state.hands[1][0]])).toThrow();
    expect(() => discard(discard(state, 0, [a, b]), 0, [a, b])).toThrow();
  });

  it('gives the dealer two for his heels when a jack is cut', () => {
    let found = 0;
    for (let seed = 1; seed <= 400; seed++) {
      let state = newGame({ seed, firstDealer: 0 });
      state = discard(state, 0, state.hands[0].slice(0, 2));
      state = discard(state, 1, state.hands[1].slice(0, 2));
      if (state.starter!.rank === 11) {
        found++;
        expect(state.scores).toEqual([2, 0]);
      } else {
        expect(state.scores).toEqual([0, 0]);
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('alternates the deal each hand', () => {
    const state = peggingGame('KS 9S 8S 7S', 'QH 8H 7H 6H');
    state.play.remaining = [cards('KS'), []];
    const done = play(state, 'KS');
    expect(done.phase).toBe('handover');
    const next = nextHand(done);
    expect(next.dealer).toBe(0);
    expect(next.handNumber).toBe(2);
    expect(next.hands[0]).toHaveLength(6);
  });
});

describe('pegging', () => {
  it('awards one for go and gives the lead to the other player', () => {
    // K (10), Q (20), 9 (29): nobody can play, so the 9 takes the go.
    const state = play(peggingGame('KS 9S 8S 7S', 'QH 8H 7H 6H'), 'KS QH 9S');
    expect(pegged(state, 0)).toBe(1);
    expect(state.play.count).toBe(0);
    expect(state.play.turn).toBe(1);
    expect(state.events.some((e) => e.type === 'go' && e.player === 1)).toBe(true);
  });

  it('lets a player keep playing after the opponent says go', () => {
    // 10, 10, 8 (28): player 1 cannot play, player 0 still has a 2.
    let state = play(peggingGame('KS 8S 2S 7S', 'QH 9H 7H 6H'), 'KS QH 8S');
    expect(state.play.turn).toBe(0);
    expect(legalPlays(state, 0)).toEqual(cards('2S'));
    state = play(state, '2S'); // 30, then go for one
    expect(pegged(state, 0)).toBe(1);
    expect(state.play.turn).toBe(1);
  });

  it('scores two for thirty-one with no extra point for go', () => {
    // K, Q, J is a run of three for player 0; the ace makes 31 for player 1.
    const state = play(peggingGame('KS JS 2S 3S', 'QH AH 4H 6H'), 'KS QH JS AH');
    expect(pegged(state, 0)).toBe(3);
    expect(pegged(state, 1)).toBe(2);
    expect(state.play.count).toBe(0);
    expect(state.play.turn).toBe(0);
  });

  it('awards one for last card and then counts the hands', () => {
    // After the 31 above: 2, 4, 3 (run of three), then 6 makes fifteen + last card.
    const state = play(peggingGame('KS JS 2S 3S', 'QH AH 4H 6H'), 'KS QH JS AH 2S 4H 3S 6H');
    expect(pegged(state, 0)).toBe(6);
    expect(pegged(state, 1)).toBe(5);
    expect(state.phase).toBe('handover');
    expect(state.events.filter((e) => e.type === 'show')).toHaveLength(3);
  });

  it('rejects playing out of turn or over 31', () => {
    const state = play(peggingGame('KS 9S 8S 7S', 'QH KH 7H 6H'), 'KS QH 9S');
    // Count is 0 again after the go, and it is player 1's turn.
    expect(() => playCard(state, 0, parseCard('8S'))).toThrow();
    // K, Q, 8 makes 28: player 1 may play the 2 but not the 7.
    const high = play(peggingGame('KS 9S 8S 7S', 'QH 2H 7H 6H'), 'KS QH 8S');
    expect(() => playCard(high, 1, parseCard('7H'))).toThrow();
    expect(legalPlays(high, 1)).toEqual(cards('2H'));
  });
});

describe('winning', () => {
  it('ends the game the moment someone pegs out', () => {
    const state = play(peggingGame('7S 9S 8S KS', '8H KH 7H 6H', { scores: [100, 119] }), '7S 8H');
    expect(state.phase).toBe('gameover');
    expect(state.winner).toBe(1);
    expect(state.scores).toEqual([100, 121]);
    expect(state.skunk).toBe('none');
    expect(state.events.some((e) => e.type === 'show')).toBe(false);
    expect(() => playCard(state, 0, parseCard('9S'))).toThrow();
  });

  it('counts the non-dealer first, so the dealer can lose needing one point', () => {
    const state = peggingGame('5C 5D 5S JH', 'QH KH 7H 6H', { starter: '5H', scores: [95, 120] });
    state.play.remaining = [cards('JH'), []];
    const done = play(state, 'JH');
    expect(done.winner).toBe(0);
    expect(done.scores).toEqual([121, 120]);
    expect(done.events.filter((e) => e.type === 'show')).toHaveLength(1);
  });

  it('never scores past the target', () => {
    const state = play(peggingGame('7S 9S 8S KS', '7H KH 8H 6H', { scores: [120, 0] }), '7S 7H 8S');
    // Player 1 pairs the seven; player 0's eight scores nothing.
    expect(state.scores[0]).toBe(120);
    const won = play(peggingGame('7S 8S 9S KS', '8H KH 7H 6H', { scores: [120, 0] }), '7S 6H 8S');
    expect(won.scores[0]).toBe(121); // run of three, capped
  });

  it('reports skunks and double skunks', () => {
    const skunk = play(peggingGame('7S', '8H', { scores: [90, 119] }), '7S 8H');
    expect(skunk.skunk).toBe('skunk');
    const double = play(peggingGame('7S', '8H', { scores: [60, 119] }), '7S 8H');
    expect(double.skunk).toBe('double');
    const neither = play(peggingGame('7S', '8H', { scores: [91, 119] }), '7S 8H');
    expect(neither.skunk).toBe('none');
  });
});

describe('whole games with random legal moves', () => {
  it('always finish with a valid result', () => {
    for (let seed = 1; seed <= 100; seed++) {
      let state = newGame({ seed });
      let rng = seed * 7919;
      const pickIndex = (n: number) => {
        let r: number;
        [r, rng] = nextRandom(rng);
        return Math.floor(r * n);
      };

      let steps = 0;
      while (state.phase !== 'gameover') {
        if (++steps > 5000) throw new Error(`Game ${seed} did not finish`);
        if (state.phase === 'handover') {
          state = nextHand(state);
        } else if (state.phase === 'discard') {
          // Every hand uses 52 distinct cards.
          const all = [...state.hands[0], ...state.hands[1], ...state.stock];
          expect(all).toHaveLength(52);
          expect(all.every((a, i) => all.every((b, j) => i === j || !sameCard(a, b)))).toBe(true);
          for (const player of playersToAct(state)) {
            const hand = state.hands[player];
            const i = pickIndex(6);
            const j = (i + 1 + pickIndex(5)) % 6;
            state = discard(state, player, [hand[i], hand[j]]);
          }
        } else {
          const options = legalPlays(state, state.play.turn);
          // The player whose turn it is can always play: go is automatic.
          expect(options.length).toBeGreaterThan(0);
          state = playCard(state, state.play.turn, options[pickIndex(options.length)]);
          expect(state.play.count).toBeLessThanOrEqual(31);
        }
      }

      const winner = state.winner!;
      expect(state.scores[winner]).toBe(121);
      expect(state.scores[winner === 0 ? 1 : 0]).toBeLessThan(121);
    }
  });
});
