# Game Mode Hardening Brief

## Purpose

Define how to harden audience game modes so they:

- fail gracefully for guests
- are easier to operate live
- are safer to launch and recover
- work correctly whether triggered manually by the host or through Run Of Show

Run Of Show matters here, but only as an integration requirement. The primary subject is game-mode reliability and guest experience.

## Core Principle

Fail gracefully must be a product requirement, not just a backend concern.

For every game mode, ask:

1. What happens if the guest loses connection after tapping?
2. What happens if auth, App Check, or room membership are not ready yet?
3. What happens if the mode state changes while the action is in flight?
4. Can the user retry safely without duplicates?
5. Does the UI keep momentum, or does it dead-end?

Required behaviors:

- optimistic or immediate feedback where safe
- retry-safe writes
- idempotency for submissions, votes, and important taps
- soft terminal states like `Voting closed`, `Round ended`, `Already submitted`
- no guest-facing backend jargon

## Target Architecture

### Audience actions

High-value audience actions should be server-owned:

- photo submissions
- drawing submissions
- votes
- queue submissions
- turn-sensitive or status-sensitive writes

The server should validate:

- room membership
- active prompt/session
- participation eligibility
- duplicate prevention
- approval/moderation requirements

### Public reads

Where TV or audience should see filtered or moderated state, use a read-safe projection instead of raw write collections.

### Retry model

High-value guest actions should support:

- `clientRequestId`
- safe retries
- optional lightweight outbox behavior for flaky mobile conditions

### Telemetry

Every hardened mode should emit:

- mode key
- room code
- source
- action type
- latency
- retry count
- failure class
- final outcome

## Run Of Show Constraint

Run Of Show is not the strategy, but hardened modes must build with it.

That means:

- a mode cannot require a special second implementation just for Run Of Show
- launch contracts should support both manual host launch and Run Of Show launch
- mode state should carry `source` and `runOfShowItemId` when applicable
- completion and cleanup should leave the room in a predictable state for the next scheduled item

Current reality:

- Run Of Show already stages and starts game moments
- TV and host surfaces already depend on room `activeMode` and related payloads
- some Run Of Show starts are still effectively split between callable state advancement and host-side room bootstrap

So the hardening rule is:

`build each mode as a reusable, server-owned lifecycle that Run Of Show can call into`

not:

`design around Run Of Show first`

## Modes By Priority

### P0: Needs the selfie-style hardening approach next

#### `doodle_oke`

Why:

- closest structural match to selfie challenge
- direct audience submission/vote patterns remain
- moderation and visible-state concerns mirror selfie challenge

Needed:

- server-owned submit
- server-owned vote
- moderation callable path
- public projection for visible entries and vote state
- local draft preservation before submit

#### `bingo`

Why:

- audience interactions still touch room state too directly
- turn/reveal flows are sensitive to race conditions
- failures can create confusing whole-room state

Implemented:

- server-owned observation confirmation for standard bingo, preserving the audience-observes-then-confirms flow
- server-owned mystery spin action
- server-owned mystery picker lock and reveal handling
- idempotent confirmation and spin writes
- explicit terminal states like `turn locked`, `round closed`, `already picked`, `already confirmed`, and `spectating`

Still related but separate:

- mystery bingo now locks the pick server-side and uses the server-owned audience queue submission path for the selected song

#### `karaoke_bracket` lifecycle and crowd voting

Why:

- vote state is fragmented
- weak audit and recovery story
- poor graceful-failure behavior for a high-attention crowd moment
- setup/seeding/queueing previously depended on broad host room writes
- original bracket flow assumed every contestant had a usable Tight 15

Implemented:

- server-owned vote action
- server-owned host match resolution, including authoritative crowd-vote recount
- server-owned bracket signup, creation/seeding, Go Live, crowd-vote toggle, match queueing, and clear
- server-owned match queueing that writes deterministic bracket queue docs for Tight 15 mode
- `songSelectionMode` supports `tight15_random` and `singer_pick_round`
- singer-pick mode lets brackets run without Tight 15 readiness; contestants submit their own song for the queued round
- server-owned `submitBracketRoundSong` links a contestant's singer-pick submission onto the active match and writes one deterministic queue doc
- duplicate/closed-match handling
- clear failures for `crowd voting paused`, `match closed`, `not eligible`, `no votes`, and `tie`

Still related but separate:

- Run of Show regression coverage should explicitly exercise bracket signup/create/queue/resolve paths

### P1: Strong candidate for the same direction

#### `trivia_pop` and `wyr`

Why:

- vote-based modes with timing sensitivity
- reveal/finalization should be more authoritative
- guest experience depends on clear live/reveal boundaries

Needed:

- server-owned vote writes
- server-owned reveal/finalization
- clear outcomes for `already voted`, `voting closed`, `question expired`

#### Karaoke song submission / queue joins

Why:

- high emotional cost when they fail
- duplicate taps and stale state are especially painful

Implemented for audience requests:

- server-owned submission
- idempotency
- friendlier retry and confirmation states
- server-side membership, queue-limit, request-policy, and priority-score decisions
- Run Of Show metadata passthrough when a request is made during a scheduled item

Still related but separate:

- host-side queue tooling still writes directly because it has broader operational permissions and needs a dedicated pass before changing

### P1.5: Needs hardening, but as controller/state-engine work

#### `flappy_bird`
#### `vocal_challenge`
#### `riding_scales`

Why:

- main risk is controller authority and live state recovery
- not the same problem as moderated submissions or projections

Needed:

- authoritative controller model
- disconnect recovery
- safer completion/finalization
- graceful fallback on mic/input failure

### P2: Lighter but still worthwhile

#### `team_pong`
#### reactions / applause
#### chat

Needed:

- better buffering
- cooldown-safe retries
- telemetry
- softer failure states

## Rollout Order

### Phase 1

Harden `doodle_oke` using the selfie-challenge pattern.

Goal:

- prove the pattern works beyond selfie flows
- establish reusable server submit/vote/projection infrastructure

### Phase 2

Harden `trivia_pop` and `wyr`.

Goal:

- stabilize timed vote flows
- make reveal/finalization deterministic

### Phase 3

Make host-side queue tools and bracket setup/queueing use narrower server-owned operations where practical.

Goal:

- reduce room-state race conditions
- improve whole-room consistency and recoverability
- complete the remaining high-value host-controlled queue and tournament lifecycle paths after bingo, audience queue submission, and bracket voting

### Phase 4

Harden voice/controller games.

Goal:

- make live controller sessions resilient
- improve reconnect and authority handling

### Phase 5

Standardize lighter shared infrastructure for:

- reactions
- applause
- chat
- other rapid-tap audience interactions

## Shared Engineering Guardrails

Before shipping any mode change, answer:

- What is the authoritative source of truth?
- Which actions are server-owned?
- What is the idempotency key?
- What does the guest see during retry?
- What terminal states exist?
- What telemetry exists?
- How does this launch manually?
- How does this launch through Run Of Show?
- How does it clean up afterward?

## Success Criteria

The hardening effort is working when:

- guests do not lose high-value submissions on transient failures
- duplicate taps do not create duplicate writes
- hosts can understand whether a mode is live, blocked, closed, or recoverable
- TV reads stable, intended public state
- hardened modes can be launched manually or from Run Of Show without separate logic forks

## Bottom Line

The main program is:

`game mode hardening with graceful failure`

Run Of Show is a compatibility requirement inside that program, not the whole program.
