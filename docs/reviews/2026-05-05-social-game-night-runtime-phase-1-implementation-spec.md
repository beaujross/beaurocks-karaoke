# Social Game Night Runtime Phase 1 Implementation Spec

Date: May 5, 2026

Audience: Engineering, Product, Design

## Purpose

This spec turns the runtime strategy into an execution-ready phase 1 plan.

It answers:

- which files we should touch first
- which new files we should add
- what the first experiment should and should not do
- how we keep the design extensible for `hostLed`, `collaborative`, `audienceLed`, and `curatedShowcase`

Related docs:

- [2026-05-05-social-game-night-runtime-experiment-plan.md](<C:\Users\beauj\Desktop\beaurocks-karaoke\docs\reviews\2026-05-05-social-game-night-runtime-experiment-plan.md:1>)
- [2026-05-05-social-game-night-runtime-coverage-matrix.md](<C:\Users\beauj\Desktop\beaurocks-karaoke\docs\reviews\2026-05-05-social-game-night-runtime-coverage-matrix.md:1>)
- [2026-05-05-social-game-night-runtime-executive-review-addendum.md](<C:\Users\beauj\Desktop\beaurocks-karaoke\docs\reviews\2026-05-05-social-game-night-runtime-executive-review-addendum.md:1>)

## Executive Guardrails

The first implementation must honor these conditions from the CPO, CTO, and CMO review:

- the host eye-line must answer:
  - who is live now
  - what is next
  - what needs intervention
- the runtime shell model must normalize object types at minimum as:
  - `performance`
  - `scene`
  - `moment`
  - `attention`
- the shell model must stay read-only and deterministic
- the first visible experiment must still feel recognizably `Social Game Night`, not like a generic fallback admin layout
- audience-led and vote-driven paths must stay alive in the contracts even if phase 1 defaults to `hostLed`

## Phase 1 Goal

Ship an opt-in experimental host runtime shell that:

- preserves existing host behavior
- introduces the new `Social Game Night` host grouping
- centers the current performance with a contextual performer ring
- keeps transport in a separate playback dock
- keeps room-wide controls out of the ring
- leaves all current workspaces reachable

Phase 1 is host-first.
It should prepare for TV and Audience alignment, but it should not try to fully rebuild those surfaces yet.

## Phase 1 Non-Goals

- no second queue system
- no second run-of-show system
- no replacement of current queue and song action handlers
- no full Public TV rewrite
- no full Audience App rewrite
- no account-level preference sync
- no preset system beyond lightweight scaffolding

## Current Integration Seams

These are the real anchors for the implementation.

### Runtime Composition

- [HostQueueTab.jsx](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Host\components\HostQueueTab.jsx:1>)

Why it matters:

- it already composes `StageNowPlayingPanel`, `QueueListPanel`, `RunOfShowQueueHud`, and `HostInboxPanel`
- it already owns the action handlers we need to reuse
- it already carries track-check and post-performance behavior

### Performance-Scoped Controls

- [StageNowPlayingPanel.jsx](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Host\components\StageNowPlayingPanel.jsx:1>)

Why it matters:

- it already separates live-performance actions from other controls
- it already exposes applause, end-performance, return-to-queue, track rating, and transport-related controls

### Queue and Automation Depth

- [QueueListPanel.jsx](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Host\components\QueueListPanel.jsx:1>)

Why it matters:

- it already owns queue rules and automation quick controls
- it already surfaces `Fill Next Slot`-style helpers and queue shaping

### Room-Wide Controls

- [HostTopChrome.jsx](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Host\components\HostTopChrome.jsx:1>)

Why it matters:

- it already owns `Ready Check`, `Auto DJ`, TV controls, overlays, room quick menus, and launch flows
- it is the correct home for room-wide toggles that must stay out of the ring

### Attention and Collaboration

- [HostInboxPanel.jsx](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Host\components\HostInboxPanel.jsx:1>)

Why it matters:

- it already owns moderation, DMs, and deferred attention flows

### Host Preference Storage

- [hostUiPrefs.js](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Host\lib\hostUiPrefs.js:1>)

Why it matters:

- it is the minimal existing pattern for grouped host UI prefs
- it is the right place to hang the experimental shell mode and future shell preferences

### Workspace Escape Hatches

- [navConfig.js](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Host\workspace\navConfig.js:1>)

Why it matters:

- the experiment must not strand deeper workspaces like `show`, `audience`, `media`, and `games`

## Phase 1 Architecture

Phase 1 should be a render-path fork, not a behavior fork.

### Rule

The experimental shell derives from existing state and calls existing handlers.

### Shape

- `HostQueueTab` decides whether to render `classic` or `social_game_night_experiment`
- the experimental branch receives a normalized runtime view model
- the experimental branch delegates back to existing action handlers

## New Runtime Concepts

Phase 1 should introduce these derived concepts, but only as computed UI state:

- `currentPerformance`
- `nextPerformance`
- `rotationFlow`
- `candidatePool`
- `inboxAttention`
- `trackCheckState`
- `roomAutomationState`
- `runtimeModeEmphasis`

Initial `runtimeModeEmphasis` values:

- `hostLed`
- `collaborative`
- `audienceLed`
- `curatedShowcase`

Phase 1 behavior can still default hard to `hostLed`.
The important part is that the view model and component contracts do not assume only one mode exists.

## Files To Add

### 1. `src/apps/Host/components/HostRuntimeShellExperimental.jsx`

Purpose:

- top-level experimental host runtime shell
- receives the derived runtime model plus existing handlers and support props
- composes the new shell layout

Responsibilities:

- render the `Current Performance Core`
- render the `Next-Up / Prep` area
- render the `Rotation Lane`
- render the `Candidate Pool`
- render the `Attention / Inbox` summary
- render the `Playback Dock`

Should not do:

- direct data fetching
- new queue mutation logic
- new orchestration logic

### 2. `src/apps/Host/components/HostPerformerRing.jsx`

Purpose:

- central contextual performer ring around the current or next live object

Phase 1 actions:

- `End Song`
- `Applause`
- `Track Check`
- `Return`
- `Bonus`
- `Details`

Contract rule:

- only performance-scoped actions
- no room-wide toggles

### 3. `src/apps/Host/components/HostPlaybackDock.jsx`

Purpose:

- dedicated lower transport dock

Phase 1 contents:

- play / pause state
- source label and tone
- transport actions already exposed by host runtime
- compact source detail

This should visually separate transport from contextual performer control.

### 4. `src/apps/Host/components/HostRotationLane.jsx`

Purpose:

- compact display of next performers and fairness context

Phase 1 scope:

- show next few queued / ready items
- show lightweight readiness signal
- allow selecting a next item for shell focus

### 5. `src/apps/Host/components/HostCandidatePool.jsx`

Purpose:

- compact pool of candidate singers, queue items, and scenes / moments

Phase 1 scope:

- show promotable items
- support lightweight focus / selection
- optionally expose one promoted action like `Fill Next Slot`

### 6. `src/apps/Host/lib/hostRuntimeShellModel.js`

Purpose:

- compute the experimental-shell view model from existing host state

Should own:

- normalization of `currentPerformance`
- normalization of `nextPerformance`
- derivation of rotation subset
- derivation of candidate pool subset
- derivation of attention summary
- derivation of mode emphasis

Should not own:

- data writes
- orchestration side effects

### 7. `src/apps/Host/lib/hostRuntimeShellPresets.js`

Purpose:

- small constants-only module for shell emphasis defaults

Phase 1 scope:

- define safe defaults for `hostLed`
- optional placeholder objects for the other emphasis modes

This is mainly a structure guard so the experiment stays extensible.

## Files To Edit

### 1. `src/apps/Host/lib/hostUiPrefs.js`

Changes:

- add getter for runtime shell mode
- add getter for runtime mode emphasis
- add grouped patch support for new shell prefs

Phase 1 suggested fields:

- `runtimeShellMode`
- `runtimeModeEmphasis`
- `performerRingEnabled`
- `candidatePoolExpanded`
- `rotationLaneDensity`

Guardrail:

- do not mix room policy with host-only shell prefs

### 2. `src/apps/Host/components/HostQueueTab.jsx`

Changes:

- import the experimental shell
- import the runtime-shell model builder
- compute the derived model from existing queue / stage / room / inbox data
- branch render path based on `hostUiPrefs.runtimeShellMode`

Likely responsibilities inside `HostQueueTab`:

- continue owning all current handlers
- continue owning current data subscriptions and effects
- continue owning track-check deferral behavior
- pass existing handlers through to the experimental shell

Important:

- phase 1 should not delete or heavily restructure the classic render path
- the experimental render path should be additive and isolated

### 3. `src/apps/Host/components/HostTopChrome.jsx`

Changes:

- possibly add a lightweight shell-toggle entry point if product wants in-UI switching
- ensure top-chrome still exposes room-wide controls cleanly when experimental shell is active

Guardrail:

- do not migrate room controls into the experimental ring

### 4. `src/apps/Host/components/StageNowPlayingPanel.jsx`

Changes:

- minimal only
- ideally none in phase 1 unless a small extraction helps reuse copy or action groupings

This file is more reference and behavior source than the new UI destination.

### 5. `src/apps/Host/components/QueueListPanel.jsx`

Changes:

- minimal only
- possibly expose or reuse a compact quick-control object shape already used by the experimental shell

Guardrail:

- keep queue depth workflows intact

## Files To Avoid In Phase 1

These should stay largely untouched unless a blocker appears:

- [roomFlowOrchestrator.js](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Host\roomFlowOrchestrator.js:1>)
- [runOfShowDirector.js](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\lib\runOfShowDirector.js:1>)
- heavy Audience runtime files
- heavy TV runtime files

Reason:

- phase 1 is a host shell experiment, not a behavior rewrite

## Proposed Component Contracts

### `HostRuntimeShellExperimental`

Inputs should include:

- `room`
- `runtimeModel`
- `styles`
- `emoji`
- `onEndPerformance`
- `onMeasureApplause`
- `onReturnCurrentToQueue`
- `onTrackCheckAction`
- `onAddBonusToCurrent`
- `onOpenQueue`
- `onOpenAdd`
- `onOpenInbox`
- `onOpenPlanner`
- `onTriggerReadyCheck`
- `onToggleAutoDj`
- `onFillNextSlot`

Not every prop needs to be wired on day one.
The point is to reuse existing host actions, not recreate them.

### `hostRuntimeShellModel`

Input shape can stay broad in phase 1:

- `room`
- `songs`
- `queue`
- `pending`
- `assigned`
- `held`
- `reviewRequired`
- `current`
- `nextQueueSong`
- `runOfShow` summaries if available
- `deferredTrackChecks`
- `inbox` summary counts if available

Output shape:

- `currentPerformance`
- `nextPerformance`
- `rotationFlow`
- `candidatePool`
- `attention`
- `playback`
- `roomControlsSummary`
- `runtimeModeEmphasis`

## Suggested Build Order

### Step 1. Preference Scaffolding

Edit:

- [hostUiPrefs.js](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Host\lib\hostUiPrefs.js:1>)

Add:

- runtime shell mode getters and defaults

### Step 2. Runtime Model Builder

Add:

- `hostRuntimeShellModel.js`

Goal:

- get a stable model before building the visual shell

### Step 3. Shell Skeleton

Add:

- `HostRuntimeShellExperimental.jsx`

Goal:

- render a placeholder structured shell using derived model only
- no fancy ring behavior yet

### Step 4. Performer Ring

Add:

- `HostPerformerRing.jsx`

Goal:

- wire phase 1 ring actions to current handlers

### Step 5. Playback Dock

Add:

- `HostPlaybackDock.jsx`

Goal:

- keep transport distinct and always visible in the experimental shell

### Step 6. Rotation and Candidate Modules

Add:

- `HostRotationLane.jsx`
- `HostCandidatePool.jsx`

Goal:

- restore enough live context so the host is not forced back into panel scanning

### Step 7. `HostQueueTab` Branching

Edit:

- [HostQueueTab.jsx](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Host\components\HostQueueTab.jsx:1>)

Goal:

- turn on the new shell behind `runtimeShellMode`

## Mode-Extensibility Requirements

Even though phase 1 is effectively `hostLed`, the code should remain extensible.

### Required structural decisions

- include `runtimeModeEmphasis` in the runtime model
- keep candidate pool and rotation lane as separate modules
- keep room-wide controls separate from performer controls
- do not name modules in a way that assumes a host is always present

### Things that can wait

- full audience-led presets
- full co-host targeted shell variants
- separate TV and mobile implementation branches

## Testing Plan

Phase 1 needs targeted regression protection, not exhaustive visual test coverage.

### Unit-Level

Add tests for:

- `hostUiPrefs` getters and defaults
- `hostRuntimeShellModel` normalization and mode defaults

### Runtime Smoke

Add or extend host runtime tests to confirm:

- classic mode still renders
- experimental mode renders
- experimental mode still has access to queue and inbox pathways
- post-song track-check flow does not disappear

### Manual QA

Minimum scenarios:

1. `hostLed` busy-night queue with a live performer and a real next singer
2. post-song wrap with applause and track-check prompt
3. next-up transition with track not fully confirmed
4. automation on with `Auto DJ`
5. run-of-show present but not rewritten

## Acceptance Criteria

Phase 1 is successful when:

- the experimental shell can run a normal live song flow
- the host can clearly see current and next
- the performer ring is useful without becoming a junk drawer
- transport remains separate
- classic host surface remains intact
- queue, inbox, planner, and room controls remain reachable
- nothing in the implementation blocks future `audienceLed` emphasis

## Immediate Engineering Next Step

Start with:

1. `hostUiPrefs.js`
2. `hostRuntimeShellModel.js`
3. `HostRuntimeShellExperimental.jsx`
4. `HostQueueTab.jsx` branch

That gets the experiment on screen quickly while keeping the first slice bounded.
