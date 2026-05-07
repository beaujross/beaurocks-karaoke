# Host Hopper Streamlining Plan

Date: May 4, 2026

Audience: Chief Product Officer, Chief Technology Officer

## Executive Read

Friday's AAHF feedback points to one core failure mode:

- the host lost confidence in what mattered right now
- the queue and playable-track problem felt larger than it was because the next few commitments were not visually or operationally locked
- fallback behavior existed in pieces, but not as one dominant live mental model

The product should treat the live night as one `Hopper` with three always-visible positions:

1. `Now`
2. `Next`
3. `Then`

Those three positions should be the live operational truth.

Everything else should serve them:

- the queue feeds them
- the run of show plans them
- the crowd can help shape them
- co-hosts can help prepare them
- the host only intervenes when one of the three becomes risky or broken

This is not a new orchestration system. It is a stronger runtime emphasis on patterns that already exist in the host surface.

## CPO Read

The host should not be asked to mentally merge:

- active performer state
- queue order
- run-of-show future moments
- track readiness
- crowd steering

into a personal, invisible mental model.

The product should externalize that model.

The right UX shape is:

- one live hopper at the top of the queue page
- three committed positions always in view
- stronger visual lock when an item enters those positions
- post-performance recap and approval moments centered on protecting or updating those positions
- clear distinction between:
  - `committed`
  - `suggested`
  - `repair needed`

CPO recommendation:

- make the hopper the primary live object, not the queue list by itself
- unify karaoke performances and planned scenes into the same horizon
- let the crowd and co-hosts influence what enters `Next` and `Then`, but not thrash already committed positions
- keep host override, but present it as an exception path

## CTO Read

We should not respond by creating:

- a second scheduler
- a duplicate live control lane
- a new queue data model that fights the current run-of-show model

The current codebase already has the right primitives:

- queue page as the live cockpit
- `RunOfShowQueueHud` with a visible `Now / Next / Then` horizon
- `HostLiveOpsPanel` with `On Stage / Next Singer / Planned`
- queue surface counts and stage summary helpers
- run-of-show slot assignment and open-slot fill helpers
- narrow co-host signaling and helper flows

CTO recommendation:

- converge the existing queue HUD and live snapshot into one stronger hopper surface
- promote horizon locking and repair states in UI and state helpers
- keep queue as feeder and run of show as conveyor
- add safer fallback rules for when a song is unplayable or missing
- add targeted tests around horizon stability, fallback behavior, and co-host/crowd steering

## Current Implementation Assets

The current repo already supports major parts of this direction:

- `src/apps/Host/components/RunOfShowQueueHud.jsx`
  - already computes a three-item horizon
  - already shows `Next 3 set`
  - already supports issue counts and item actions
- `src/apps/Host/components/HostLiveOpsPanel.jsx`
  - already exposes `On Stage`, `Next Singer`, and `Planned`
- `src/apps/Host/components/StageNowPlayingPanel.jsx`
  - already anchors the active performance and the immediate next queue summary
- `src/apps/Host/queueSurfaceModel.js`
  - already computes queue counts and next-run summary language
- `src/apps/Host/lib/openSlotSuggestions.js`
  - already supports filling open performance slots from ready queue songs
- co-host signal model is intentionally narrow
  - `track_issue`
  - `vocal_issue`
  - `mix_issue`

The strategic gap is emphasis and ownership, not missing infrastructure.

## Target Product Model

### 1. One Hopper

The hopper is the one runtime object the host trusts.

It always shows:

- `Now`
- `Next`
- `Then`

Each position can hold either:

- a karaoke performance
- a planned scene or moment
- an explicit open slot

### 2. Commitment States

Each hopper position should carry one plain operational state:

- `Locked`
  - expected to happen unless the host overrides
- `Suggested`
  - best candidate, but not yet committed
- `Needs Repair`
  - can happen, but only after a fix
- `Open`
  - intentionally unfilled

Rule:

- once an item reaches `Now`, `Next`, or `Then`, the product should stop treating it like a casual list row
- it should become a committed operational object with stronger visuals, status, and fallback handling

### 3. Queue As Feeder

The queue remains the source pool for singer performances.

But during a live night the host should not scan the full queue first.
The host should scan the hopper first.

The queue's live job becomes:

- provide the best candidate for open hopper positions
- surface repair needs when a committed slot is not playable
- show overflow and later work without competing with the hopper

### 4. Run Of Show As Conveyor

Run of show remains the planning and conveyor system.

Its live role is:

- define planned scenes and performance slots
- pre-shape `Then` and later positions
- feed committed moments into the hopper
- own structured repair when a slot is missing performer, song, or backing

It should not feel like a separate live-control brain.

### 5. Crowd And Co-Host Steering

Hands-off operation means the host does not manually curate every transition.

That requires:

- crowd guidance only when a real decision exists
- co-host help to prepare future hopper positions
- strict protection of committed positions from noisy mid-show churn

Crowd and co-hosts should mostly influence:

- what fills open `Next` or `Then`
- which candidate wins when multiple good options exist
- track/playability warnings before the item reaches `Now`

They should rarely alter:

- `Now`
- already locked `Next`

## UX Plan

### A. Merge Live Snapshot And Queue HUD Into One Hopper Rail

Replace the current feeling of adjacent widgets with one dominant top-of-queue `Live Hopper`.

The rail should contain:

- `Now`
  - current performer or live moment
- `Next`
  - next committed performer or scene
- `Then`
  - third committed performer or scene
- one concise status line
- one primary action
- one repair action when needed

Keep deeper details collapsible.

### B. Make The Hopper Always Visible

The hopper should remain above the queue list and within the host's main operating eye-line.

It should not require:

- switching to `Planner`
- opening details
- scanning separate summary cards

Desktop:

- persistent top rail in the queue cockpit

Mobile/tight layouts:

- condensed stacked cards with the same three positions

### C. Lock The Next Three

When a slot enters `Next` or `Then`:

- visually mark it as committed
- show whether it is playable
- suppress casual reordering affordances around it
- require explicit override to replace it

This is the crucial host-confidence change.

The host should feel:

- `these are the next three things`
- `I only need to fix them if one is broken`

### D. Center Post-Performance Flow On Hopper Maintenance

Post-song moments should protect the hopper.

After a performance:

- applause/recap can run
- optional crowd decision can run if there is a real open choice
- the finished `Now` item falls off
- `Next` advances to `Now`
- `Then` advances to `Next`
- a new `Then` is pulled in from run of show, queue suggestions, or crowd-approved choice

The host recap prompt should emphasize:

- `Next is ready`
- `Then needs track repair`
- `No third item locked yet`

not generic queue cleanup.

### E. Reframe Queue Rows Relative To The Hopper

The live queue panel should split by meaning:

- `Ready For Hopper`
- `Needs Repair`
- `Later / Overflow`

Do not present the full queue as one equally important sortable stack during busy operation.

The host must be able to answer:

- what can feed `Then` right now?
- which committed item is at risk?
- what can wait?

### F. Keep Host Override But Downgrade Its Visibility

Override controls should exist for:

- replace `Next`
- replace `Then`
- reopen a locked slot
- pull something forward unexpectedly

But these should read as:

- `Override Next`
- `Swap Then`
- `Unlock Slot`

not as the default interaction model.

## Fallback And Playability Plan

Friday's failure mode was not only queue confusion. It was queue confusion under track uncertainty.

The hopper needs a stronger fallback ladder.

### Fallback Ladder For Any Committed Performance Slot

For `Next` and `Then`, compute and expose one of these states:

1. `Playable`
   - committed singer and safe backing ready
2. `Playable With Review`
   - likely usable, but host should verify
3. `Fallback Ready`
   - primary plan risky, but alternate backing or alternate queue candidate exists
4. `Needs Repair`
   - no safe playable path yet

### Runtime Behavior

If `Now` is active and `Next` becomes unplayable:

- do not force the host to scan the whole queue
- show one repair card directly on `Next`
- show the best fallback action first:
  - `Use Fallback Track`
  - `Swap With Then`
  - `Pull Best Queue Match`
  - `Open Slot`

If `Then` is broken while `Now` is active:

- treat it as background repair
- allow host, co-host, or crowd to resolve it without destabilizing `Next`

### Safe Hands-Off Goal

The room is truly hands-off only if the system can keep one playable item ahead.

Operational target:

- `Now` active
- `Next` always playable
- `Then` preferably committed, but may still be resolving

That is the practical minimum viable autonomy.

## Crowd And Co-Host Operating Model

### Crowd

The crowd should guide the night only at bounded decision points:

- open `Then`
- open `Next` after a completed song
- faceoff between two valid candidates
- optional scene choice after applause

The crowd should never create ambiguity about the active performer.

### Co-Hosts

Co-hosts should own preparation, not control.

Best co-host jobs:

- flag mix issues during `Now`
- help prepare queue candidates for `Then`
- help resolve playability or match issues before an item enters `Now`
- use helper catalog for long-range queue building

Do not turn the co-host phone into a shadow host console.

## Technical Implementation Plan

### Phase 1. UI Convergence

Goal:

- one hopper surface at the top of the queue page

Implementation:

- merge the semantic roles of `HostLiveOpsPanel` and `RunOfShowQueueHud`
- keep one visible three-slot horizon even when details are collapsed
- standardize labels around:
  - `Now`
  - `Next`
  - `Then`
  - `Locked`
  - `Needs Repair`
  - `Open`
- reduce duplicated summary language between stage, snapshot, and planner widgets

Likely files:

- `src/apps/Host/components/HostQueueTab.jsx`
- `src/apps/Host/components/RunOfShowQueueHud.jsx`
- `src/apps/Host/components/HostLiveOpsPanel.jsx`
- `src/apps/Host/components/StageNowPlayingPanel.jsx`

### Phase 2. Hopper State Model

Goal:

- compute one canonical live horizon state

Implementation:

- add a helper that derives:
  - `now`
  - `next`
  - `then`
  - commitment state
  - playability state
  - fallback state
  - recommended action
- this helper should merge data from:
  - active current performance
  - queue summary
  - run-of-show live/staged/next items
  - issue/preflight signals

Suggested new module:

- `src/apps/Host/lib/hopperModel.js`

This keeps the UI from re-encoding the same decision logic in multiple components.

### Phase 3. Locking And Override Rules

Goal:

- make horizon commitment explicit

Implementation:

- define when a position becomes `Locked`
- define the few actions that can unlock or replace it
- distinguish normal advancement from operator override
- make queue reorder interactions avoid accidentally reshaping committed positions

This likely touches:

- queue row affordances
- run-of-show move/skip logic
- slot-fill actions

### Phase 4. Fallback Repair Actions

Goal:

- make broken `Next` and `Then` recoverable in one move

Implementation:

- compute best fallback action for a broken slot
- route `Fix` into the most specific repair path
- expose direct actions in hopper card:
  - use alternate backing
  - swap with another committed slot
  - pull best queue match
  - mark open and continue

This should reuse existing repair and assignment flows where possible.

### Phase 5. Crowd/Co-Host Steering Hooks

Goal:

- let others guide the night without destabilizing the hopper

Implementation:

- allow bounded crowd decisions only for open or unresolved future positions
- keep co-host signals contextual to `Now`
- let co-host helper flows prepare `Then` and later candidates
- ensure crowd/co-host inputs resolve into hopper suggestions, not direct runtime mutations

## Data And Logic Principles

Do:

- derive the hopper from existing room, queue, and run-of-show state
- reuse run-of-show items as the canonical planned moments
- reuse queue songs as the canonical singer-performance feeder
- reuse existing issue/preflight language where possible

Do not:

- invent a second persisted scheduler
- create separate `hopper items` that duplicate run-of-show items and queue songs
- let multiple surfaces independently compute contradictory `next` answers

## Testing Plan

### Unit

Add deterministic tests for:

- hopper horizon derivation
- lock-state derivation
- fallback action ranking
- advancement after performance completion
- crowd/co-host influence boundaries

Suggested files:

- `tests/unit/hopperModel.test.mjs`
- targeted updates to:
  - `tests/unit/queueSurfaceModel.test.mjs`
  - `tests/unit/hostQueueTabRuntime.test.mjs`
  - `tests/unit/hostLiveOpsPanelSource.test.mjs`
  - `tests/unit/runOfShowPlannerRuntime.test.mjs`

### Integration

Protect:

- post-performance horizon shift
- broken `Next` repair path
- fill-open-slot into `Then`
- crowd-decision insertion into post-performance flow

Suggested coverage:

- `tests/integration/runOfShowActions.test.cjs`
- `tests/integration/runOfShowSlotSubmissions.test.cjs`
- new integration around horizon fallback if needed

### Playwright / Event QA

Update live-room QA to explicitly verify:

- host can always identify `Now / Next / Then`
- `Next` remains playable while `Now` is active
- unplayable next song yields one obvious fallback
- queue/add/inbox/planner transitions still do not crash
- co-host help does not interrupt live performer focus

Relevant scripts:

- `scripts/qa/host-room-hands-off-golden-playwright.mjs`
- `scripts/qa/host-run-of-show-console-playwright.mjs`
- `scripts/qa/cohost-helper-flow-playwright.mjs`

## Success Criteria

Product success:

- a busy host can answer `what are the next three things?` in under two seconds
- the host can run most of the night without diving into the full planner
- the crowd can influence future slots without disrupting current spotlight
- co-hosts can help prepare the next moments without becoming a second operator lane

Technical success:

- one canonical hopper derivation path
- reduced duplication between live snapshot and run-of-show HUD
- no new scheduler primitive
- deterministic coverage for horizon, fallback, and advancement logic

## Recommended Sequence

1. Build `hopperModel` and align labels.
2. Converge `HostLiveOpsPanel` and `RunOfShowQueueHud` into one visible hopper rail.
3. Add lock states and explicit override affordances.
4. Add direct fallback actions for broken `Next` and `Then`.
5. Add bounded crowd/co-host steering rules around open future positions.
6. Extend QA around horizon confidence and fallback recovery.

## Bottom Line

The right move is not to give the host more queue power.
The right move is to give the host a stronger live commitment model.

We already have most of the system.
The next pass should make the host feel that the room is always running through one protected hopper:

- something is happening now
- something playable is next
- something else is being prepared after that

If we deliver that cleanly, the host can become much more hands-off without losing control.
