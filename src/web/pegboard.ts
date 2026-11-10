// The pegboard, drawn as pixel art.
//
// 120 holes per player in four rows of thirty, read left to right and top to
// bottom like a page, plus a start hole and the finish hole (121). Each row
// has two lanes: the CPU's on top and yours underneath. Each player has two
// pegs, as on a real board: the solid one is the score, the hollow one is
// where it stood before the last points.

import { Ruleset } from '../engine/rules';
import { svg } from './dom';

const WIDTH = 176;
const ROW_HEIGHT = 14;
const HOLES_PER_ROW = 30;
const FIRST_HOLE_X = 9;
const START_X = 2;
const TOP = 4;

const holeX = (index: number) => FIRST_HOLE_X + index * 4 + Math.floor(index / 5) * 3;
const FINISH_X = holeX(HOLES_PER_ROW - 1) + 6;

export interface BoardScores {
  you: number;
  cpu: number;
  youBack: number;
  cpuBack: number;
}

export function pegboard(scores: BoardScores, rules: Ruleset): SVGElement {
  const rows = Math.ceil((rules.targetScore - 1) / HOLES_PER_ROW);
  const height = TOP + rows * ROW_HEIGHT;
  // Lane 0 is the CPU (top), lane 1 is you.
  const laneY = (row: number, lane: number) => TOP + row * ROW_HEIGHT + lane * 5;

  const spot = (score: number, lane: number) => {
    if (score <= 0) return { x: START_X, y: laneY(0, lane) };
    if (score >= rules.targetScore) return { x: FINISH_X, y: laneY(rows - 1, lane) };
    const row = Math.floor((score - 1) / HOLES_PER_ROW);
    return { x: holeX((score - 1) % HOLES_PER_ROW), y: laneY(row, lane) };
  };

  let out = `<rect class="board-wood" x="0" y="0" width="${WIDTH}" height="${height}"/>`;

  // Lines marking where the skunk and double skunk begin.
  for (const [line, cls] of [[rules.skunkLine, 'board-skunk'], [rules.doubleSkunkLine, 'board-skunk faint']] as const) {
    if ((line - 1) % HOLES_PER_ROW !== 0) continue;
    const y = laneY((line - 1) / HOLES_PER_ROW, 0) - 3;
    for (let x = FIRST_HOLE_X; x < holeX(HOLES_PER_ROW - 1) + 2; x += 4) {
      out += `<rect class="${cls}" x="${x}" y="${y}" width="2" height="1"/>`;
    }
  }

  for (let lane = 0; lane < 2; lane++) {
    out += `<rect class="board-hole" x="${START_X}" y="${laneY(0, lane)}" width="2" height="2"/>`;
    out += `<rect class="board-hole" x="${FINISH_X}" y="${laneY(rows - 1, lane)}" width="2" height="2"/>`;
    for (let row = 0; row < rows; row++) {
      for (let i = 0; i < HOLES_PER_ROW; i++) {
        out += `<rect class="board-hole" x="${holeX(i)}" y="${laneY(row, lane)}" width="2" height="2"/>`;
      }
    }
  }

  // The number of the last hole in each row.
  for (let row = 0; row < rows; row++) {
    const label = row === rows - 1 ? rules.targetScore : (row + 1) * HOLES_PER_ROW;
    out += `<text class="board-label" x="${WIDTH - 2}" y="${laneY(row, 0) + 8}" text-anchor="end">${label}</text>`;
  }

  const pegs: [number, number, number, string][] = [
    [scores.cpu, scores.cpuBack, 0, 'peg-cpu'],
    [scores.you, scores.youBack, 1, 'peg-you'],
  ];
  for (const [front, back, lane, cls] of pegs) {
    if (back !== front) {
      const b = spot(back, lane);
      out += `<rect class="${cls}" x="${b.x - 1}" y="${b.y - 1}" width="4" height="4"/>`;
      out += `<rect class="board-hole" x="${b.x}" y="${b.y}" width="2" height="2"/>`;
    }
    const f = spot(front, lane);
    out += `<rect class="${cls} front" x="${f.x - 1}" y="${f.y - 1}" width="4" height="4"/>`;
    out += `<rect class="peg-shine" x="${f.x - 1}" y="${f.y - 1}" width="1" height="1"/>`;
  }

  return svg(
    `<svg class="board" viewBox="0 0 ${WIDTH} ${height}" shape-rendering="crispEdges" role="img" aria-label="Pegboard: you ${scores.you}, CPU ${scores.cpu}">${out}</svg>`,
  );
}
