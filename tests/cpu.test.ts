import { describe, expect, it } from 'vitest';
import { Difficulty, DIFFICULTIES, chooseDiscard, choosePlay, rankDiscards } from '../src/ai/cpu';
import { Card, nextRandom, parseCard, sameCard } from '../src/engine/cards';
import { GameState, Player, discard, legalPlays, newGame, nextHand, playCard, playersToAct } from '../src/engine/game';
import { buildGameRecord, computeStats } from '../src/stats/records';

const cards = (text: string): Card[] => text.split(' ').map(parseCard);

function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    let value: number;
    [value, state] = nextRandom(state);
    return value;
  };
}

/** Plays a whole game between two CPU levels and returns the final state. */
function playGame(seed: number, levels: [Difficulty, Difficulty]): GameState {
  const rng = seededRng(seed * 31 + 7);
  let state = newGame({ seed });
  while (state.phase !== 'gameover') {
    if (state.phase === 'handover') {
      state = nextHand(state);
    } else if (state.phase === 'discard') {
      for (const player of playersToAct(state)) {
        state = discard(state, player, chooseDiscard(state, player, levels[player], rng));
      }
    } else {
      const player = state.play.turn;
      state = playCard(state, player, choosePlay(state, player, levels[player], rng));
    }
  }
  return state;
}

describe('CPU discards', () => {
  it('keeps the makings of a 29 hand', () => {
    const state = newGame({ seed: 1, firstDealer: 0 });
    state.hands[1] = cards('5C 5D 5S JH 9C KD');
    for (const level of DIFFICULTIES.filter((l) => l !== 'easy')) {
      const thrown = chooseDiscard(state, 1, level, seededRng(1));
      expect(thrown.map((c) => c.rank).sort((a, b) => a - b)).toEqual([9, 13]);
    }
  });

  it('on hard, keeps a pair for its own crib but not for the opponent’s', () => {
    // Same six cards, dealt once as the dealer and once as the non-dealer.
    const mine = newGame({ seed: 1, firstDealer: 1 });
    mine.hands[1] = cards('AC 2D 3S 4H 5C 5D');
    const theirs = structuredClone(mine);
    theirs.dealer = 0;
    const valueOfFives = (state: GameState) =>
      rankDiscards(state, 1, 'hard', seededRng(3)).find((o) => o.discards.every((c) => c.rank === 5))!.value;
    // Throwing two fives is worth far more into your own crib.
    expect(valueOfFives(mine)).toBeGreaterThan(valueOfFives(theirs) + 5);
  });

  it('always discards two cards from its own hand', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = newGame({ seed });
      for (const level of DIFFICULTIES) {
        const thrown = chooseDiscard(state, 1, level, seededRng(seed));
        expect(thrown).toHaveLength(2);
        expect(thrown.every((c) => state.hands[1].some((h) => sameCard(c, h)))).toBe(true);
      }
    }
  });
});

describe('CPU pegging', () => {
  function pegging(hand0: string, hand1: string): GameState {
    const state = newGame({ seed: 1, firstDealer: 1 });
    state.phase = 'play';
    state.hands = [cards(hand0), cards(hand1)];
    state.crib = cards('2C 6D 8H QS');
    state.starter = parseCard('KD');
    state.play.remaining = [cards(hand0), cards(hand1)];
    state.play.turn = 0;
    return state;
  }

  it('takes the points on offer', () => {
    // Opponent led a 7: the 8 makes fifteen.
    const state = playCard(pegging('7S 2S 3S 4S', '8H KH 9H 4H'), 0, parseCard('7S'));
    for (const level of ['normal', 'hard'] as Difficulty[]) {
      expect(choosePlay(state, 1, level, seededRng(1))).toEqual(parseCard('8H'));
    }
  });

  it('on hard, does not lead a five', () => {
    const state = pegging('5S 5H 4S KS', '8H KH 9H 4H');
    expect(choosePlay(state, 0, 'hard', seededRng(1)).rank).not.toBe(5);
  });

  it('only ever plays legal cards', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const rng = seededRng(seed);
      let state = newGame({ seed });
      for (let step = 0; step < 400 && state.phase !== 'gameover'; step++) {
        if (state.phase === 'handover') state = nextHand(state);
        else if (state.phase === 'discard') {
          for (const p of playersToAct(state)) state = discard(state, p, chooseDiscard(state, p, 'easy', rng));
        } else {
          const p: Player = state.play.turn;
          const card = choosePlay(state, p, DIFFICULTIES[step % 3], rng);
          expect(legalPlays(state, p).some((c) => sameCard(c, card))).toBe(true);
          state = playCard(state, p, card);
        }
      }
    }
  });
});

describe('CPU strength', () => {
  it('hard beats easy most of the time', () => {
    let hardWins = 0;
    const games = 24;
    for (let seed = 1; seed <= games; seed++) {
      // Swap seats every game so neither level gets more first deals.
      const hardSeat: Player = seed % 2 === 0 ? 0 : 1;
      const levels: [Difficulty, Difficulty] = hardSeat === 0 ? ['hard', 'easy'] : ['easy', 'hard'];
      if (playGame(seed, levels).winner === hardSeat) hardWins++;
    }
    expect(hardWins).toBeGreaterThan(games * 0.6);
  }, 60_000);
});

describe('game records', () => {
  const state = playGame(11, ['normal', 'normal']);
  const record = buildGameRecord(state, { id: 'g1', startedAt: '2026-01-01T00:00:00Z', difficulty: 'normal' }, 0, '2026-01-01T00:10:00Z');

  it('adds up to the final score', () => {
    expect(record.score).toEqual({ you: state.scores[0], cpu: state.scores[1] });
    expect(record.hands[record.hands.length - 1].scoreAfter).toEqual(record.score);
    expect(record.winner).toBe(state.winner === 0 ? 'you' : 'cpu');
    // Every point is accounted for (the winner's last score may be capped at 121).
    for (const who of ['you', 'cpu'] as const) {
      const total = record.hands.reduce(
        (sum, h) => sum + h[who].pegging + h[who].heels + (h[who].handPoints ?? 0) + (h[who].cribPoints ?? 0),
        0,
      );
      if (record.winner === who) expect(total).toBeGreaterThanOrEqual(121);
      else expect(total).toBe(record.score[who]);
    }
  });

  it('records each hand', () => {
    expect(record.hands.length).toBe(state.handNumber);
    const first = record.hands[0];
    expect(first.you.kept).toHaveLength(4);
    expect(first.you.discards).toHaveLength(2);
    expect(first.starter).not.toBeNull();
    // Only the dealer has a crib.
    const dealer = first.dealer;
    const other = dealer === 'you' ? 'cpu' : 'you';
    expect(first[dealer].cribPoints).not.toBeNull();
    expect(first[other].cribPoints).toBeNull();
  });

  it('survives being saved as JSON', () => {
    expect(JSON.parse(JSON.stringify(record))).toEqual(record);
  });

  it('computes stats across games', () => {
    const lost = { ...record, id: 'g2', winner: 'cpu' as const, score: { you: 80, cpu: 121 }, skunk: 'skunk' as const };
    const won = { ...record, id: 'g3', winner: 'you' as const, score: { you: 121, cpu: 100 }, skunk: 'none' as const };
    const stats = computeStats([lost, won, won]);
    expect(stats.played).toBe(3);
    expect(stats.wins).toBe(2);
    expect(stats.currentStreak).toBe(2);
    expect(stats.bestWinStreak).toBe(2);
    expect(stats.skunksTaken).toBe(1);
    expect(stats.biggestWin).toBe(21);
    expect(stats.winPercent).toBeCloseTo(66.67, 1);
    expect(stats.handsPlayed).toBe(record.hands.length * 3);
    expect(stats.averageHand).not.toBeNull();
    expect(stats.byDifficulty.normal).toEqual({ wins: 2, losses: 1 });
  });

  it('handles no games at all', () => {
    const stats = computeStats([]);
    expect(stats.played).toBe(0);
    expect(stats.winPercent).toBeNull();
    expect(stats.bestHand).toBeNull();
  });
});
