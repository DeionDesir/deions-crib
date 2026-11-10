# Deion's Crib

A cribbage game with Game Boy-era visuals, playable in the browser on phone and desktop.

You play one-on-one against the computer at three levels, with a pegboard, records of your games, three color themes and sound. There is also a text version for the terminal.

## How to play cribbage

Cribbage is a two-player card game. You score points for card combinations, and the first player to reach **121 points** wins.

- [The cards](#the-cards)
- [How a hand goes](#how-a-hand-goes)
- [Pegging rules](#pegging-rules)
- [Scoring the hands and the crib](#scoring-the-hands-and-the-crib)
- [Winning](#winning)
- [Scoring cheat sheet](#scoring-cheat-sheet)

### The cards

The game uses a standard 52-card deck.

| Card | Counting value | Order in a run |
| --- | --- | --- |
| Ace | 1 | Lowest (A-2-3 is a run; Q-K-A is not) |
| 2 to 10 | Face value | By number |
| Jack, Queen, King | 10 each | 10-J-Q-K, in that order |

The counting value is used for adding up to 15 and 31. The order is used for runs. A ten and a king both count 10, but they are not a pair.

### How a hand goes

1. **Cut for first deal.** Each player cuts a card and the lower card deals first. After that the deal alternates every hand.
2. **Deal.** Each player gets six cards.
3. **Discard to the crib.** Each player picks two cards to put face down in the crib. The crib is a third hand that belongs to the dealer and is scored at the end.
4. **Cut the starter.** One card is turned face up from the deck. It is not played during pegging, but it counts as a fifth card in both hands and in the crib when they are scored. If the starter is a jack, the dealer scores 2 points at once ("his heels").
5. **Pegging.** Players take turns laying cards and score as they go. See the pegging rules below.
6. **The show.** The hands are counted in a fixed order: the non-dealer's hand, then the dealer's hand, then the dealer's crib.

The dealer has the advantage of the crib. The non-dealer has the advantage of counting first.

### Pegging rules

Starting with the non-dealer, players take turns laying one card face up and announcing the running total of all cards played so far. Each player keeps their own cards in front of them, because the hands are scored again afterwards.

**The count can never go over 31.**

- If you cannot play a card without going over 31, you say "go".
- Your opponent must then keep playing cards for as long as they can without going over 31.
- When neither player can play, the player who laid the last card scores **1 point for the go**.
- The count goes back to 0 and the other player (the one who did not lay the last card) leads again.
- Hitting **exactly 31 scores 2 points** instead of 1.
- The player who lays the very **last card of the hand scores 1 point** (2 if it makes 31).

You score during pegging whenever the card you lay makes one of these:

| What you make | Points | Example |
| --- | --- | --- |
| Count of exactly 15 | 2 | Opponent plays 7, you play 8 |
| Count of exactly 31 | 2 | Count is 21, you play a king |
| Pair (same rank as the card before) | 2 | Opponent plays 4, you play 4 |
| Three of a kind in a row | 6 | 4, 4, then a third 4 |
| Four of a kind in a row | 12 | 4, 4, 4, then the fourth 4 |
| Run of three or more | 1 per card | 4, 6, then 5 scores 3 |
| Go | 1 | Nobody can play without passing 31 |
| Last card | 1 | You lay the final card of the hand |

Details that catch people out:

- **Runs do not have to be played in order.** If the cards go 4, 6, 5, the 5 completes a run of three. If a 3 or a 7 follows, that player scores a run of four.
- **Runs and pairs must be unbroken.** Only the most recent cards count. In 4, 9, 4 there is no pair, and in 3, 4, 4, 5 there is no run, because the second 4 gets in the way.
- **One card can score twice.** Playing a third 5 on 5, 5 makes three of a kind (6) and a count of fifteen (2), for 8.
- **Combinations do not carry over a reset.** Once the count goes back to 0, pairs and runs start fresh.
- **Suits do not matter in pegging.** There are no flushes.

### Scoring the hands and the crib

After pegging, each hand is counted as five cards: the four cards the player kept plus the starter. Every different combination of cards scores, and the same card can be used in several combinations.

| Combination | Points | Notes |
| --- | --- | --- |
| Fifteen | 2 each | Any set of cards whose values add up to 15 |
| Pair | 2 each | Three of a kind is three pairs (6); four of a kind is six pairs (12) |
| Run | 1 per card | Three or more cards in order, any suits |
| Flush | 4 or 5 | All four hand cards in one suit is 4; 5 if the starter matches too |
| Nobs | 1 | Holding the jack of the same suit as the starter |

**Fifteens.** Count every combination, of any number of cards. A hand of 5, 5, J with a K starter has four fifteens: each 5 with the jack, and each 5 with the king.

**Runs.** Only the longest run counts, but it counts once for every different set of cards that makes it.

- 3, 4, 5, 6 is one run of four (4 points), not two runs of three.
- 3, 3, 4, 5 is a "double run": two runs of three (6 points) plus the pair (2) for 8, before any fifteens.
- 3, 3, 4, 4, 5 is four runs of three (12 points) plus two pairs (4).

**Flushes.** The four cards in your hand must all be the same suit. Three hand cards plus the starter is not a flush.

**The crib** is scored the same way, with one exception: a crib flush only counts if all five cards, including the starter, are the same suit. A four-card flush in the crib scores nothing.

**Worked example.** You hold 7, 8, 8, 9 and the starter is a 6.

| Combination | Points |
| --- | --- |
| Fifteens: 7 + 8 (twice, once with each 8), 6 + 9 | 6 |
| Pair of 8s | 2 |
| Runs: 6-7-8-9 twice, once with each 8 | 8 |
| **Total** | **16** |

The highest possible hand is **29**: three 5s and a jack in hand, with the fourth 5 as the starter in the jack's suit. That is eight fifteens (16), six pairs (12) and nobs (1).

### Winning

- The first player to reach **121** wins, and the game stops at that moment, even in the middle of pegging or the show.
- Because the non-dealer counts first, a non-dealer who reaches 121 in the show wins before the dealer gets to count, even if the dealer needed only one point.
- If the loser has fewer than 91 points, it is a **skunk**. Fewer than 61 is a **double skunk**.

### Scoring cheat sheet

| Score | Pegging | Hands and crib |
| --- | --- | --- |
| Fifteen | 2 | 2 each |
| Thirty-one | 2 | - |
| Pair | 2 | 2 each |
| Three of a kind | 6 | 6 |
| Four of a kind | 12 | 12 |
| Run | 1 per card | 1 per card |
| Flush | - | 4 or 5 (crib: 5 only) |
| Nobs (jack matching starter's suit) | - | 1 |
| His heels (starter is a jack) | 2 to the dealer, when cut | - |
| Go | 1 | - |
| Last card | 1 | - |

## For developers

The game is written in TypeScript and built with [Vite](https://vite.dev). It needs [Node.js](https://nodejs.org) 20 or newer.

### Setup

```
npm install
```

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the game at http://localhost:5173 and reloads as you edit |
| `npm run build` | Checks the types and builds the finished site into `dist/` |
| `npm run preview` | Serves the built site, to try it exactly as it will be published |
| `npm test` | Runs the rules, CPU and records tests |
| `npm run play` | Text version in the terminal: you against the CPU |
| `npm run play -- --level hard` | Text version at another CPU level (`easy`, `normal`, `hard`) |
| `npm run play -- --seed 42` | Text version with the same shuffles every time |
| `npm run play -- --auto` | The CPU plays both sides and prints the whole game |

To try the dev version on your phone, run `npm run dev -- --host` and open the "Network" address it prints, with the phone on the same Wi-Fi.

### Publishing

Every push to `main` runs the tests, builds the site and publishes it to GitHub Pages (see `.github/workflows/deploy.yml`).

One-time setup: on GitHub, open the repo's **Settings > Pages** and set **Source** to **GitHub Actions**. The game then lives at `https://<your-username>.github.io/deions-crib/`.

Once it is open on a phone, "Add to Home Screen" installs it like an app, and it keeps working offline.

### Layout

| Path | Contents |
| --- | --- |
| `src/engine/cards.ts` | Cards, deck, seedable shuffle |
| `src/engine/rules.ts` | The numbers that define standard cribbage (characters will swap these later) |
| `src/engine/scoring.ts` | Hand, crib and pegging scoring |
| `src/engine/game.ts` | Game flow: deal, discard, starter, pegging, show, win |
| `src/ai/cpu.ts` | The computer player: easy, normal and hard |
| `src/stats/records.ts` | Turns finished games into records and stats |
| `src/web/main.ts` | Starts the web app and switches screens |
| `src/web/game.ts` | The game screen |
| `src/web/screens.ts` | Title, settings, records and how-to-play screens |
| `src/web/skin.ts` | How cards look (pixel grids for suits and face cards) |
| `src/web/pegboard.ts` | Draws the pegboard |
| `src/web/styles.css` | Layout and the color themes |
| `src/web/sound.ts` | Sound effects |
| `src/web/storage.ts` | Saved settings, game in progress and records |
| `src/cli/` | Text version of the game for the terminal |
| `tests/` | Tests |
| `public/` | App icons |

### Records and exported data

Finished games are saved in the browser on the device they were played on. **Records > Export as JSON** downloads all of them. Each game lists every hand: who dealt, the starter, and for each player the cards kept, the discards, and the points from pegging, hand and crib.
