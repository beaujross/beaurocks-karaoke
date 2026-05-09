# Self-Service Karaoke V1 Execution Brief

Last updated: 2026-05-08
Status: Draft
Owner: Product / Engineering

Companion docs:

- `SELF_SERVICE_KARAOKE_CONSOLE_SPEC.md`
- `MODE_PROFILES.md`
- `docs/ARCHITECTURE_OVERVIEW.md`

## V1 Goal

Ship one primary self-service format and one monetized variant without creating a second, unrelated karaoke product.

V1 host-facing formats:

- `BeauRocks Open Stage`
- `BeauRocks Spotlight Auction`

Defer as phase two:

- `BeauRocks Showcase`
- `Crowd Control Party` as a distinct launcher tile
- deeper bracket integration

## V1 Product Contract

### `BeauRocks Open Stage`

- singers can join from the audience flow
- queue remains fair
- the crowd can pick from a singer's ready songs
- if only one ready singer exists, auto-lock
- if no one votes, auto-resolve
- host can preview on TV and return to normal karaoke

### `BeauRocks Spotlight Auction`

- verified donors claim an opening or featured block
- auction scope is explicit
- after the auction block, queue returns to fair behavior
- payment verification and assignment status are visible
- host can disable paid priority and return to normal karaoke

## V1 Non-Goals

- full crowd governance of every queue moment
- a generic public rules editor
- ranked judging logic
- all-night donation sorting
- five launchable self-service formats at once

## Implementation Strategy

Build on existing primitives instead of forking the product:

- TV shell from `src/apps/TV/PublicTV.jsx`
- audience join and queue flow from `src/apps/Mobile/SingerApp.jsx`
- prompt-vote mechanics from `src/games/PromptVote/Game.jsx`
- existing queue and release-window concepts from `src/apps/Host/components/HostQueueTab.jsx` and `src/lib/runOfShowDirector.js`
- payment verification rails from `functions/index.js`

## Workstreams

## 1. Mode Controller

Add a room-level self-service controller with:

- active format
- live phase
- host-facing rules summary
- recovery flags
- preview vs live status

Suggested initial room shape:

- `selfServeMode.enabled`
- `selfServeMode.format`
- `selfServeMode.phase`
- `selfServeMode.preview`
- `selfServeMode.canReturnToNormal`
- `selfServeMode.paidPriorityEnabled`

## 2. TV Shell

Add dedicated TV scenes:

- format attract screen
- live queue state
- vote window
- winner reveal
- payment or sponsor status for auction mode

Acceptance target:

- the TV should explain the current format without the host narrating it

## 3. Host Launch Surface

Host launch should be a short event wizard:

1. choose format
2. read rules summary
3. preview on TV
4. go live

Recovery controls required in v1:

- `Return To Normal Karaoke`
- `Pause New Entries`
- `Disable Paid Priority`

## 4. Open Stage Queue Logic

Implement:

- fair queue ordering
- per-singer ready song selection
- optional bounded crowd song vote
- low-participation fallbacks

Avoid in v1:

- exposing raw queue policy controls

## 5. Spotlight Auction Logic

Implement:

- verified bid or donation record
- explicit auction window
- assignment of winning slots
- visible assignment state
- auto-return to fair queue after the window closes

Avoid in v1:

- continuous all-night bid sorting
- overlapping auction and sponsor block mechanics

## 6. Support And Explainability

Every important state change should expose a plain-English explanation:

- why this singer is next
- why this song was chosen
- whether the queue is in fair mode or paid-priority mode
- whether payment is pending, verified, or assigned

This should be visible in at least:

- host surface
- TV where relevant
- mobile payment or bid confirmation states

## Backend Direction

V1 should prefer one shared decision pattern rather than many bespoke write paths.

Suggested first-pass collections:

- `self_serve_decisions/*`
- `self_serve_decision_public/*`
- `self_serve_payments/*`

Only add more specialized collections if load or integrity requirements demand it.

## Recommended Build Order

1. host launch shell + room controller
2. TV attract and live shell
3. Open Stage queue behavior
4. Open Stage crowd song vote
5. recovery and return-to-normal path
6. Spotlight Auction payment verification + assignment
7. auction TV and host explainability

## Exit Criteria For V1

- a host can launch `BeauRocks Open Stage` without training
- the room can understand how next-up works from the TV alone
- low-participation rooms do not stall
- the host can exit safely back to standard karaoke
- auction payments do not create ambiguous slot outcomes
- support can explain any paid-priority outcome from visible UI state
