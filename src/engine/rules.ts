// The numbers that define standard cribbage, gathered in one place.
// Characters (phase 2) will change the game by supplying a different Ruleset.

export interface Ruleset {
  /** Points needed to win. */
  targetScore: number;
  /** A loser below this is skunked. */
  skunkLine: number;
  /** A loser below this is double skunked. */
  doubleSkunkLine: number;
  /** Cards dealt to each player. */
  dealSize: number;
  /** Cards each player keeps after discarding to the crib. */
  handSize: number;
  /** The pegging count can never go above this. */
  maxCount: number;
  points: {
    fifteen: number;
    pair: number;
    thirtyOne: number;
    go: number;
    heels: number;
    nobs: number;
  };
}

export const STANDARD_RULES: Ruleset = {
  targetScore: 121,
  skunkLine: 91,
  doubleSkunkLine: 61,
  dealSize: 6,
  handSize: 4,
  maxCount: 31,
  points: {
    fifteen: 2,
    pair: 2,
    thirtyOne: 2,
    go: 1,
    heels: 2,
    nobs: 1,
  },
};
