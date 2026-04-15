# Host Game QA Matrix

Last updated: 2026-04-14

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
| `doodle_oke` | Quick Launch card | Doodle-oke draw/vote surface | Doodle-oke gallery surface | Matrix now seeds deterministic singer fixtures so the host config can select real participants and launch. |
| `selfie_challenge` | Quick Launch card | Selfie capture or selfie voting surface | Selfie challenge gallery/voting surface | Matrix now uses deterministic room-user fixtures plus a seeded selfie submission to reach voting reliably in headless production QA. |
| `karaoke_bracket` | Quick Launch card | Bracket board or bracket live matchup | Bracket board or bracket live matchup | Matrix now seeds ready singers with Tight 15 fixture data and clears bracket explicitly on exit. |

## Production Snapshot

Baseline full production sweep:

- Date: 2026-03-10
- Command: `npm run qa:games:matrix:secure`
- Per-mode rooms: `UM22`, `W543`, `9MFU`, `M75F`, `JY6Z`, `H6XJ`, `1S1A`, `J156`, `UM66`, `PFNR`

Targeted production remediation rerun for the three setup-heavy modes:

- Date: 2026-03-10
- Command: `npm run qa:games:matrix`
- Mode filter: `doodle_oke,selfie_challenge,karaoke_bracket`
- Per-mode rooms: `4UHQ`, `RQTU`, `2WYC`

Current production status:

- Passing: `flappy_bird`, `vocal_challenge`, `riding_scales`, `team_pong`, `trivia_pop`, `wyr`, `bingo`, `doodle_oke`, `selfie_challenge`, `karaoke_bracket`

Interpretation:

- All currently launcher-exposed host game modes now have a passing production QA path.
- Config-driven modes (`doodle_oke`, `selfie_challenge`, `karaoke_bracket`) rely on deterministic QA fixture seeding in the matrix so automation is not blocked by unrelated join/camera drift.
- `karaoke_bracket` is no longer a silent hard-fail path; production QA now proves the signup-to-live bracket transition with ready-singer fixtures.

## 2026-04-14 Learnings

This rerun started with misleading red results and ended with a fully green live matrix. The important lessons were:

### 1. "Audience ready" and "fixture-seedable identity" are different checks

Most modes only need a usable audience shell.

Only setup-heavy identity-dependent flows should require the stricter contract:

- auth-backed UID present
- room-user fixture can be seeded deterministically

In practice:

- generic modes should not fail just because the audience shell did not expose an auth UID immediately
- `karaoke_bracket` still needs the stronger identity path because it depends on Tight 15-ready contestants

### 2. The runner must recognize live takeover states as healthy

The audience surface can validly open directly into:

- bracket live
- prompt-vote live
- doodle live
- selfie live

Those are not failed joins. They are already-active states.

The runner now treats those takeover shells as a valid joined audience condition.

### 3. Shared room-code parsing needed explicit browser-label guardrails

The host room browser introduced labels that looked like room codes in loose text parsing.

Known false positives that now must stay blocked:

- `BROWSER`
- `DASHBOARD`

This is covered by the shared room-code unit test, not just the Playwright scripts.

### 4. Doodle QA is more reliable when it avoids participant micromanagement

For production matrix coverage:

- longer draw/vote timers are safer than ultra-short rounds
- allowing all joined singers to participate is less brittle than selecting a narrow participant subset

This keeps the matrix focused on "can the mode run end to end?" instead of failing on setup timing noise.

### 5. Audience-shell fixes require deployment before matrix conclusions matter

One attempted matrix validation failed because the local code was fixed but hosting had not yet been updated.

Operational rule:

- if the change touches `SingerApp.jsx`, deploy before using production matrix results to judge the fix

## Latest Verified Production Sweep

- Date: 2026-04-14
- Command: `npm run qa:games:matrix`
- Status: full pass across all launcher-exposed modes

Verified passing modes:

- `flappy_bird`
- `vocal_challenge`
- `riding_scales`
- `team_pong`
- `trivia_pop`
- `wyr`
- `bingo`
- `doodle_oke`
- `selfie_challenge`
- `karaoke_bracket`

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
- Config-driven modes use seeded QA fixtures in the matrix:
  - room-user fixtures for setup-heavy participant pickers
  - Tight 15 fixtures for `karaoke_bracket`
  - a seeded selfie submission for headless `selfie_challenge` voting
- If a future regression lands users directly into a live takeover view, update readiness detection before assuming auth/bootstrap is broken.
