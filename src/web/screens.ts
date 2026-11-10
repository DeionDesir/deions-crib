// The screens around the game: title, settings, records and how to play.

import { DIFFICULTIES } from '../ai/cpu';
import { parseCard } from '../engine/cards';
import { GameRecord, computeStats } from '../stats/records';
import { h } from './dom';
import { cardChip, cardEl } from './skin';
import { Settings, Speed, Theme } from './storage';

const title = (text: string) => text[0].toUpperCase() + text.slice(1);

function backButton(onBack: () => void): HTMLElement {
  return h('button', { class: 'btn', type: 'button', onclick: onBack }, 'Back');
}

export interface TitleActions {
  onContinue: (() => void) | null;
  onNewGame: () => void;
  onRules: () => void;
  onRecords: () => void;
  onSettings: () => void;
}

export function titleScreen(settings: Settings, actions: TitleActions): HTMLElement {
  // The best hand in cribbage: three fives and the right jack, with the fourth five cut.
  const fan = ['5C', '5D', 'JH', '5S', '5H'].map((code) => cardEl(parseCard(code)));
  return h(
    'div',
    { class: 'screen title' },
    h('h1', { class: 'logo' }, h('span', {}, "Deion's"), h('span', {}, 'Crib')),
    h('div', { class: 'fan', 'aria-hidden': 'true' }, ...fan),
    h(
      'nav',
      { class: 'menu' },
      actions.onContinue && h('button', { class: 'btn primary', type: 'button', onclick: actions.onContinue }, 'Continue game'),
      h('button', { class: `btn ${actions.onContinue ? '' : 'primary'}`, type: 'button', onclick: actions.onNewGame }, 'New game'),
      h('button', { class: 'btn', type: 'button', onclick: actions.onRules }, 'How to play'),
      h('button', { class: 'btn', type: 'button', onclick: actions.onRecords }, 'Records'),
      h('button', { class: 'btn', type: 'button', onclick: actions.onSettings }, 'Settings'),
    ),
    h('p', { class: 'small' }, `CPU level: ${title(settings.difficulty)}`),
  );
}

const SPEEDS: Speed[] = ['slow', 'normal', 'fast'];
const THEMES: Theme[] = ['color', 'green', 'gray'];
const THEME_NAMES: Record<Theme, string> = { color: 'Color', green: 'Pocket green', gray: 'Pocket gray' };

export function settingsScreen(settings: Settings, onChange: (next: Settings) => void, onBack: () => void): HTMLElement {
  const next = <T,>(options: readonly T[], current: T) => options[(options.indexOf(current) + 1) % options.length];
  const row = (label: string, value: string, change: () => Settings) =>
    h('button', { class: 'row', type: 'button', onclick: () => onChange(change()) }, h('span', {}, label), h('b', {}, value));

  return h(
    'div',
    { class: 'screen page' },
    h('h2', {}, 'Settings'),
    h(
      'div',
      { class: 'rows' },
      row('CPU level', title(settings.difficulty), () => ({ ...settings, difficulty: next(DIFFICULTIES, settings.difficulty) })),
      row('Game speed', title(settings.speed), () => ({ ...settings, speed: next(SPEEDS, settings.speed) })),
      row('Sound', settings.sound ? 'On' : 'Off', () => ({ ...settings, sound: !settings.sound })),
      row('Count my own hands', settings.countYourself ? 'On' : 'Off', () => ({ ...settings, countYourself: !settings.countYourself })),
      row('Colors', THEME_NAMES[settings.theme], () => ({ ...settings, theme: next(THEMES, settings.theme) })),
    ),
    h('p', { class: 'small' }, 'Tap a setting to change it. A new CPU level applies from the next game.'),
    backButton(onBack),
  );
}

export function recordsScreen(games: GameRecord[], onExport: () => void, onClear: () => void, onBack: () => void): HTMLElement {
  const stats = computeStats(games);
  const num = (value: number | null, digits = 1) => (value === null ? '-' : value.toFixed(digits));
  const streak =
    stats.currentStreak === 0 ? '-' : `${Math.abs(stats.currentStreak)} ${stats.currentStreak > 0 ? 'won' : 'lost'}`;
  const stat = (label: string, value: string | number | HTMLElement) => h('div', { class: 'stat' }, h('dt', {}, label), h('dd', {}, value));

  const best = stats.bestHand
    ? h('span', {}, `${stats.bestHand.points}: `, ...[...stats.bestHand.cards, stats.bestHand.starter].map((c) => cardChip(parseCard(c))))
    : '-';

  let armed = false;
  const clear = h('button', { class: 'btn', type: 'button', disabled: games.length === 0 }, 'Clear records');
  clear.addEventListener('click', () => {
    if (armed) return onClear();
    armed = true;
    clear.textContent = 'Tap again to clear';
  });

  const recent = [...games].reverse().slice(0, 8);

  return h(
    'div',
    { class: 'screen page' },
    h('h2', {}, 'Records'),
    games.length === 0 && h('p', { class: 'small' }, 'No games finished yet. Play one and it will show up here.'),
    h(
      'dl',
      { class: 'stats' },
      stat('Games', stats.played),
      stat('Won, lost', `${stats.wins}, ${stats.losses}`),
      stat('Win rate', stats.winPercent === null ? '-' : `${num(stats.winPercent, 0)}%`),
      stat('Streak', streak),
      stat('Best streak', stats.bestWinStreak || '-'),
      stat('Biggest win', stats.biggestWin === null ? '-' : `by ${stats.biggestWin}`),
      stat('Skunks given', stats.skunksGiven),
      stat('Skunks taken', stats.skunksTaken),
      stat('Best hand', best),
      stat('Best crib', stats.bestCrib ?? '-'),
      stat('Average hand', num(stats.averageHand)),
      stat('Average crib', num(stats.averageCrib)),
      stat('Average pegging', num(stats.averagePegging)),
      stat('Hands played', stats.handsPlayed),
    ),
    recent.length > 0 && h('h3', {}, 'Recent games'),
    recent.length > 0 &&
      h(
        'ul',
        { class: 'recent' },
        ...recent.map((game) =>
          h(
            'li',
            {},
            h('span', {}, new Date(game.finishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
            h('span', {}, `${game.winner === 'you' ? 'Won' : 'Lost'} ${game.score.you}-${game.score.cpu}`),
          ),
        ),
      ),
    h(
      'div',
      { class: 'page-actions' },
      h('button', { class: 'btn', type: 'button', disabled: games.length === 0, onclick: onExport }, 'Export as JSON'),
      clear,
      backButton(onBack),
    ),
  );
}

export function rulesScreen(onBack: () => void): HTMLElement {
  const section = (heading: string, ...lines: string[]) =>
    h('section', {}, h('h3', {}, heading), ...lines.map((line) => h('p', {}, line)));
  const table = (rows: [string, string][]) =>
    h('table', {}, ...rows.map(([what, points]) => h('tr', {}, h('td', {}, what), h('td', {}, points))));

  return h(
    'div',
    { class: 'screen page rules' },
    h('h2', {}, 'How to play'),
    section('The goal', 'Score points for card combinations. First to 121 wins.'),
    section(
      'Each hand',
      'You get six cards and send two to the crib. The crib is an extra hand that scores for the dealer.',
      'A starter card is cut. It counts as a fifth card in both hands and the crib. If it is a jack, the dealer scores 2.',
      'Then you peg, then the hands are counted: non-dealer first, then the dealer, then the crib.',
    ),
    section(
      'Pegging',
      'Take turns laying a card and adding to the count. Aces are 1, face cards are 10. The count cannot pass 31.',
      'If you cannot play, your opponent keeps going. When nobody can play, the last card scores 1 and the count starts again.',
    ),
    table([
      ['Count of 15', '2'],
      ['Count of 31', '2'],
      ['Pair', '2'],
      ['Three of a kind', '6'],
      ['Four of a kind', '12'],
      ['Run of 3 or more, in any order', '1 a card'],
      ['Go, or last card', '1'],
    ]),
    section('Counting hands', 'Every different combination in your four cards plus the starter scores.'),
    table([
      ['Cards adding to 15', '2 each'],
      ['Pair', '2 each'],
      ['Run of 3 or more', '1 a card'],
      ['Four hand cards in one suit', '4'],
      ['All five in one suit', '5'],
      ['Jack matching the starter suit', '1'],
    ]),
    section(
      'Good to know',
      'Only the longest run counts, once for each set of cards that makes it. 3-3-4-5 is two runs of three.',
      'A flush in the crib needs all five cards.',
      'Lose with under 91 and you are skunked. Under 61 is a double skunk. The dashed lines on the board mark both.',
    ),
    section(
      'The board',
      'Your lane is the lower one in each row. The solid peg is your score; the hollow peg shows where you were before your last points.',
    ),
    section('Keyboard', 'Keys 1 to 6 pick a card, Enter confirms, Esc pauses.'),
    backButton(onBack),
  );
}
