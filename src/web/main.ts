// Starts the app and switches between screens.

import '@fontsource/press-start-2p/latin-400.css';
import './styles.css';

import { GameRecord } from '../stats/records';
import { GameScreen } from './game';
import { recordsScreen, rulesScreen, settingsScreen, titleScreen } from './screens';
import { Sound } from './sound';
import { Settings, addRecord, clearRecords, loadGame, loadRecords, loadSettings, saveGame, saveSettings } from './storage';

const app = document.getElementById('app')!;
const sound = new Sound();
let settings = loadSettings();
let game: GameScreen | null = null;

/**
 * The game is drawn on a virtual screen 180 units wide and at least 300 tall,
 * like a handheld's low-resolution display, then scaled up to fill the window.
 * The scale is rounded to whole device pixels so the pixel art stays crisp.
 */
function fitToWindow(): void {
  const raw = Math.min(window.innerWidth / 180, window.innerHeight / 300);
  const density = window.devicePixelRatio || 1;
  const unit = Math.max(1, Math.floor(raw * density)) / density;
  document.documentElement.style.setProperty('--u', `${unit}px`);
}

function applySettings(next: Settings): void {
  settings = next;
  saveSettings(settings);
  sound.enabled = settings.sound;
  document.documentElement.dataset.theme = settings.theme;
}

function show(screen: HTMLElement): void {
  app.replaceChildren(screen);
  screen.querySelector<HTMLElement>('.btn.primary, .btn, .row')?.focus({ preventScroll: true });
}

function leaveGame(): void {
  game?.destroy();
  game = null;
}

function showTitle(): void {
  leaveGame();
  show(
    titleScreen(settings, {
      onContinue: loadGame() ? () => startGame(true) : null,
      onNewGame: () => startGame(false),
      onRules: () => show(rulesScreen(showTitle)),
      onRecords: showRecords,
      onSettings: showSettings,
    }),
  );
}

function startGame(resume: boolean): void {
  leaveGame();
  const saved = resume ? loadGame() : null;
  if (!resume) saveGame(null);
  game = new GameScreen(
    {
      settings,
      sound,
      onExit: showTitle,
      onNewGame: () => startGame(false),
      onFinished: (record: GameRecord) => addRecord(record),
    },
    saved,
  );
  app.replaceChildren(game.el);
}

function showSettings(): void {
  show(
    settingsScreen(
      settings,
      (next) => {
        applySettings(next);
        sound.play('select');
        showSettings();
      },
      showTitle,
    ),
  );
}

function showRecords(): void {
  show(
    recordsScreen(
      loadRecords(),
      exportRecords,
      () => {
        clearRecords();
        showRecords();
      },
      showTitle,
    ),
  );
}

/** Downloads every saved game as a JSON file. */
function exportRecords(): void {
  const data = { exportedAt: new Date().toISOString(), games: loadRecords() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'deions-crib-records.json';
  link.click();
  URL.revokeObjectURL(url);
}

window.addEventListener('resize', fitToWindow);
window.addEventListener('keydown', (event) => game?.onKey(event));

fitToWindow();
applySettings(settings);
showTitle();
