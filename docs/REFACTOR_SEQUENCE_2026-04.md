# Refactor Sequence (April 2026)

Last updated: 2026-04-14

## Purpose

Turn the existing "large-file awareness" work into a strict extraction order that reduces regression risk instead of just redistributing imports.

This sequence is based on the current repo state:

- `src/apps/Host/HostApp.jsx`: ~20,131 lines
- `src/apps/Mobile/SingerApp.jsx`: ~12,025 lines
- `src/apps/TV/PublicTV.jsx`: ~8,607 lines
- `src/apps/Host/components/RunOfShowDirectorPanel.jsx`: ~6,731 lines
- `functions/index.js`: ~16,064 lines
- `src/apps/Marketing/marketing.css`: ~17,950 lines

## Operating Principles

## Fresh Takeaways (2026-04-14)

These came directly from the host game matrix remediation and should influence the next refactor cuts.

### Audience readiness is not the same as auth-backed identity

The product repeatedly exposed a real distinction:

- a phone can be in a valid live audience state
- while still not exposing the auth-backed UID the QA harness expected

That means refactors and tests must not collapse these into one concept.

Practical rule:

- treat "usable audience shell" as one contract
- treat "seedable identity for fixture/setup flows" as a stricter contract used only when required

This especially matters for:

- `SingerApp.jsx`
- setup-heavy modes like `karaoke_bracket`
- any future extraction of join/auth/bootstrap logic

### QA should model real takeover states, not a single ideal join screen

A failed matrix run was eventually traced to this:

- the live audience page sometimes opened directly into an active bracket takeover
- the runner still assumed the only healthy precondition was the classic joined main shell

Future automation should always recognize:

- joined shell
- mode-specific takeover shell
- config/setup shell when the mode intentionally starts there

If the product can validly render a state, QA should treat that state as first-class instead of as noise.

### SingerApp auth bootstrap is part of the critical path

The audience shell still had a product-level gap:

- `waitForJoinAuthUid()` could wait on auth
- without guaranteeing auth bootstrap had even started

The durable lesson is that audience auth bootstrap is not just implementation detail. It is part of the release-critical audience join contract and belongs with other early-path ownership concerns in the refactor order.

### Shared parsing helpers deserve narrow regression tests

The room-browser work exposed an easy-to-miss class of failures:

- host UI labels like `BROWSER` and `DASHBOARD` looked like room codes to loose parsing

The fix was small, but the lesson is larger:

- when a helper is shared across host/audience/TV QA scripts, add a precise unit test as soon as a new false positive appears
- do not rely on Playwright reruns alone to preserve this behavior

### Extraction rule

Do not count an extraction as complete unless all three move together:

1. state ownership
2. side effects / subscriptions / writes
3. rendering or callable registration

If only JSX or helper functions move, the main file is still the owner and the risk surface did not materially change.

### Product-risk rule

Refactor order should follow the release-critical contract first:

1. host can open/create a room
2. TV can attach
3. audience can join without dead ends
4. host and audience requests synchronize
5. lyrics/media/performance remain stable through an active song

When a technically clean extraction conflicts with a more failure-prone product path, prioritize the product path.

### PR sizing rule

One subsystem extraction per PR.

Do not combine:

- host launch/workspace extraction
- billing/invoice extraction
- audience join/request extraction
- run-of-show extraction
- Cloud Functions directory/host-access extraction

Those may be adjacent in code, but they are not one review unit.

## Target Order

### 1a. HostApp room launch and workspace operator split

Priority: highest

Why this goes first:

- `HostApp.jsx` is still the biggest orchestration surface.
- Room launch and workspace entry are part of the critical host path.
- This is a practical first extraction with cleaner boundaries than the performance engine.

Primary source:

- `src/apps/Host/HostApp.jsx`

Primary extraction targets:

- room-manager and launch state
- recent room loading
- launch mode and launch URLs
- workspace operator loading
- host entry / room bootstrap orchestration that still lives in the shell

Suggested destination modules:

- `src/apps/Host/hooks/useHostRoomManager.js`
- `src/apps/Host/hooks/useHostWorkspaceState.js`

Exit criteria:

- `HostApp.jsx` no longer owns recent-room and launch/workspace operator state directly.
- landing/launch behavior can be tested without mounting the full host shell.
- extracted hooks expose narrow inputs/outputs instead of depending on broad component-local state.

Verification:

- host launch/access tests
- targeted unit coverage for extracted hooks
- `npm run qa:release:core-night`

Progress so far:

- extracted `useHostRoomManager.js` for recent-room subscription and room-manager busy state
- extracted `useHostWorkspaceState.js` for launch/workspace operator state and launch URL resolution
- extracted `useHostLandingLaunchpad.js` for landing launch derivation, venue autocomplete, and retry/start actions
- extracted `useHostEntryBootstrap.js` for URL/query-driven host entry bootstrapping
- extracted `useHostWorkspaceNavigation.js` for admin/workspace routing and join-then-open flow
- extracted `useHostLaunchSession.js` for create-room wrapper, onboarding launch, and return-to-dashboard flow
- extracted `useHostNightSetupFlow.js` for night-setup recommendation, wizard orchestration, and launch-package apply flow
- `HostApp.jsx` is down from about 20,131 lines to about 19,207 lines after the first landing/workspace cuts

### 1b. HostApp billing, usage summary, and invoice split

Priority: very high

Why this is separate from 1a:

- Billing and invoice flows are a distinct subsystem even though they live in the same file.
- Combining them with launch/workspace extraction would create a large, hard-to-review PR with weak rollback clarity.

Primary source:

- `src/apps/Host/HostApp.jsx`

Primary extraction targets:

- usage summary loading and refresh
- invoice draft generation and save flows
- subscription and billing action state

Suggested destination modules:

- `src/apps/Host/hooks/useHostBillingState.js`

Exit criteria:

- `HostApp.jsx` no longer owns billing and invoice state directly.
- billing actions can be tested without mounting unrelated host controls.
- invoice behavior and usage refresh logic are isolated from room lifecycle code.

Verification:

- billing and usage-related unit coverage
- `npm run build`
- `npm run test:unit`

### 2. SingerApp core flow split

Priority: very high

Why this moved earlier:

- `SingerApp.jsx` has a repeated history of hook-order and early-return regressions.
- Audience join and request submission sit directly on the release-critical path.
- This file is still a larger production risk than many host-only subsystems.
- Audience auth bootstrap and session identity proved again on 2026-04-14 that this is not optional cleanup; it directly affects whether production QA can even enter the room reliably.

Primary source:

- `src/apps/Mobile/SingerApp.jsx`

Primary extraction targets:

- join/auth bootstrap
- audience identity/profile state
- request composer and backing-selection flow
- current song / lyrics / stage-home state

Suggested destination modules:

- `src/apps/Mobile/hooks/useAudienceJoinFlow.js`
- `src/apps/Mobile/hooks/useAudienceRequestFlow.js`
- `src/apps/Mobile/hooks/useAudienceStageState.js`
- `src/apps/Mobile/components/*`

Exit criteria:

- early-return branches in `SingerApp.jsx` stop owning core hook order.
- join logic, retry logic, and request submission stop living inline beside unrelated rendering.
- request flow can be tested without mounting the full audience shell.

Verification:

- `tests/unit/singerAppHooks.test.mjs`
- `tests/unit/songRequestResolution.test.mjs`
- `tests/unit/requestModes.test.mjs`
- targeted audience session/auth identity coverage whenever join/bootstrap behavior changes
- audience join/request smoke
- `npm run qa:release:core-night` for any join/request changes

### 3. Run-of-show subsystem extraction

Priority: high

Why this is third:

- `RunOfShowDirectorPanel.jsx` is already large enough to be its own monolith.
- `HostApp.jsx` still owns run-of-show policy, roles, templates, submissions, automation retry, and moment feedback state alongside the panel.
- This remains important, but it is slightly behind audience core flow in release risk.

Primary source:

- `src/apps/Host/components/RunOfShowDirectorPanel.jsx`
- `src/apps/Host/HostApp.jsx`
- `src/lib/runOfShowDirector.js`

Primary extraction targets:

- run-of-show controller state
- submission loading / review actions
- template management
- automation retry and transition handling
- queue assignment coordination

Suggested destination modules:

- `src/apps/Host/hooks/useRunOfShowController.js`
- `src/apps/Host/components/runOfShow/*`

Exit criteria:

- `HostApp.jsx` only wires the run-of-show controller into the host shell.
- `RunOfShowDirectorPanel.jsx` becomes a view layer plus small local UI state.
- run-of-show mutations stop being scattered across the host shell and panel.

Verification:

- `tests/unit/runOfShowDirector.test.mjs`
- `tests/integration/runOfShowActions.test.cjs`
- `tests/integration/runOfShowSlotSubmissions.test.cjs`
- host run-of-show Playwright smoke

### 4. Cloud Functions directory and host-access contract split

Priority: high

Why this goes fourth:

- `functions/index.js` is still too large to review safely.
- The main goal is not just file breakup. It is domain ownership of validation, path helpers, handler implementation, and tests.
- This area changes often and should become importable by contract rather than by side effect from one giant file.

Primary source:

- `functions/index.js`

Primary extraction targets:

- host application / approval flows
- directory entity normalization and validation
- directory discover listing logic
- reminder and reporting handlers
- shared path helpers and Firestore collection helpers for those domains

Suggested destination modules:

- `functions/lib/directory/*.js`
- `functions/lib/hostAccess/*.js`
- `functions/lib/marketing/*.js`

Required ownership model:

Each extracted domain should own:

- validators and normalizers
- Firestore collection/path helpers
- callable or trigger handler implementation
- tests for the data contract

Exit criteria:

- `functions/index.js` becomes registration/composition only for extracted domains.
- callables import domain-owned validators/helpers instead of defining them inline.
- tests can import directory or host-access logic without importing the whole file.

Verification:

- `tests/integration/directoryCallables.test.cjs`
- `tests/integration/hostAccessGuardrails.test.cjs`
- targeted unit coverage for normalization and contract helpers
- `npm run test:callables`

### 5. PublicTV mode and overlay split

Priority: medium-high

Why this is fifth:

- `PublicTV.jsx` is large, but several higher-risk ownership seams exist elsewhere first.
- The useful split is by mode/render branch, not by random helpers.
- The objective is to isolate lobby/playground, performance-stage, recap, and crowd-moment overlays so TV changes stop colliding.

Primary source:

- `src/apps/TV/PublicTV.jsx`

Primary extraction targets:

- lobby/playground mode
- active performance mode
- crowd moment overlays
- recap / announcement / idle branches

Suggested destination modules:

- `src/apps/TV/hooks/usePublicTvState.js`
- `src/apps/TV/components/*`
- `src/apps/TV/modes/*`

Exit criteria:

- `PublicTV.jsx` becomes a mode router plus shared subscriptions.
- each major TV mode has a bounded render owner.
- mode-specific effects are not interleaved across the entire file.

Verification:

- `tests/unit/lobbyPlaygroundEngine.test.mjs`
- `tests/unit/vibeModeEngine.test.mjs`
- public TV visual regression scripts

## Explicit Non-Goals For This Pass

Do not start here unless one of the targets above is already in progress:

- `marketing.css` cosmetic cleanup
- generic utility reshuffling
- broad renaming passes
- moving constants into separate files without moving the behavior that uses them

## Hard Completion Gates

A target is done only when:

- the top-level owner file is materially smaller
- the extracted module owns the side effects, not just helper functions
- targeted tests pass for that subsystem
- release smoke still passes when the subsystem touches host, audience, or TV critical path

For this repo, "materially smaller" should mean one of:

- the owner file is reduced by at least 15% for the completed milestone, or
- the PR includes a short written exception explaining why the ownership change was worth it despite a smaller reduction

## Change Control Rules

- No new cross-domain state may be added to `HostApp.jsx`, `SingerApp.jsx`, or `functions/index.js` while these refactors are active.
- If a production fix must touch one of those files, prefer patching the extracted subsystem first and wiring it back in.
- Any PR that changes host, audience, or TV critical path behavior must include:
  - `npm run build`
  - targeted tests
  - `npm run qa:release:core-night` when the path includes join, request, queue, TV sync, or active performance behavior

## First Four Execution Steps

1. Extract host launch/recent-room/workspace-operator state from `HostApp.jsx`.
2. Extract billing/usage/invoice state from `HostApp.jsx`.
3. Extract `SingerApp` join/request/stage state before touching less critical audience overlays.
4. Split directory and host-access domains out of `functions/index.js` with owned validators and path helpers.
