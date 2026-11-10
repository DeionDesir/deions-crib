// Text version of the game, for trying out the rules engine in a terminal.
//
//   npm run play                  you against the basic bot
//   npm run play -- --seed 42     same shuffles every time
//   npm run play -- --auto        the bot plays both sides and prints the game

import * as readline from 'node:readline/promises';
import { chooseDiscard, choosePlay } from '../ai/basicBot';
import { drawCards } from './cardArt';
import {
  Card,
  GameEvent,
  GameState,
  Player,
  cardToString,
  cardsToString,
  discard,
  legalPlays,
  newGame,
  nextHand,
  playCard,
  playersToAct,
  sameCard,
} from '../engine';

const args = process.argv.slice(2);
const auto = args.includes('--auto');
const seedIndex = args.indexOf('--seed');
const seed = seedIndex >= 0 ? Number(args[seedIndex + 1]) : undefined;

const HUMAN: Player = 0;
const NAMES = auto ? ['Bot A', 'Bot B'] : ['You', 'CPU'];
const name = (player: Player) => NAMES[player];
/** "You play" but "CPU plays". */
const does = (player: Player, verb: string) => `${name(player)} ${verb}${NAMES[player] === 'You' ? '' : 's'}`;

const REASONS: Record<string, string> = {
  heels: 'his heels',
  fifteen: 'fifteen',
  thirtyone: 'thirty-one',
  pair: 'pairs',
  run: 'a run',
  go: 'go',
  lastcard: 'last card',
  hand: 'hand',
  crib: 'crib',
};

function describe(event: GameEvent): string {
  switch (event.type) {
    case 'cutForDeal':
      return `Cut for deal: ${name(0)} ${cardToString(event.cards[0])}, ${name(1)} ${cardToString(event.cards[1])}. Low card deals: ${name(event.dealer)}.`;
    case 'deal':
      return `\n=== Hand ${event.handNumber} | Dealer: ${name(event.dealer)} ===`;
    case 'discard': {
      const visible = auto || event.player === HUMAN;
      return `${does(event.player, 'discard')} ${visible ? cardsToString(event.cards) : 'two cards'} to the crib.`;
    }
    case 'starter':
      return `Starter: ${cardToString(event.card)}`;
    case 'play':
      return `${does(event.player, 'play')} ${cardToString(event.card)}  (count ${event.count})`;
    case 'go':
      return `${does(event.player, 'say')} go.`;
    case 'reset':
      return 'Count resets to 0.';
    case 'show': {
      const owner = `${name(event.player)}'s ${event.source}`;
      const lines = [
        `\n${owner}: ${event.score.total}`,
        drawCards([...event.cards, event.starter], {
          gapAfter: event.cards.length,
          labels: [...event.cards.map(() => ''), 'starter'],
        }),
      ];
      for (const item of event.score.items) {
        lines.push(`    ${item.kind} for ${item.points}: ${cardsToString(item.cards)}`);
      }
      return lines.join('\n');
    }
    case 'score':
      return `  +${event.points} ${name(event.player)} (${REASONS[event.reason]})   [${name(0)} ${event.scores[0]} - ${name(1)} ${event.scores[1]}]`;
    case 'gameover': {
      const skunk = event.skunk === 'double' ? ' Double skunk!' : event.skunk === 'skunk' ? ' Skunk!' : '';
      return `\n${does(event.winner, 'win')} the game.${skunk}`;
    }
  }
}

let printed = 0;
function printNewEvents(state: GameState): void {
  for (const event of state.events.slice(printed)) console.log(describe(event));
  printed = state.events.length;
}

const numberLabels = (cards: readonly Card[]) => cards.map((_, i) => `[${i + 1}]`);

/** The starter and the cards played since the count last reset, with who played each. */
function drawTable(state: GameState): string {
  const played = state.play.history.slice(-state.play.sequence.length);
  return drawCards([state.starter!, ...played.map((p) => p.card)], {
    gapAfter: 1,
    labels: ['starter', ...played.map((p) => name(p.player))],
  });
}

async function main(): Promise<void> {
  const rl = auto ? null : readline.createInterface({ input: process.stdin, output: process.stdout });

  /** Keeps asking until the answer is the right number of distinct card positions. */
  async function pick(prompt: string, cards: readonly Card[], howMany: number): Promise<Card[]> {
    for (;;) {
      const answer = (await rl!.question(prompt)).trim().toLowerCase();
      if (answer === 'q' || answer === 'quit') {
        rl!.close();
        process.exit(0);
      }
      const picks = answer.split(/[\s,]+/).map(Number);
      const valid =
        picks.length === howMany &&
        picks.every((n) => Number.isInteger(n) && n >= 1 && n <= cards.length) &&
        new Set(picks).size === howMany;
      if (valid) return picks.map((n) => cards[n - 1]);
      console.log(`  Type ${howMany === 1 ? 'one number' : `${howMany} numbers`} from the list (or q to quit).`);
    }
  }

  console.log("DEION'S CRIB - text mode");
  let state = newGame({ seed });
  printNewEvents(state);

  while (state.phase !== 'gameover') {
    if (state.phase === 'handover') {
      if (rl) await rl.question('\nPress Enter for the next hand...');
      state = nextHand(state);
    } else if (state.phase === 'discard') {
      for (const player of playersToAct(state)) {
        if (rl && player === HUMAN) {
          const hand = [...state.hands[player]].sort((a, b) => a.rank - b.rank);
          const crib = state.dealer === HUMAN ? 'your crib' : "the CPU's crib";
          console.log(`\nYour hand:\n${drawCards(hand, { labels: numberLabels(hand) })}`);
          state = discard(state, player, await pick(`Discard two to ${crib} (e.g. "1 4"): `, hand, 2));
        } else {
          state = discard(state, player, chooseDiscard(state, player));
        }
        printNewEvents(state);
      }
    } else {
      const player = state.play.turn;
      if (rl && player === HUMAN) {
        const hand = [...state.play.remaining[player]].sort((a, b) => a.rank - b.rank);
        const legal = legalPlays(state, player);
        const cpuCards = state.play.remaining[HUMAN === 0 ? 1 : 0].length;
        console.log(`\nOn the table (count ${state.play.count}):\n${drawTable(state)}`);
        console.log(`\nYour hand (CPU has ${cpuCards} left):`);
        console.log(drawCards(hand, {
          labels: numberLabels(hand),
          dimmed: hand.map((c) => !legal.some((l) => sameCard(l, c))),
        }));
        let card: Card;
        for (;;) {
          [card] = await pick('Play a card: ', hand, 1);
          if (legal.some((c) => sameCard(c, card))) break;
          console.log('  That card would take the count over 31.');
        }
        state = playCard(state, player, card);
      } else {
        state = playCard(state, player, choosePlay(state, player));
      }
    }
    printNewEvents(state);
  }

  console.log(`Final score: ${name(0)} ${state.scores[0]} - ${name(1)} ${state.scores[1]}`);
  rl?.close();
}

main();
