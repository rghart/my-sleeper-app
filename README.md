# Sleeper Team Assistant

A draft-day and weekly-lineup companion for [Sleeper](https://sleeper.com) fantasy football leagues. It reads your leagues, rosters and live draft from the [Sleeper API](https://docs.sleeper.com/), ranks the players still on the board against a list you supply, and tells you what your leaguemates tend to do.

Live at **[sleeper-player-db.web.app](https://sleeper-player-db.web.app/)**.

Connect a Sleeper account by username — Sleeper has no OAuth, so this is a public username lookup and nothing is proven about ownership. Signing in with Google is separate and optional; it exists only so saved rank lists follow you between devices.

## What it does

**Ranks.** Paste a ranking list, or upload a CSV or spreadsheet export. A delimited list is read as a table — the columns are detected, you confirm the mapping against a preview, and the fields are read rather than guessed at. A flat one-per-line list is parsed instead, working out the name, team and position from the text. Names are matched to Sleeper's player pool fuzzily, so a list written `T.Brady` or `Ja'Marr Chase CIN WR` still lands. Tiers written into the list — `Tier 2 - Elite`, or just a blank line between groups — become tiers on screen. Any line that matches nothing is reported with a search box beside it, so it can be fixed in place. Lists can be saved, reopened, and compared against dynasty ADP (startup, rookie, and superflex variants).

**Draft.** Sync against a live draft and watch it fill in as picks land, as a board or as a feed. Best available is drawn from whichever rank list you have open, filtered by position and by who already owns the player. It can be pointed at any draft id, so a mock drafts against the same rosters and settings as the real thing. Picks can be entered by hand when sync isn't available.

**Lineup.** Build a weekly lineup against the league's own starter slots, filling each from the same rank list and roster data.

**Leaguemates.** Who the managers in your league are and what they do in their _other_ leagues — how often they draft a given player, how much of him they hold, whether they reach ahead of ADP or wait, and their recent trades, waivers and free-agent adds. On the draft board this becomes the odds a player survives to your next pick.

League history and a trade finder are advertised in the drawer but not built.

## How it fits together

- **Frontend** (this repo) — React 19, Vite, Tailwind, deployed to Firebase Hosting.
- **Player and analytics API** — [rghart/sleeper-player-be](https://github.com/rghart/sleeper-player-be), an Elixir/Phoenix service at `fantasyteamassistant.com`. It serves the player database, draft-availability odds, league intel and manager activity. The migration off Firebase for player data is done; a dev-server proxy handles it locally because the API only sends CORS headers for the deployed origin.
- **Firebase** — Hosting, anonymous→Google auth, and a Realtime Database holding saved rank lists, ADP, and the connected Sleeper account.

## Running it

Node is pinned in `.tool-versions` (24.18.0).

```bash
npm ci && npm run dev
```

## Checks

The same six run locally and in CI, and CI deploys to Firebase Hosting on merge to `master`, with a preview channel per pull request.

```bash
npm ci && npm run lint && npm run format:check && npm run typecheck && npm run test:run && npm run build
```

TypeScript is used for checking only — the source is JSX, with `tsc --noEmit` over it. Tests are Vitest and Testing Library: 814 across 51 files at the time of writing.

## History

Started in July 2020 as a Create React App project for one league and one hardcoded account. Since then it has moved to Vite, been rebuilt visually, had its player data moved to a real backend, and become multi-user. The parts that were once a single large component — the panels, the rank parsing, the player matching — are separate modules with their own tests.
