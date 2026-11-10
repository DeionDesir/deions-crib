// How cards look. Everything is drawn from small pixel grids defined here, so
// a new skin is a new set of grids and colours rather than new code.
// Colours come from the theme (see styles.css).

import { Card, Suit, rankLabel } from '../engine/cards';
import { h, svg } from './dom';

type Bitmap = readonly string[];

const SUITS: Record<Suit, Bitmap> = {
  H: [
    '.##.##.',
    '#######',
    '#######',
    '#######',
    '.#####.',
    '..###..',
    '...#...',
  ],
  D: [
    '...#...',
    '..###..',
    '.#####.',
    '#######',
    '.#####.',
    '..###..',
    '...#...',
  ],
  S: [
    '...#...',
    '..###..',
    '.#####.',
    '#######',
    '##.#.##',
    '...#...',
    '..###..',
  ],
  C: [
    '..###..',
    '..###..',
    '##.#.##',
    '#######',
    '##.#.##',
    '...#...',
    '..###..',
  ],
};

/** Centre pictures for the face cards: shield, tiara, crown. */
const FACES: Record<number, Bitmap> = {
  11: [
    '#######',
    '#######',
    '##...##',
    '#######',
    '.#####.',
    '..###..',
    '...#...',
  ],
  12: [
    '...#...',
    '..#.#..',
    '#..#..#',
    '##.#.##',
    '#######',
    '.......',
    '#######',
  ],
  13: [
    '.......',
    '#..#..#',
    '#.###.#',
    '#######',
    '#######',
    '.......',
    '#######',
  ],
};

/** Draws a pixel grid as crisp squares that scale to any size. */
function bitmap(rows: Bitmap, className: string): SVGElement {
  let rects = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '#') continue;
      let width = 1;
      while (row[x + width] === '#') width++;
      rects += `<rect x="${x}" y="${y}" width="${width}" height="1"/>`;
      x += width - 1;
    }
  });
  return svg(
    `<svg class="${className}" viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`,
  );
}

const SUIT_NAMES: Record<Suit, string> = { H: 'hearts', D: 'diamonds', S: 'spades', C: 'clubs' };
const RANK_NAMES: Record<string, string> = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };

export const isRed = (card: Card) => card.suit === 'H' || card.suit === 'D';

/** "Jack of hearts" - used for screen readers. */
export function cardName(card: Card): string {
  const rank = rankLabel(card);
  return `${RANK_NAMES[rank] ?? rank} of ${SUIT_NAMES[card.suit]}`;
}

export interface CardOptions {
  selected?: boolean;
  dimmed?: boolean;
  /** Makes the card a button. */
  onclick?: () => void;
  /** Extra class names. */
  class?: string;
}

/** A face-up card. */
export function cardEl(card: Card, options: CardOptions = {}): HTMLElement {
  const classes = ['card', isRed(card) ? 'red' : 'black'];
  if (options.selected) classes.push('selected');
  if (options.dimmed) classes.push('dimmed');
  if (options.class) classes.push(options.class);

  const centre = FACES[card.rank] ?? SUITS[card.suit];
  return h(
    options.onclick ? 'button' : 'div',
    { class: classes.join(' '), 'aria-label': cardName(card), onclick: options.onclick, type: options.onclick && 'button' },
    h('span', { class: 'card-rank' }, rankLabel(card)),
    bitmap(SUITS[card.suit], 'card-suit'),
    bitmap(centre, 'card-centre'),
  );
}

/** A face-down card. */
export function cardBack(className = ''): HTMLElement {
  return h('div', { class: `card back ${className}`.trim() });
}

/** A card written inline in text: rank plus a tiny suit. */
export function cardChip(card: Card): HTMLElement {
  return h(
    'span',
    { class: `chip ${isRed(card) ? 'red' : 'black'}`, 'aria-label': cardName(card) },
    rankLabel(card),
    bitmap(SUITS[card.suit], 'chip-suit'),
  );
}
