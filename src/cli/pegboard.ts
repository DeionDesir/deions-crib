// Draws the cribbage board for the terminal version of the game.
//
// A real board has 121 holes per player. Here they are laid out in two rows
// of 60, in groups of five, with the finish hole at the end of the second row.
// Each player has two pegs, as on a real board: the front peg is the current
// score and the back peg sits where the front peg was before the last score,
// so you can see how far the last move went.

import { GameState } from '../engine/game';

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const PLAYER_COLORS = ['\x1b[36m', '\x1b[33m']; // cyan, yellow
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const GROUP = 5;
const FRONT_PEG = '●';
const BACK_PEG = '○';
const HOLE = '·';
const SKUNK_MARK = '┊';

const tint = (text: string, color: string) => (useColor ? color + text + RESET : text);

/** Column of a hole (1 to holes-per-row) within a row, leaving a gap after every five. */
const holeColumn = (hole: number) => hole - 1 + Math.floor((hole - 1) / GROUP);

export function drawPegboard(state: GameState, names: readonly string[]): string {
  const { targetScore, skunkLine } = state.rules;
  const perRow = Math.ceil((targetScore - 1) / 2);
  const finishColumn = holeColumn(perRow) + 2;
  const rowWidth = finishColumn + 1;
  const nameWidth = Math.max(...names.map((n) => n.length));
  const lastRow = 1;

  /** Where a score sits: the start hole, the finish hole, or a row and column. */
  const place = (score: number) => {
    if (score <= 0) return { kind: 'start' as const };
    if (score >= targetScore) return { kind: 'finish' as const };
    const row = Math.floor((score - 1) / perRow);
    return { kind: 'hole' as const, row, column: holeColumn(score - row * perRow) };
  };

  const ruler = (row: number) => {
    const cells = Array<string>(rowWidth).fill(' ');
    const write = (label: string, endColumn: number) => {
      for (let i = 0; i < label.length; i++) cells[endColumn - label.length + 1 + i] = label[i];
    };
    for (let hole = 10; hole <= perRow; hole += 10) {
      if (row === lastRow && hole === perRow) continue; // leave room for the finish label
      write(String(row * perRow + hole), holeColumn(hole));
    }
    if (row === lastRow) write(String(targetScore), finishColumn);
    return ' '.repeat(nameWidth + 3) + cells.join('').trimEnd();
  };

  const lane = (row: number, player: number) => {
    const color = PLAYER_COLORS[player];
    const cells = Array<string>(rowWidth).fill(' ');
    for (let hole = 1; hole <= perRow; hole++) cells[holeColumn(hole)] = HOLE;
    if (row === lastRow) cells[finishColumn] = HOLE;

    // Skunk line: drawn in the gap just before the skunk hole.
    const skunkHole = skunkLine - row * perRow;
    if (skunkHole > 1 && skunkHole <= perRow && (skunkHole - 1) % GROUP === 0) {
      cells[holeColumn(skunkHole) - 1] = tint(SKUNK_MARK, DIM);
    }

    let start = row === 0 ? HOLE : ' ';
    const front = state.scores[player];
    const back = state.backPegs[player];
    // Back peg first, so the front peg wins if both are in the same hole.
    for (const [score, peg] of [[back, BACK_PEG], [front, FRONT_PEG]] as const) {
      const spot = place(score);
      if (spot.kind === 'start' && row === 0) start = tint(peg, color);
      if (spot.kind === 'finish' && row === lastRow) cells[finishColumn] = tint(peg, color);
      if (spot.kind === 'hole' && spot.row === row) cells[spot.column] = tint(peg, color);
    }

    const label = tint(names[player].padEnd(nameWidth), color);
    return `${label} ${start} ${cells.join('').trimEnd()}`;
  };

  const scoreLine = [0, 1].map((p) => tint(`${names[p]} ${state.scores[p]}`, PLAYER_COLORS[p])).join(', ');
  const lines = [`Pegboard: ${scoreLine}  (first to ${targetScore})`];
  for (const row of [0, lastRow]) {
    lines.push(ruler(row), lane(row, 0), lane(row, 1));
  }
  lines.push(tint(`${FRONT_PEG} score   ${BACK_PEG} last score   ${SKUNK_MARK} skunk line (${skunkLine})`, DIM));
  return lines.join('\n');
}
