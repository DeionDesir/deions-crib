// Everything the game remembers between visits, kept in the browser's
// localStorage on this device: settings, the game in progress, and records.

import { Difficulty } from '../ai/cpu';
import { GameState } from '../engine/game';
import { GameMeta, GameRecord } from '../stats/records';

export type Speed = 'slow' | 'normal' | 'fast';
export type Theme = 'color' | 'green' | 'gray';

export interface Settings {
  difficulty: Difficulty;
  speed: Speed;
  sound: boolean;
  /** Ask the player to count their own hands before showing the answer. */
  countYourself: boolean;
  theme: Theme;
}

export const DEFAULT_SETTINGS: Settings = {
  difficulty: 'normal',
  speed: 'normal',
  sound: true,
  countYourself: false,
  theme: 'color',
};

export interface SavedGame {
  state: GameState;
  meta: GameMeta;
}

const KEYS = {
  settings: 'deions-crib:settings',
  game: 'deions-crib:game',
  records: 'deions-crib:records',
};

/** Oldest games are dropped beyond this, to stay well inside storage limits. */
const MAX_GAMES = 300;

// Storage can be unavailable (private browsing) or full; the game still works.
function read<T>(key: string): T | null {
  try {
    const text = localStorage.getItem(key);
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Nothing useful to do: the game carries on without saving.
  }
}

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...(read<Partial<Settings>>(KEYS.settings) ?? {}) };
}
export const saveSettings = (settings: Settings) => write(KEYS.settings, settings);

export function loadGame(): SavedGame | null {
  const saved = read<SavedGame>(KEYS.game);
  // Ignore anything that doesn't look like a game in progress.
  if (!saved?.state?.events || !saved.meta || saved.state.phase === 'gameover') return null;
  return saved;
}
export const saveGame = (game: SavedGame | null) => write(KEYS.game, game);

/** Finished games, oldest first. */
export function loadRecords(): GameRecord[] {
  const games = read<GameRecord[]>(KEYS.records);
  return Array.isArray(games) ? games : [];
}

export function addRecord(record: GameRecord): void {
  write(KEYS.records, [...loadRecords(), record].slice(-MAX_GAMES));
}

export const clearRecords = () => write(KEYS.records, null);
