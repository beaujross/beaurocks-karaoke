# Host Game QA Matrix

Last updated: 2026-03-10

## Purpose

This is the QA inventory for every game mode currently exposed from the host launcher.

The goal is not to assume every mode is production-ready. The goal is to make the exposed surface explicit, verify what launches, and catch regressions across host, audience, and TV.

Primary automation command:

```powershell
npm run qa:games:matrix:secure
```

This runner:

- logs in through the real production host access flow
- creates a fresh room per mode by default
- joins one audience phone and one TV surface
- attempts every launcher-exposed mode
- records whether the mode launches
- verifies audience and TV render the expected live state
- performs a basic audience interaction where the mode supports a simple smoke action
- dismisses the floating host audience preview before clicking launcher cards so right-column game controls stay reachable

## Coverage Model

Each mode should answer four questions:

1. Can the host launch it from the real launcher?
2. Does `room.activeMode` switch to the expected live mode?
3. Does audience render a corresponding live surface?
4. Does TV render a corresponding live surface?

## Matrix

| Mode | Host quick launch | Audience expectation | TV expectation | Notes |
| --- | --- | --- | --- | --- |
| `flappy_bird` | Quick Launch card | Flappy UI or solo/crowd instructions | Flappy UI with score and flap instructions | With one joined audience member, quick launch should choose solo mode; otherwise ambient crowd mode. |
| `vocal_challenge` | Quick Launch card | Vocal Challenge UI with score/round summary | Vocal Challenge UI with score/round summary | With one joined audience member, quick launch should choose turns mode; otherwise ambient crowd mode. |
| `riding_scales` | Quick Launch card | Riding Scales UI with round state | Riding Scales UI with round state | Quick launch starts crowd mode. |
| `team_pong` | Quick Launch card | Team Pong phone controls | Team Pong rally board | Smoke clicks the crowd hit control. |
| `trivia_pop` | Quick Launch card | Trivia question on phone | Trivia board on TV | Smoke locks one answer. |
| `wyr` | Quick Launch card | Would You Rather choice card | Split-vote board on TV | Smoke casts one vote. |
| `bingo` | Quick Launch card | Bingo board or Bingo Live reopen entry | Bingo board or Bingo Live panel | Smoke looks for a suggestable tile when present. |
| `doodle_oke` | Quick Launch card | Doodle-oke draw/vote surface | Doodle-oke gallery surface | Requires prompt inventory to be configured. |
| `selfie_challenge` | Quick Launch card | Selfie capture or selfie voting surface | Selfie challenge gallery/voting surface | Requires prompt plus participant selection. |
| `karaoke_bracket` | Quick Launch card | Bracket board or bracket-not-ready state | Bracket board or bracket-not-ready state | Requires seeded bracket data and usable contestants. |

## Production Snapshot

Latest full production run:

- Date: 2026-03-10
- Command: `npm run qa:games:matrix:secure`
- Per-mode rooms: `UM22`, `W543`, `9MFU`, `M75F`, `JY6Z`, `H6XJ`, `1S1A`, `J156`, `UM66`, `PFNR`

Passing in production:

- `flappy_bird`
- `vocal_challenge`
- `riding_scales`
- `team_pong`
- `trivia_pop`
- `wyr`
- `bingo`

Failing in production:

- `doodle_oke`
  - Quick launch currently opens the host config modal and still requires seeded prompts plus at least one resolved participant before the mode can start.
- `selfie_challenge`
  - Quick launch currently opens the host config modal and still requires a prompt plus at least one resolved participant before the mode can start.
- `karaoke_bracket`
  - Launcher hard-blocks with `Need at least 2 singers with Tight 15 songs for a bracket.`

Interpretation:

- `vocal_challenge` and `bingo` are verified working in production after fixing the launcher targeting and bingo payload issues.
- `doodle_oke` and `selfie_challenge` are setup-heavy modes whose host modals still need richer fixture seeding in automation.
- `karaoke_bracket` has a real fixture requirement and cannot be meaningfully verified in a one-singer room.

## Expected Failure Types

These failures are meaningful and should be treated as product findings, not just QA noise:

- quick launch button exists but mode never becomes live
- mode launches on host but audience or TV do not render a corresponding surface
- mode requires hidden setup the launcher does not communicate
- mode is exposed in the launcher but has no realistic path to a successful session
- mode cannot cleanly return to karaoke via host `End Mode`

## Current Source Of Truth

- Launcher surface: `src/components/UnifiedGameLauncher.jsx`
- Mode registry: `src/lib/gameRegistry.js`
- Registered game container: `src/components/GameContainer.jsx`
- Audience game interception: `src/apps/Mobile/SingerApp.jsx`
- TV game interception: `src/apps/TV/PublicTV.jsx`
- Automation matrix: `scripts/qa/lib/hostGameMatrix.mjs`
- Automation runner: `scripts/qa/host-game-matrix-playwright.mjs`

## Operator Notes

- Remote production runs require `QA_APP_CHECK_DEBUG_TOKEN`.
- Use the dedicated low-privilege QA host account, not a super admin.
- If a mode is intentionally incubating or incomplete, it should either be hidden from the launcher or clearly marked in future product copy.
- Config-driven modes need richer QA fixtures than one empty room plus one joined singer if they are going to stay in the default launcher matrix.
