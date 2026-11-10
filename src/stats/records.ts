// Turns a finished game into a plain record, and a list of records into stats.
// Records are plain JSON so they can be saved, exported and loaded into a database.

import { Card, cardCode } from '../engine/cards';
import { GameState, Player, Skunk, otherPlayer } from '../engine/game';

export interface SideRecord {
  /** The four cards kept, or null if the game ended before the hand was shown. */
  kept: string[] | null;
  discards: string[];
  /** Points pegged during play, including go and last card. */
  pegging: number;
  /** Points for a jack starter (dealer only). */
  heels: number;
  /** Null when the game ended before this was counted. */
  handPoints: number | null;
  /** Crib points; always null for the non-dealer. */
  cribPoints: number | null;
}

export interface HandRecord {
  hand: number;
  dealer: 'you' | 'cpu';
  starter: string | null;
  you: SideRecord;
  cpu: SideRecord;
  scoreAfter: { you: number; cpu: number };
}

export interface GameRecord {
  id: string;
  startedAt: string;
  finishedAt: string;
  difficulty: string;
  winner: 'you' | 'cpu';
  score: { you: number; cpu: number };
  skunk: Skunk;
  hands: HandRecord[];
}

export interface GameMeta {
  id: string;
  startedAt: string;
  difficulty: string;
}

const codes = (cards: readonly Card[]) => cards.map(cardCode);

function emptySide(): SideRecord {
  return { kept: null, discards: [], pegging: 0, heels: 0, handPoints: null, cribPoints: null };
}

/** Builds the record for a finished game by replaying its events. */
export function buildGameRecord(state: GameState, meta: GameMeta, human: Player, finishedAt: string): GameRecord {
  if (state.winner === null) throw new Error('The game is not finished');
  const cpu = otherPlayer(human);
  const side = (hand: HandRecord, player: Player) => (player === human ? hand.you : hand.cpu);
  const hands: HandRecord[] = [];
  let current: HandRecord | null = null;

  for (const event of state.events) {
    if (event.type === 'deal') {
      current = {
        hand: event.handNumber,
        dealer: event.dealer === human ? 'you' : 'cpu',
        starter: null,
        you: emptySide(),
        cpu: emptySide(),
        scoreAfter: { you: 0, cpu: 0 },
      };
      if (hands.length > 0) current.scoreAfter = { ...hands[hands.length - 1].scoreAfter };
      hands.push(current);
    }
    if (!current) continue;

    if (event.type === 'discard') side(current, event.player).discards = codes(event.cards);
    if (event.type === 'starter') current.starter = cardCode(event.card);
    if (event.type === 'show') {
      const record = side(current, event.player);
      if (event.source === 'hand') {
        record.kept = codes(event.cards);
        record.handPoints = event.score.total;
      } else {
        record.cribPoints = event.score.total;
      }
    }
    if (event.type === 'score') {
      const record = side(current, event.player);
      if (event.reason === 'heels') record.heels += event.points;
      else if (event.reason !== 'hand' && event.reason !== 'crib') record.pegging += event.points;
      current.scoreAfter = { you: event.scores[human], cpu: event.scores[cpu] };
    }
  }

  // If the game ended during pegging the last hand was never shown, but we
  // still know which cards were kept.
  const last = hands[hands.length - 1];
  if (last && state.hands[human].length === state.rules.handSize) {
    last.you.kept ??= codes(state.hands[human]);
    last.cpu.kept ??= codes(state.hands[cpu]);
  }

  return {
    id: meta.id,
    startedAt: meta.startedAt,
    finishedAt,
    difficulty: meta.difficulty,
    winner: state.winner === human ? 'you' : 'cpu',
    score: { you: state.scores[human], cpu: state.scores[cpu] },
    skunk: state.skunk,
    hands,
  };
}

export interface BestHand {
  points: number;
  cards: string[];
  starter: string;
}

export interface Stats {
  played: number;
  wins: number;
  losses: number;
  /** 0 to 100, or null before the first game. */
  winPercent: number | null;
  /** Positive = wins in a row, negative = losses in a row. */
  currentStreak: number;
  bestWinStreak: number;
  skunksGiven: number;
  skunksTaken: number;
  biggestWin: number | null;
  handsPlayed: number;
  bestHand: BestHand | null;
  bestCrib: number | null;
  averageHand: number | null;
  averageCrib: number | null;
  averagePegging: number | null;
  byDifficulty: Record<string, { wins: number; losses: number }>;
}

const average = (values: number[]) =>
  values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;

/** Stats for the player, from games listed oldest first. */
export function computeStats(games: readonly GameRecord[]): Stats {
  const stats: Stats = {
    played: games.length,
    wins: 0,
    losses: 0,
    winPercent: null,
    currentStreak: 0,
    bestWinStreak: 0,
    skunksGiven: 0,
    skunksTaken: 0,
    biggestWin: null,
    handsPlayed: 0,
    bestHand: null,
    bestCrib: null,
    averageHand: null,
    averageCrib: null,
    averagePegging: null,
    byDifficulty: {},
  };
  const handPoints: number[] = [];
  const cribPoints: number[] = [];
  const pegging: number[] = [];

  for (const game of games) {
    const won = game.winner === 'you';
    const level = (stats.byDifficulty[game.difficulty] ??= { wins: 0, losses: 0 });
    if (won) {
      stats.wins++;
      level.wins++;
      stats.currentStreak = stats.currentStreak > 0 ? stats.currentStreak + 1 : 1;
      stats.bestWinStreak = Math.max(stats.bestWinStreak, stats.currentStreak);
      stats.biggestWin = Math.max(stats.biggestWin ?? 0, game.score.you - game.score.cpu);
      if (game.skunk !== 'none') stats.skunksGiven++;
    } else {
      stats.losses++;
      level.losses++;
      stats.currentStreak = stats.currentStreak < 0 ? stats.currentStreak - 1 : -1;
      if (game.skunk !== 'none') stats.skunksTaken++;
    }

    for (const hand of game.hands) {
      stats.handsPlayed++;
      pegging.push(hand.you.pegging);
      if (hand.you.handPoints !== null) {
        handPoints.push(hand.you.handPoints);
        if (hand.you.kept && hand.starter && hand.you.handPoints > (stats.bestHand?.points ?? -1)) {
          stats.bestHand = { points: hand.you.handPoints, cards: hand.you.kept, starter: hand.starter };
        }
      }
      if (hand.you.cribPoints !== null) {
        cribPoints.push(hand.you.cribPoints);
        stats.bestCrib = Math.max(stats.bestCrib ?? 0, hand.you.cribPoints);
      }
    }
  }

  stats.winPercent = games.length === 0 ? null : (100 * stats.wins) / games.length;
  stats.averageHand = average(handPoints);
  stats.averageCrib = average(cribPoints);
  stats.averagePegging = average(pegging);
  return stats;
}
