// The game flow: deal -> discard -> starter -> pegging -> show -> next hand.
//
// The whole game lives in one plain GameState object. Each action (discard,
// playCard, nextHand) takes a state and returns a NEW state; the old one is
// never changed. Everything that happens is appended to `state.events`, so a
// UI can animate a move by reading the events added since the last state.

import { Card, cardValue, createDeck, nextRandom, sameCard, shuffle } from './cards';
import { Ruleset, STANDARD_RULES } from './rules';
import { HandScore, scoreHand, scorePegging } from './scoring';

export type Player = 0 | 1;
export const otherPlayer = (player: Player): Player => (player === 0 ? 1 : 0);

/**
 * discard  - players are choosing cards for the crib
 * play     - pegging
 * handover - hand has been counted; call nextHand() to deal again
 * gameover - somebody reached the target score
 */
export type Phase = 'discard' | 'play' | 'handover' | 'gameover';

export type ScoreReason =
  | 'heels'
  | 'fifteen'
  | 'thirtyone'
  | 'pair'
  | 'run'
  | 'go'
  | 'lastcard'
  | 'hand'
  | 'crib';

export type Skunk = 'none' | 'skunk' | 'double';

export type GameEvent =
  | { type: 'cutForDeal'; cards: [Card, Card]; dealer: Player }
  | { type: 'deal'; dealer: Player; handNumber: number }
  | { type: 'discard'; player: Player; cards: Card[] }
  | { type: 'starter'; card: Card }
  | { type: 'play'; player: Player; card: Card; count: number }
  | { type: 'go'; player: Player }
  | { type: 'reset' }
  | { type: 'show'; player: Player; source: 'hand' | 'crib'; cards: Card[]; starter: Card; score: HandScore }
  | { type: 'score'; player: Player; points: number; reason: ScoreReason; scores: [number, number] }
  | { type: 'gameover'; winner: Player; skunk: Skunk };

export interface PlayState {
  /** Running count, 0 to 31. */
  count: number;
  /** Cards played since the count last reset. */
  sequence: Card[];
  /** Cards each player still has to play. */
  remaining: [Card[], Card[]];
  /** Whose turn it is to play a card. */
  turn: Player;
  /** Who has said "go" since the count last reset. */
  goSaid: [boolean, boolean];
  /** Every card played this hand, in order. */
  history: { player: Player; card: Card }[];
}

export interface GameState {
  rules: Ruleset;
  rngState: number;
  phase: Phase;
  dealer: Player;
  handNumber: number;
  scores: [number, number];
  /** Each player's back peg: their score before their most recent points. */
  backPegs: [number, number];
  /** Each player's cards: six after the deal, four after discarding. */
  hands: [Card[], Card[]];
  crib: Card[];
  /** Undealt cards; the starter is cut from here. */
  stock: Card[];
  starter: Card | null;
  play: PlayState;
  winner: Player | null;
  skunk: Skunk;
  events: GameEvent[];
}

export interface NewGameOptions {
  /** Same seed = same shuffles. Omit for a random game. */
  seed?: number;
  rules?: Ruleset;
  /** Skip the cut for first deal and name the dealer directly. */
  firstDealer?: Player;
}

// ---------------------------------------------------------------- actions

export function newGame(options: NewGameOptions = {}): GameState {
  const state: GameState = {
    rules: options.rules ?? STANDARD_RULES,
    rngState: (options.seed ?? Math.floor(Math.random() * 2 ** 32)) | 0,
    phase: 'discard',
    dealer: 0,
    handNumber: 0,
    scores: [0, 0],
    backPegs: [0, 0],
    hands: [[], []],
    crib: [],
    stock: [],
    starter: null,
    play: emptyPlay(0),
    winner: null,
    skunk: 'none',
    events: [],
  };
  state.dealer = options.firstDealer ?? cutForDeal(state);
  dealHand(state);
  return state;
}

/** Puts cards from a player's dealt hand into the crib. */
export function discard(state: GameState, player: Player, cards: readonly Card[]): GameState {
  const s = structuredClone(state);
  const { dealSize, handSize } = s.rules;
  if (s.phase !== 'discard') throw new Error('Not in the discard phase');
  if (s.hands[player].length !== dealSize) throw new Error('Player has already discarded');
  if (cards.length !== dealSize - handSize) {
    throw new Error(`Must discard exactly ${dealSize - handSize} cards`);
  }
  for (const card of cards) {
    if (!s.hands[player].some((c) => sameCard(c, card))) throw new Error('Card is not in hand');
  }
  if (cards.some((a, i) => cards.some((b, j) => i !== j && sameCard(a, b)))) {
    throw new Error('Cannot discard the same card twice');
  }

  s.hands[player] = s.hands[player].filter((c) => !cards.some((d) => sameCard(c, d)));
  s.crib.push(...cards);
  s.events.push({ type: 'discard', player, cards: [...cards] });

  // Once both players have discarded, cut the starter and begin pegging.
  if (s.hands[0].length === handSize && s.hands[1].length === handSize) {
    let r: number;
    [r, s.rngState] = nextRandom(s.rngState);
    const starter = s.stock[Math.floor(r * s.stock.length)];
    s.starter = starter;
    s.events.push({ type: 'starter', card: starter });
    s.phase = 'play';
    s.play = emptyPlay(otherPlayer(s.dealer));
    s.play.remaining = [[...s.hands[0]], [...s.hands[1]]];
    // His heels: a jack as the starter scores for the dealer.
    if (starter.rank === 11) addPoints(s, s.dealer, s.rules.points.heels, 'heels');
  }
  return s;
}

/** Cards the player could legally play right now (empty if it isn't their turn). */
export function legalPlays(state: GameState, player: Player): Card[] {
  if (state.phase !== 'play' || state.play.turn !== player) return [];
  return playable(state, player);
}

/**
 * Plays a card during pegging. "Go" is handled automatically: if the other
 * player cannot play, the turn stays with the same player, and when neither
 * can play the point for go (or last card) is awarded and the count resets.
 */
export function playCard(state: GameState, player: Player, card: Card): GameState {
  const s = structuredClone(state);
  const play = s.play;
  if (s.phase !== 'play') throw new Error('Not in the play phase');
  if (play.turn !== player) throw new Error("Not this player's turn");
  if (!play.remaining[player].some((c) => sameCard(c, card))) throw new Error('Card is not in hand');
  if (play.count + cardValue(card) > s.rules.maxCount) {
    throw new Error(`Card would take the count over ${s.rules.maxCount}`);
  }

  play.remaining[player] = play.remaining[player].filter((c) => !sameCard(c, card));
  play.count += cardValue(card);
  play.sequence.push(card);
  play.history.push({ player, card });
  s.events.push({ type: 'play', player, card, count: play.count });

  for (const item of scorePegging(play.sequence, s.rules)) {
    if (addPoints(s, player, item.points, item.kind)) return s;
  }

  const opponent = otherPlayer(player);
  const cardsLeft = play.remaining[0].length + play.remaining[1].length;

  if (play.count === s.rules.maxCount) {
    // 31 already scored above; it replaces the point for go.
    endSequence(s, player, cardsLeft);
  } else if (playable(s, opponent).length > 0) {
    play.turn = opponent;
  } else {
    // Opponent can't play. If they still hold cards, they say "go".
    if (play.remaining[opponent].length > 0 && !play.goSaid[opponent]) {
      play.goSaid[opponent] = true;
      s.events.push({ type: 'go', player: opponent });
    }
    if (playable(s, player).length > 0) {
      play.turn = player;
    } else {
      // Neither can play: the last player to lay a card takes the point.
      const reason: ScoreReason = cardsLeft === 0 ? 'lastcard' : 'go';
      if (addPoints(s, player, s.rules.points.go, reason)) return s;
      endSequence(s, player, cardsLeft);
    }
  }
  return s;
}

/** Deals the next hand after a hand has been counted. The deal alternates. */
export function nextHand(state: GameState): GameState {
  if (state.phase !== 'handover') throw new Error('The current hand is not finished');
  const s = structuredClone(state);
  s.dealer = otherPlayer(s.dealer);
  dealHand(s);
  return s;
}

/** Who needs to act right now. Both players can be waiting during the discard. */
export function playersToAct(state: GameState): Player[] {
  if (state.phase === 'discard') {
    return ([0, 1] as Player[]).filter((p) => state.hands[p].length === state.rules.dealSize);
  }
  if (state.phase === 'play') return [state.play.turn];
  return [];
}

// ---------------------------------------------------------------- internals
// These change the state they are given. They are only ever called on a
// fresh copy made by one of the actions above.

function emptyPlay(turn: Player): PlayState {
  return { count: 0, sequence: [], remaining: [[], []], turn, goSaid: [false, false], history: [] };
}

/** Each player cuts a card; the lower card deals first. Ties cut again. */
function cutForDeal(s: GameState): Player {
  for (;;) {
    const shuffled = shuffle(createDeck(), s.rngState);
    s.rngState = shuffled.rngState;
    for (let i = 0; i + 1 < shuffled.items.length; i += 2) {
      const cards: [Card, Card] = [shuffled.items[i], shuffled.items[i + 1]];
      if (cards[0].rank !== cards[1].rank) {
        const dealer: Player = cards[0].rank < cards[1].rank ? 0 : 1;
        s.events.push({ type: 'cutForDeal', cards, dealer });
        return dealer;
      }
    }
  }
}

function dealHand(s: GameState): void {
  const shuffled = shuffle(createDeck(), s.rngState);
  s.rngState = shuffled.rngState;
  const deck = shuffled.items;
  const nonDealer = otherPlayer(s.dealer);

  // Deal one at a time, non-dealer first.
  s.hands = [[], []];
  for (let i = 0; i < s.rules.dealSize * 2; i++) {
    s.hands[i % 2 === 0 ? nonDealer : s.dealer].push(deck[i]);
  }
  s.stock = deck.slice(s.rules.dealSize * 2);
  s.crib = [];
  s.starter = null;
  s.play = emptyPlay(nonDealer);
  s.phase = 'discard';
  s.handNumber += 1;
  s.events.push({ type: 'deal', dealer: s.dealer, handNumber: s.handNumber });
}

function playable(s: GameState, player: Player): Card[] {
  return s.play.remaining[player].filter((c) => s.play.count + cardValue(c) <= s.rules.maxCount);
}

/**
 * Adds points and checks for a win. Returns true if the game just ended,
 * in which case the caller must stop: nothing more is scored after a win.
 */
function addPoints(s: GameState, player: Player, points: number, reason: ScoreReason): boolean {
  if (points <= 0) return false;
  s.backPegs[player] = s.scores[player];
  s.scores[player] = Math.min(s.scores[player] + points, s.rules.targetScore);
  s.events.push({ type: 'score', player, points, reason, scores: [...s.scores] });
  if (s.scores[player] < s.rules.targetScore) return false;

  const loserScore = s.scores[otherPlayer(player)];
  s.winner = player;
  s.skunk =
    loserScore < s.rules.doubleSkunkLine ? 'double' : loserScore < s.rules.skunkLine ? 'skunk' : 'none';
  s.phase = 'gameover';
  s.events.push({ type: 'gameover', winner: player, skunk: s.skunk });
  return true;
}

/** Resets the count after a go or 31, or moves on to the show if all cards are played. */
function endSequence(s: GameState, lastPlayer: Player, cardsLeft: number): void {
  if (cardsLeft === 0) {
    showHands(s);
    return;
  }
  const opponent = otherPlayer(lastPlayer);
  s.play.count = 0;
  s.play.sequence = [];
  s.play.goSaid = [false, false];
  // The player who did not lay the last card leads, unless they are out of cards.
  s.play.turn = s.play.remaining[opponent].length > 0 ? opponent : lastPlayer;
  s.events.push({ type: 'reset' });
}

/** The show: non-dealer's hand, then dealer's hand, then the dealer's crib. */
function showHands(s: GameState): void {
  const starter = s.starter!;
  const nonDealer = otherPlayer(s.dealer);
  const counts: { player: Player; source: 'hand' | 'crib'; cards: Card[] }[] = [
    { player: nonDealer, source: 'hand', cards: s.hands[nonDealer] },
    { player: s.dealer, source: 'hand', cards: s.hands[s.dealer] },
    { player: s.dealer, source: 'crib', cards: s.crib },
  ];
  for (const { player, source, cards } of counts) {
    const score = scoreHand(cards, starter, source === 'crib', s.rules);
    s.events.push({ type: 'show', player, source, cards: [...cards], starter, score });
    // Order matters: if the non-dealer counts out, the dealer never counts.
    if (addPoints(s, player, score.total, source)) return;
  }
  s.phase = 'handover';
}
