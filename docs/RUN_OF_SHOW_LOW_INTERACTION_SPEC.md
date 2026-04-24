# Run Of Show Low-Interaction Spec

Last updated: 2026-04-24
Owner: Product / Host surface

Companion docs:

- `HOST_OPERATOR_UI_SIMPLIFICATION_SPEC.md`
- `HOST_CONSOLE_MOMENT_AUDIO_SPEC.md`

## Goal

If a run of show has been set up, the host should be able to run the night with very little interaction.

Target interaction budget once the show is live:

- `0` actions for a block that is fully ready and auto-advances
- `1` action for a normal manual block transition
- `1` extra action only when something goes wrong

The run-of-show surface should behave more like a cue sheet than an editor during live operation.

Planned pacing cues, including short audio stings, should live here by default. The queue page should only expose a tiny set of safe live moment overrides, not a full soundboard workflow.
Each eligible scene should be able to store one optional `Scene Cue` with simple timing (`start` or `end`) so intros, reveals, and closing beats can auto-fire from the run of show itself.
Those scene cues should use the same preset family as the live queue-page `Moments` strip, so planned beats and live overrides feel like one console language instead of separate tools.

## 2026-04-24 Setup And Dead-Air Context

Run of show now needs to stay aligned with the host `Room Readiness` model:

- setup is not a separate admin concept; it is the room-readiness state that launch and run-of-show should consume
- the run-of-show creator should inherit persisted `missionControl.setupDraft` where possible
- automation preset mapping should stay consistent with setup assist levels:
  - `hands_on` maps to `manual_first`
  - `balanced` maps to `smart_assist`
  - `autopilot` maps to `autopilot_first`
- generated Autopilot buffers should be explicit `Dead-Air Bridge` blocks
- generated Balanced buffers should keep known-good filler suggestions ready for host approval
- dead-air filler candidates come from the browse catalog known-good song plan

Implementation anchors:

- `src/apps/Host/runOfShowAutopilot.js`
- `src/apps/Host/deadAirAutopilot.js`
- `src/apps/Host/components/RunOfShowDirectorPanel.jsx`
- `tests/unit/runOfShowAutopilot.test.mjs`

## Core Principle

Split run of show into three explicit phases:

1. `Build Show`
2. `Preflight`
3. `Run Show`

Do not mix those phases inside one always-live control surface.

## Phase 1: Build Show

This is where complexity is allowed.

Allowed here:

- timeline and block editing
- generator and templates
- performer assignment
- backing assignment
- submission review
- advanced automation policy tuning
- role and co-host setup
- room moment / takeover planning

This is the only place where the host should routinely see:

- backing source menus
- policy detail fields
- queue divergence configuration
- no-show / late-block tuning
- media curation controls

## Runtime Anchor

The queue page remains the host's operational home during a live night.

That means:

- the compact run-of-show strip on the queue page is the primary live `Show HUD`
- the dedicated show workspace is the deeper drill-down for setup, launch checks, and repairs
- the host should not feel like they are choosing between two different live control systems

Role split:

- queue-page HUD
  - `Now`
  - `Next`
  - one status line
  - one primary action
  - optional timeline strip
- show workspace
  - build timeline
  - run launch checks
  - resolve blockers
  - inspect the full show map

Both surfaces must share the same:

- status words
- primary action labels
- issue summary language

## Phase 2: Preflight

Before the host starts the run of show, the system should collapse all setup complexity into one readiness pass.

Preflight should open as a `Go Live` step, not live as a permanent runtime mode.

The host should see one checklist:

- all required performance slots have a performer or are intentionally open-submission
- all required performance slots have a safe backing plan
- no critical pending approvals remain
- no critical blocked items remain
- risky backing sources are surfaced

Critical blockers:

- missing performer on a required performance slot
- missing approved/usable backing on a required performance slot
- rejected backing
- unapproved user-submitted backing required for a performance
- invalid local/manual source required for a performance

Preflight actions:

- `Fix Critical Issues`
- `Review Risky Items`
- `Start Show`
- `Start Anyway`

`Start Anyway` should be host-only and should preserve a warning summary.

## Phase 3: Run Show

Once live, the host should not be editing the show. They should be keeping it moving.

The live surface should show:

- `Live`
- `Next`
- `Needs Attention` if present
- one operating hint
- one primary action

The stage companion next to that HUD should default to:

- transport
- end / next controls
- backing feedback when relevant

Everything else should stay behind one secondary `More Controls` reveal.

The live queue companion should follow the same rule:

- one next-action summary
- `Needs Review` when approvals are blocking
- `Ready To Run` as the primary list
- `Tied To Show` only when slots have already claimed songs

Primary runtime actions:

- `Start Show`
- `Advance`
- `Resume`
- `Fix Issue`

Runtime should hide by default:

- generator
- templates
- deep policy controls
- backing source selectors
- media source menus
- item editing forms
- role management
- quick-draft tools
- curator-level diagnostics

## Runtime UI Model

### Build Show

Use the full editor.

### Run Show

Use a thin live HUD.

Live HUD anatomy:

- one status chip
- one one-line issue or readiness summary
- one primary action
- `Now`
- `Next`
- optional `Later` strip or drawer

The host should not need to scroll a dense editor to find the next action.

## Ownership Rules

Once run of show is active, run of show becomes the primary source of truth for what happens next.

That means:

- queue is a feeder
- queue review is secondary
- queue assignment should serve run-of-show slots
- hosts should not have to decide whether to fix something in queue or in run of show

If run of show is active:

- unresolved queue items stay in queue
- active run-of-show blocks drive the stage
- run-of-show blocker resolution owns fixes for the current or next block

For performance scenes, prep should collapse into one visible path:

- show one `Slot Prep` summary near the top of the scene
- let `Slot Prep` own the overall readiness summary
- tell the host the next missing step:
  - `Review Singer Picks`
  - `Use Best Queue Match`
  - `Choose Singer`
  - `Add Song Details`
  - `Find Karaoke Backing`
- use the `Singer / Song / Track` stepper only for orientation and navigation
- let the open prep step own the detailed explanation and controls
- keep deeper queue, approval, and backing controls available underneath as fallback detail
- keep advanced track/source overrides collapsed unless the slot is using a manual or canonical-source exception
- when advanced track controls do open, keep them as one fallback surface instead of nested panels

When a host approves a singer submission and the slot still lacks a playable track:

- hand off directly into backing repair
- do not force the host to return to approvals, then reopen the slot, then open track search separately

Inside a focused performance repair view:

- suppress extra scene explainers and duplicate status chips
- keep `Slot Prep` visually dominant
- push submission rules and other secondary policy controls behind compact collapsible panels
- move generic scene metadata into a lower-priority `Scene Settings` panel below the prep flow
- collapse the left scene rail to a compact summary with one readiness line, one timing line, and a minimal action row
- keep the repair header to one short line; do not spend extra copy restating that the host is already in repair mode

`Fix Issue` should route the host into the most specific repair path available:

- singer approval -> approvals / review path
- missing or risky backing -> backing repair path
- setup gap -> focused item setup
- only fall back to the full builder when no narrower repair path exists

When `Fix Issue` opens a build-path repair:

- enter a temporary `repair mode`
- keep the host on one focused scene
- hide the show map and broader timeline builder by default
- replace scene-to-scene navigation with a single `Open Full Builder` escape hatch
- let the host expand back to the full editor only when they want broader timeline work

## Backing Source Rules

For low-interaction runtime, normal shows should only allow safe backing types inside active run-of-show performance blocks:

- `canonical_default`
- approved `youtube`
- approved `apple_music`
- approved `local_file`

Advanced/risky backing types should be restricted:

- `user_submitted`
- `manual_external`

Rules:

- allowed during `Build Show`
- surfaced as risky in `Preflight`
- discouraged or blocked in `Autopilot`
- require explicit host acceptance before live use

## Automation Model

Collapse runtime policy complexity into three presets for normal use:

- `Manual`
  - host advances each block
  - system does not auto-skip blockers

- `Assisted`
  - system stages obvious next blocks automatically
  - host still approves major transitions or exceptions

- `Autopilot`
  - system advances ready blocks aggressively
  - only exceptions interrupt the flow

Advanced policy knobs may still exist, but should live behind an `Advanced` section in `Build Show`.

## Readiness States

Each run-of-show performance block should collapse into one visible readiness state:

- `Ready`
- `Needs Singer`
- `Needs Track`
- `Blocked`

Those visible states should be derived from the richer underlying readiness model.

## Exception Handling

During `Run Show`, the host should only be interrupted for exceptions.

Exceptions:

- current block cannot start
- next block is not ready and automation cannot safely continue
- approved backing failed or was replaced
- performer no-show requires intervention
- run-of-show diverged from queue in a way the preset cannot handle automatically

Exception drawer actions:

- `Use Queue Fallback`
- `Pick Another Track`
- `Skip Block`
- `Hold Show`
- `Open Full Editor`

Do not dump the host back into the full planner by default.

## Small-Screen Behavior

The existing small-screen complaint applies even more strongly here.

For laptop and below:

- `Build Show` may use the full editor
- `Run Show` must use a simplified HUD
- exception handling should open in a drawer or takeover panel
- do not show dense multi-pane timeline + issue + detail layouts during live operation

## Interaction Contract

This should align with the host/operator simplification work:

- queue/backing simplification reduces per-request interaction
- run-of-show simplification reduces per-block interaction

Combined target once the night is configured:

- the host should mostly watch `Live`, glance at `Next`, and only touch the system when a block changes or a blocker appears

## Implementation Direction

### Phase A

- define and enforce `Build Show`, `Preflight`, and `Run Show`
- add one preflight checklist before `Start Run Of Show`

### Phase B

- make the queue-page run-of-show strip the primary live HUD
- keep the show workspace as a drill-down, not a second cockpit
- hide or collapse planning controls once live

### Phase C

- collapse automation choices to `Manual`, `Assisted`, and `Autopilot`
- move detailed policy tuning behind `Advanced`

### Phase D

- narrow `Fix Issue` into specific repair views instead of opening the full workspace by default
- reduce builder density so repair mode and edit mode feel meaningfully different

## Current Friction Audit

Biggest remaining operational friction, ordered by impact:

1. `Build Show` is still too dense.
   The live HUD is cleaner, but the show workspace editor still asks the host to parse too much at once.

2. Queue + run-of-show overlap still leaks through on performance slots.
   Assignment, approvals, and backing repair are better aligned, but not fully collapsed into one obvious path.

3. Host top chrome is still crowded.
   The run-of-show HUD is better, but nearby controls still compete for attention during live operation.

4. `Fix Issue` still sometimes lands in a broad workspace.
   The repair path needs to become narrower and more intentional.

5. Builder/runtime separation is improved but not complete.
   A host can still drift into using the show workspace like a second live cockpit.

6. Performance track setup should read like one flow, not two peer modules.
   `Track Setup` should own the main path: pick a track, confirm it works, move on.
   `Track Check` and `Track Details` should stay secondary and only surface deeper source controls when the default flow is not enough.

7. Builder-only footer actions should disappear in repair mode.
   `Move Up`, `Duplicate`, and `Archive` are useful in setup, but they should not compete with live fixes.

8. Singer-source choices should collapse into a single prep lane.
   `Prep Inbox` should show the best pending singer picks first, or the best queue matches when no review is needed.
   `Queue Options` and the fuller singer-submission list should stay available, but as secondary panels under that main prep path.

9. Performer and song fields should read like guided setup support, not generic forms.
   `Singer Setup` should explain whether the slot already has a singer and what the next move is.
   `Song Setup` should explain whether title/artist are ready for track search, so the host sees field purpose before raw inputs.

10. Resolved support sections should collapse by default.
   Once singer, song, or track confirmation is already satisfied, those sections should fold into compact summaries.
   The host can reopen them instantly, but the default view should keep the unresolved step visually dominant.

11. Alternate track suggestions should also collapse after a good pick is in place.
   Once a usable track is selected, the grid of alternate picks should fold under a compact `Track Picks` section.
   Keep it easy to reopen, but stop making the host scan multiple strong options when one already works.

12. Performance prep should behave like a true stepper.
   `Singer`, `Song`, and `Track` should act as one guided sequence with one visible prep step at a time.
   Completed steps should collapse into compact step chips, and opening one step should demote the others.

13. Policy and editor controls should sit behind one secondary surface during live prep.
   Slot-level rules, advanced performer fields, extra singer lists, and scene settings should live under a single `More Slot Controls` panel.
   The host should not encounter those tools unless they deliberately opt into deeper editing.

- make queue/backing issue resolution subordinate to active run of show
- route live fixes through one exception drawer

## Non-Goals

This spec does not remove:

- run-of-show templates
- advanced automation behavior
- room moment planning
- detailed curator/media tooling

It only changes when and where those tools are exposed.
