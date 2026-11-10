// The game screen.
//
// The rules engine does all the thinking. This file keeps a small "view" of
// what is on screen and walks through the engine's events one at a time,
// pausing between them, so the player can follow what happened.

import { chooseDiscard, choosePlay } from '../ai/cpu';
import { Card, sameCard } from '../engine/cards';
import {
  GameEvent,
  GameState,
  Player,
  ScoreReason,
  discard,
  legalPlays,
  newGame,
  nextHand,
  playCard,
} from '../engine/game';
import { HandScoreItem } from '../engine/scoring';
import { GameMeta, GameRecord, buildGameRecord } from '../stats/records';
import { h, sleep } from './dom';
import { pegboard } from './pegboard';
import { cardBack, cardChip, cardEl } from './skin';
import { Sound } from './sound';
import { SavedGame, Settings, saveGame } from './storage';

const HUMAN: Player = 0;
const CPU: Player = 1;

const SPEEDS = { slow: 1100, normal: 700, fast: 350 };

type ShowEvent = Extract<GameEvent, { type: 'show' }>;
type GameOverEvent = Extract<GameEvent, { type: 'gameover' }>;

/** What the buttons and cards do right now. */
type Mode =
  | 'watch' // something is being shown; no input
  | 'discard' // choose two cards for the crib
  | 'play' // choose a card to peg
  | 'continue' // press the button to carry on
  | 'count'; // enter your own count for a hand

/** What is on the table, as currently shown (it lags the engine while events play out). */
interface View {
  scores: [number, number];
  backPegs: [number, number];
  dealer: Player;
  hand: Card[];
  cpuCards: number;
  crib: number;
  starter: Card | null;
  table: { player: Player; card: Card }[];
  count: number;
  /** True from the starter being cut until the hands are shown. */
  pegging: boolean;
  message: string;
  cut: [Card, Card] | null;
  show: ShowEvent | null;
  /** In count-it-yourself mode: null until the player has answered. */
  guess: number | null;
  result: GameOverEvent | null;
}

export interface GameDeps {
  settings: Settings;
  sound: Sound;
  /** Called when the player leaves for the title screen. */
  onExit: () => void;
  onNewGame: () => void;
  onFinished: (record: GameRecord) => void;
}

const who = (player: Player) => (player === HUMAN ? 'You' : 'CPU');
const sortHand = (cards: readonly Card[]) =>
  [...cards].sort((a, b) => a.rank - b.rank || a.suit.localeCompare(b.suit));

function scoreText(reason: ScoreReason, points: number): string {
  switch (reason) {
    case 'fifteen':
      return `fifteen for ${points}`;
    case 'thirtyone':
      return `thirty-one for ${points}`;
    case 'pair':
      return points === 2 ? 'a pair for 2' : points === 6 ? 'three of a kind for 6' : `four of a kind for ${points}`;
    case 'run':
      return `a run of ${points} for ${points}`;
    case 'go':
      return `a go for ${points}`;
    case 'lastcard':
      return `last card for ${points}`;
    case 'heels':
      return `his heels for ${points}`;
    default:
      return `${points}`;
  }
}

function itemLabel(item: HandScoreItem): string {
  switch (item.kind) {
    case 'fifteen':
      return '15';
    case 'pair':
      return 'Pair';
    case 'run':
      return 'Run';
    case 'flush':
      return 'Flush';
    case 'nobs':
      return 'Nobs';
  }
}

/** The view that matches an engine state exactly (used when resuming a saved game). */
function viewFromState(state: GameState): View {
  const playing = state.phase === 'play';
  return {
    scores: [...state.scores],
    backPegs: [...state.backPegs],
    dealer: state.dealer,
    hand: sortHand(playing ? state.play.remaining[HUMAN] : state.phase === 'discard' ? state.hands[HUMAN] : []),
    cpuCards: playing ? state.play.remaining[CPU].length : state.phase === 'discard' ? state.hands[CPU].length : 0,
    crib: state.crib.length,
    starter: state.starter,
    table: playing ? state.play.history.slice(state.play.history.length - state.play.sequence.length) : [],
    count: playing ? state.play.count : 0,
    pegging: playing,
    message: '',
    cut: null,
    show: null,
    guess: null,
    result: null,
  };
}

export class GameScreen {
  readonly el = h('div', { class: 'screen game' });

  private state: GameState;
  private meta: GameMeta;
  private view: View;
  private mode: Mode = 'watch';
  private buttonLabel = '';
  private selected: Card[] = [];
  private countInput = 0;
  private paused = false;
  /** Set to false when the screen is left, so pending timers do nothing. */
  private alive = true;
  private resolveContinue: (() => void) | null = null;

  constructor(
    private deps: GameDeps,
    saved: SavedGame | null,
  ) {
    if (saved) {
      this.state = saved.state;
      this.meta = saved.meta;
      this.view = viewFromState(this.state);
      this.render();
      void this.advance();
    } else {
      this.state = newGame();
      this.meta = {
        id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
        startedAt: new Date().toISOString(),
        difficulty: deps.settings.difficulty,
      };
      this.view = viewFromState(this.state);
      this.view.hand = [];
      this.view.cpuCards = 0;
      this.save();
      void this.present(this.state.events).then(() => this.advance());
    }
  }

  /** Stops everything; called when the app switches to another screen. */
  destroy(): void {
    this.alive = false;
  }

  // ------------------------------------------------------------ game flow

  private get delay(): number {
    return SPEEDS[this.deps.settings.speed];
  }

  private save(): void {
    if (this.state.phase === 'gameover') {
      saveGame(null);
      this.deps.onFinished(buildGameRecord(this.state, this.meta, HUMAN, new Date().toISOString()));
    } else {
      saveGame({ state: this.state, meta: this.meta });
    }
  }

  /** Takes a new state from the engine and plays out whatever just happened. */
  private async apply(next: GameState): Promise<void> {
    const events = next.events.slice(this.state.events.length);
    this.state = next;
    this.save();
    await this.present(events);
  }

  /** Decides what happens next: wait for the player, or let the CPU move. */
  private async advance(): Promise<void> {
    while (this.alive) {
      const state = this.state;
      const level = this.meta.difficulty as Settings['difficulty'];

      if (state.phase === 'gameover') {
        // Only reached when a finished game is being shown again.
        return;
      }
      if (state.phase === 'handover') {
        await this.waitForContinue('Next hand');
        if (!this.alive) return;
        await this.apply(nextHand(state));
      } else if (state.phase === 'discard') {
        if (state.hands[HUMAN].length === state.rules.dealSize) {
          this.view.message = `Pick two cards for ${state.dealer === HUMAN ? 'your' : "the CPU's"} crib.`;
          this.setMode('discard');
          return;
        }
        await this.apply(discard(state, CPU, chooseDiscard(state, CPU, level)));
      } else if (state.play.turn === HUMAN) {
        this.view.message = state.play.count === 0 ? 'Your lead.' : 'Your turn.';
        this.setMode('play');
        return;
      } else {
        this.setMode('watch');
        await sleep(this.delay);
        if (!this.alive) return;
        await this.apply(playCard(state, CPU, choosePlay(state, CPU, level)));
      }
    }
  }

  /** Shows a list of engine events one by one. */
  private async present(events: GameEvent[]): Promise<void> {
    const view = this.view;
    const sound = this.deps.sound;
    this.mode = 'watch';

    for (let i = 0; i < events.length; i++) {
      if (!this.alive) return;
      const event = events[i];

      switch (event.type) {
        case 'cutForDeal':
          view.cut = event.cards;
          view.message = `Cut for first deal. Low card deals: ${event.dealer === HUMAN ? 'you' : 'CPU'}.`;
          sound.play('card');
          await this.waitForContinue('Deal');
          view.cut = null;
          break;

        case 'deal':
          Object.assign(view, {
            dealer: event.dealer,
            hand: sortHand(this.state.phase === 'discard' ? this.state.hands[HUMAN] : []),
            cpuCards: this.state.rules.dealSize,
            crib: 0,
            starter: null,
            table: [],
            count: 0,
            pegging: false,
            message: `Hand ${event.handNumber}. ${event.dealer === HUMAN ? 'You deal' : 'CPU deals'}.`,
          });
          sound.play('deal');
          this.render();
          await sleep(this.delay);
          break;

        case 'discard':
          if (event.player === HUMAN) {
            view.hand = view.hand.filter((c) => !event.cards.some((d) => sameCard(c, d)));
          } else {
            view.cpuCards -= event.cards.length;
          }
          view.crib += event.cards.length;
          view.message = '';
          this.render();
          await sleep(this.delay * 0.5);
          break;

        case 'starter':
          view.starter = event.card;
          view.pegging = true;
          view.message = 'The starter is cut.';
          sound.play('card');
          this.render();
          await sleep(this.delay);
          break;

        case 'play':
          if (event.player === HUMAN) view.hand = view.hand.filter((c) => !sameCard(c, event.card));
          else view.cpuCards -= 1;
          view.table.push({ player: event.player, card: event.card });
          view.count = event.count;
          view.message = '';
          sound.play('card');
          this.render();
          await sleep(this.delay * 0.8);
          break;

        case 'go':
          view.message = `${who(event.player)} ${event.player === HUMAN ? 'say' : 'says'} go.`;
          sound.play('go');
          this.render();
          await sleep(this.delay);
          break;

        case 'reset':
          await sleep(this.delay * 0.5);
          view.table = [];
          view.count = 0;
          this.render();
          break;

        case 'score':
          this.applyScore(event);
          view.message = `${who(event.player)}: ${scoreText(event.reason, event.points)}.`;
          sound.play(event.points >= 6 ? 'bigScore' : 'score');
          this.render();
          await sleep(this.delay * 1.3);
          break;

        case 'show': {
          // The points for a hand arrive as the very next event.
          const next = events[i + 1];
          const points = next?.type === 'score' && (next.reason === 'hand' || next.reason === 'crib') ? next : null;
          if (points) i++;

          view.show = event;
          view.pegging = false;
          view.table = [];
          view.count = 0;
          view.message = '';
          view.guess = null;
          if (this.deps.settings.countYourself && event.player === HUMAN) {
            this.countInput = 0;
            await this.waitForContinue('Check', 'count');
            if (!this.alive) return;
            view.guess = this.countInput;
            sound.play(view.guess === event.score.total ? 'score' : 'wrong');
          } else if (event.score.total > 0) {
            sound.play(event.score.total >= 12 ? 'bigScore' : 'score');
          }
          if (points) this.applyScore(points);
          // If this count wins the game, the result is shown straight after.
          await this.waitForContinue(events[i + 1]?.type === 'gameover' ? 'Finish' : 'OK');
          view.show = null;
          break;
        }

        case 'gameover':
          view.result = event;
          view.message = '';
          sound.play(event.winner === HUMAN ? 'win' : 'lose');
          this.mode = 'watch';
          this.render();
          break;
      }
    }
  }

  private applyScore(event: Extract<GameEvent, { type: 'score' }>): void {
    this.view.backPegs[event.player] = this.view.scores[event.player];
    this.view.scores = [...event.scores];
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.selected = [];
    this.render();
  }

  /** Shows a button and waits until it is pressed. */
  private waitForContinue(label: string, mode: Mode = 'continue'): Promise<void> {
    this.buttonLabel = label;
    this.setMode(mode);
    return new Promise((resolve) => {
      this.resolveContinue = () => {
        this.resolveContinue = null;
        this.mode = 'watch';
        resolve();
      };
    });
  }

  // ---------------------------------------------------------------- input

  private tapCard(card: Card): void {
    if (this.paused) return;
    const already = this.selected.some((c) => sameCard(c, card));

    if (this.mode === 'discard') {
      if (already) this.selected = this.selected.filter((c) => !sameCard(c, card));
      else this.selected = [...this.selected, card].slice(-2);
      this.deps.sound.play('select');
      this.render();
    } else if (this.mode === 'play') {
      if (!legalPlays(this.state, HUMAN).some((c) => sameCard(c, card))) {
        this.view.message = `That would take the count past ${this.state.rules.maxCount}.`;
        this.deps.sound.play('wrong');
        this.render();
      } else if (already) {
        void this.confirm(); // tapping the raised card plays it
      } else {
        this.selected = [card];
        this.deps.sound.play('select');
        this.render();
      }
    }
  }

  /** The main button, or Enter. */
  private async confirm(): Promise<void> {
    if (this.paused) return;
    if (this.resolveContinue) {
      this.resolveContinue();
      return;
    }
    const picked = this.selected;
    if (this.mode === 'discard' && picked.length === 2) {
      this.setMode('watch');
      await this.apply(discard(this.state, HUMAN, picked));
      await this.advance();
    } else if (this.mode === 'play' && picked.length === 1) {
      this.setMode('watch');
      await this.apply(playCard(this.state, HUMAN, picked[0]));
      await this.advance();
    }
  }

  private changeCount(by: number): void {
    this.countInput = Math.max(0, Math.min(29, this.countInput + by));
    this.deps.sound.play('select');
    this.render();
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    this.render();
  }

  /** Keyboard: 1-6 pick a card, Enter confirms, arrows change a count, Esc pauses. */
  onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (!this.view.result) this.setPaused(!this.paused);
    } else if (this.paused) {
      return;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      void this.confirm();
    } else if (/^[1-6]$/.test(event.key)) {
      const card = this.view.hand[Number(event.key) - 1];
      if (card) this.tapCard(card);
    } else if (this.mode === 'count' && (event.key === 'ArrowUp' || event.key === 'ArrowRight')) {
      this.changeCount(1);
    } else if (this.mode === 'count' && (event.key === 'ArrowDown' || event.key === 'ArrowLeft')) {
      this.changeCount(-1);
    }
  }

  // --------------------------------------------------------------- drawing

  private render(): void {
    if (!this.alive) return;
    const view = this.view;
    const state = this.state;
    const legal = this.mode === 'play' ? legalPlays(state, HUMAN) : [];
    const isSelected = (card: Card) => this.selected.some((c) => sameCard(c, card));
    const pad = (n: number) => String(n).padStart(3, '0');

    const hud = h(
      'header',
      { class: 'hud' },
      h('span', { class: 'hud-score' }, h('i', { class: 'dot cpu' }), `CPU ${pad(view.scores[CPU])}`),
      h('span', { class: 'hud-score' }, h('i', { class: 'dot you' }), `You ${pad(view.scores[HUMAN])}`),
      !view.result &&
        h('button', { class: 'pause', type: 'button', 'aria-label': 'Pause', onclick: () => this.setPaused(true) }, 'II'),
    );

    // CPU's cards (face down) and the crib pile.
    const cpuRow = h(
      'div',
      { class: 'cpu-row' },
      h('div', { class: 'cpu-hand' }, ...Array.from({ length: view.cpuCards }, () => cardBack('mini'))),
      view.crib > 0 &&
        h(
          'div',
          { class: 'crib' },
          h('span', {}, view.dealer === HUMAN ? 'Your crib' : 'CPU crib'),
          cardBack('mini'),
        ),
    );

    // The table: starter (or the deck), then the cards played this count.
    const table = view.cut
      ? h(
          'div',
          { class: 'table cut' },
          h('div', { class: 'cut-card' }, cardEl(view.cut[CPU]), h('span', {}, 'CPU')),
          h('div', { class: 'cut-card' }, cardEl(view.cut[HUMAN]), h('span', {}, 'You')),
        )
      : h(
          'div',
          { class: 'table' },
          h('div', { class: 'starter' }, view.starter ? cardEl(view.starter, { class: 'on-deck' }) : cardBack('on-deck')),
          h(
            'div',
            { class: 'pile' },
            ...view.table.map((p) => cardEl(p.card, { class: p.player === HUMAN ? 'mine' : 'theirs' })),
          ),
          view.pegging && h('div', { class: 'count' }, h('span', {}, 'Count'), h('b', {}, view.count)),
        );

    const message = h('p', { class: 'message', 'aria-live': 'polite' }, view.message);

    const hand = h(
      'div',
      { class: 'hand' },
      ...view.hand.map((card) =>
        cardEl(card, {
          selected: isSelected(card),
          dimmed: this.mode === 'play' && !legal.some((c) => sameCard(c, card)),
          onclick: () => this.tapCard(card),
        }),
      ),
    );

    let button: HTMLElement | null = null;
    if (this.mode === 'discard') {
      button = this.button('Send to crib', this.selected.length !== 2);
    } else if (this.mode === 'play') {
      button = this.button('Play card', this.selected.length !== 1);
    } else if (this.mode === 'continue' && !view.show) {
      button = this.button(this.buttonLabel);
    }

    const covered = view.show || view.result || this.paused;
    const stage = h(
      'div',
      { class: covered ? 'stage covered' : 'stage' },
      cpuRow,
      table,
      message,
      hand,
      h('div', { class: 'actions' }, button),
      view.show && this.showPanel(view.show),
      view.result && this.resultPanel(view.result),
      this.paused && this.pausePanel(),
    );

    const board = pegboard(
      { you: view.scores[HUMAN], cpu: view.scores[CPU], youBack: view.backPegs[HUMAN], cpuBack: view.backPegs[CPU] },
      state.rules,
    );

    this.el.replaceChildren(hud, stage, h('div', { class: 'board-wrap' }, board));
  }

  private button(label: string, disabled = false): HTMLElement {
    return h('button', { class: 'btn primary', type: 'button', disabled, onclick: () => void this.confirm() }, label);
  }

  /** A hand or crib laid out with its score, item by item. */
  private showPanel(show: ShowEvent): HTMLElement {
    const mine = show.player === HUMAN;
    const title = `${mine ? 'Your' : "CPU's"} ${show.source}`;
    const cards = h(
      'div',
      { class: 'show-cards' },
      ...sortHand(show.cards).map((c) => cardEl(c)),
      h('div', { class: 'show-starter' }, cardEl(show.starter)),
    );

    if (this.mode === 'count') {
      return h(
        'div',
        { class: 'panel show' },
        h('h2', {}, title),
        cards,
        h('p', { class: 'panel-text' }, 'How many points? Count it yourself.'),
        h(
          'div',
          { class: 'stepper' },
          h('button', { class: 'btn', type: 'button', 'aria-label': 'One less', onclick: () => this.changeCount(-1) }, '-'),
          h('b', { 'aria-live': 'polite' }, this.countInput),
          h('button', { class: 'btn', type: 'button', 'aria-label': 'One more', onclick: () => this.changeCount(1) }, '+'),
        ),
        this.button(this.buttonLabel),
      );
    }

    const verdict =
      this.view.guess === null
        ? null
        : this.view.guess === show.score.total
          ? `You counted ${this.view.guess}. Correct!`
          : `You counted ${this.view.guess}. It is ${show.score.total}.`;

    return h(
      'div',
      { class: 'panel show' },
      h('h2', {}, title),
      cards,
      verdict && h('p', { class: 'panel-text' }, verdict),
      h(
        'ul',
        { class: 'items' },
        ...show.score.items.map((item) =>
          h('li', {}, h('span', { class: 'item-name' }, itemLabel(item)), h('span', { class: 'item-cards' }, ...sortHand(item.cards).map(cardChip)), h('b', {}, item.points)),
        ),
        show.score.items.length === 0 && h('li', { class: 'none' }, 'Nothing to count.'),
      ),
      h('p', { class: 'total' }, h('span', {}, 'Total'), h('b', {}, show.score.total)),
      this.button(this.buttonLabel),
    );
  }

  private resultPanel(result: GameOverEvent): HTMLElement {
    const won = result.winner === HUMAN;
    const skunk = result.skunk === 'double' ? 'Double skunk!' : result.skunk === 'skunk' ? 'Skunk!' : null;
    return h(
      'div',
      { class: 'panel result' },
      h('h2', {}, won ? 'You win!' : 'CPU wins'),
      skunk && h('p', { class: 'panel-text big' }, skunk),
      h('p', { class: 'panel-text' }, `You ${this.view.scores[HUMAN]}, CPU ${this.view.scores[CPU]}`),
      h('p', { class: 'panel-text' }, `${this.state.handNumber} hands on ${this.meta.difficulty}.`),
      h('button', { class: 'btn primary', type: 'button', onclick: this.deps.onNewGame }, 'Play again'),
      h('button', { class: 'btn', type: 'button', onclick: this.deps.onExit }, 'Title screen'),
    );
  }

  private pausePanel(): HTMLElement {
    return h(
      'div',
      { class: 'panel pause-panel' },
      h('h2', {}, 'Paused'),
      h('p', { class: 'panel-text' }, 'Your game is saved as you play.'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => this.setPaused(false) }, 'Resume'),
      h('button', { class: 'btn', type: 'button', onclick: this.deps.onExit }, 'Title screen'),
    );
  }
}
