// Draws cards as text boxes for the terminal version of the game.
//
//   ┌─────┐ ┌─────┐
//   │10   │ │J    │
//   │  ♥  │ │  ♠  │
//   │   10│ │    J│
//   └─────┘ └─────┘
//     [1]     [2]

import { Card, cardToString } from '../engine/cards';

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const CARD_WIDTH = 7;

export interface CardRowOptions {
  /** Text centred under each card, e.g. "[1]" or "You". */
  labels?: string[];
  /** Cards to draw faded, e.g. ones that cannot be played right now. */
  dimmed?: boolean[];
  /** Leave a wider space after this many cards, to set one group apart. */
  gapAfter?: number;
}

function centre(text: string, width: number): string {
  const left = Math.floor((width - text.length) / 2);
  return ' '.repeat(Math.max(left, 0)) + text + ' '.repeat(Math.max(width - text.length - left, 0));
}

function paint(text: string, card: Card, dimmed: boolean): string {
  if (!useColor) return text;
  if (dimmed) return DIM + text + RESET;
  return card.suit === 'H' || card.suit === 'D' ? RED + text + RESET : text;
}

/** The five text lines that make up one card. */
function cardLines(card: Card): string[] {
  const label = cardToString(card);
  const rank = label.slice(0, -1);
  const suit = label.slice(-1);
  return [
    '┌─────┐',
    `│${rank.padEnd(5)}│`,
    `│  ${suit}  │`,
    `│${rank.padStart(5)}│`,
    '└─────┘',
  ];
}

/** Draws cards side by side, with optional labels underneath. */
export function drawCards(cards: readonly Card[], options: CardRowOptions = {}): string {
  if (cards.length === 0) return '  (no cards)';
  const gap = (i: number) => (options.gapAfter !== undefined && i === options.gapAfter - 1 ? '    ' : ' ');
  const rows: string[] = [];

  for (let line = 0; line < 5; line++) {
    rows.push(
      cards.map((card, i) => paint(cardLines(card)[line], card, options.dimmed?.[i] ?? false) + gap(i)).join(''),
    );
  }
  if (options.labels) {
    rows.push(cards.map((_, i) => centre(options.labels![i] ?? '', CARD_WIDTH) + gap(i)).join(''));
  }
  return rows.map((row) => '  ' + row.trimEnd()).join('\n');
}
