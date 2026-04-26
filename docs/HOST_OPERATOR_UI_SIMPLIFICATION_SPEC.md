# Host Operator UI Simplification Spec

Last updated: 2026-04-26
Owner: Product / Host surface

## 2026-04-26 Event Hardening Notes

These decisions are now part of the May 1 event posture:

- `Queue` is the live operating cockpit.
- `Show` / Run Of Show is the planner and conveyor, not a second live-control brain.
- `Room Readiness` should not consume queue-column vertical space. It belongs in top chrome as a compact status plus launch control.
- Avoid hidden `More -> show one extra action` patterns in the live lane. If a control matters live, it should be direct.
- Performance-slot editing should present one ordered path:
  - performer
  - song
  - track
- Supporting inputs like submissions and queue matches should appear as `Suggested Matches`, not as competing top-level setup modes.
- Public join flows coming from a known event should behave like direct room entry, not force users back through generic code-entry UX.
- For the May 1 event, the persistent production room is `AAHF`. Discovery, poster QR, and `/join/AAHF` should all converge on the same audience-entry path.

Not in scope before May 1:

- co-host role expansion
- new admin shells
- broad new audio-library architecture
- any second scheduling primitive beyond `Performance`, `Moment`, and `Scene`

## Goal

Keep the host in flow during a live show.

The host UI should optimize for:

- `0` host actions for most requests
- `1` host action for uncertain requests
- explicit host feedback only when a track was bad, risky, or brand new

During live operation, host-triggered audio should behave like a game-console moment layer:

- tiny number of safe, intent-driven triggers
- no raw asset browsing in the main lane
- planned cues belong in run of show

This spec assumes the backing-selection product model already documented in `AUDIENCE_BACKING_SELECTION_SPEC.md`.

Companion docs:

- `AUDIENCE_BACKING_SELECTION_SPEC.md`
- `RUN_OF_SHOW_LOW_INTERACTION_SPEC.md`
- `HOST_CONSOLE_MOMENT_AUDIO_SPEC.md`
- `RUN_OF_SHOW_LOW_INTERACTION_SPEC.md`

## 2026-04-24 Room Readiness Direction

The current setup simplification target is not only fewer clicks. It is less uncertainty.

Problem statement:

> The host setup flow must clearly communicate when the room is ready, what has already been configured, and what still requires action before guests can join and the show can run.

Product rules:

- Treat setup as `Room Readiness`, not as a tour through settings.
- The queue page should show one readiness surface before the live queue when a room is active.
- `Launch Room` should be the atomic action for the common path: apply setup, open Public TV, and copy the guest link.
- `Night Setup` should open the simplified setup modal for focused changes.
- Full admin/settings remains available, but it should be an escape hatch rather than the main launch path.
- Run-of-show generation should inherit setup context, including automation style and dead-air behavior.
- Dead-air automation should use known-good browse catalog songs, with Autopilot able to create `Dead-Air Bridge` moments in generated show plans.

Current implementation anchors:

- `src/apps/Host/components/HostRoomReadinessPanel.jsx`
- `src/apps/Host/components/setup/MissionSetupAutopilotPreview.jsx`
- `src/apps/Host/deadAirAutopilot.js`
- `src/apps/Host/runOfShowAutopilot.js`
- `src/apps/Host/components/RunOfShowDirectorPanel.jsx`

Interaction budget for room launch:

- returning host with defaults: `1` action from readiness
- review generated setup then launch: `2` actions
- change one major setting then launch: `3` actions
- deep admin tuning: explicitly secondary

## 2026-04-16 Run Of Show Admin Notes

The admin-side run-of-show surface now follows three explicit phases inside `src/apps/Host/components/RunOfShowDirectorPanel.jsx`:

1. `Build`
   - timeline editing
   - scene inspector
   - repair queue shown inline when issues exist

2. `Preflight`
   - launch readiness summary
   - one repair queue for approvals, critical blockers, and risky items
   - slot assignment lives here, not in the build lane

3. `Run`
   - live HUD and next/later state
   - low-frequency controls sit behind `More Controls`

Applied simplification decisions:

- separate `review` mode was removed from the run-of-show admin flow
- pending approvals, critical blockers, and risky items now share one `Repair Queue`
- `Slot Assignment` moved out of `Build` and into `Preflight`
- live-only controls such as `Show Later` and `Clear Preview` are hidden until `More Controls` is opened

QA surfaces that assume this phase model:

- `scripts/qa/host-run-of-show-console-playwright.mjs`
- `scripts/qa/host-run-of-show-hostapp-playwright.mjs`
- `tests/unit/runOfShowDirector.test.mjs`
- `tests/integration/runOfShowActions.test.cjs`
- `tests/integration/runOfShowSlotSubmissions.test.cjs`

If the run-of-show labels or phase boundaries change again, update those checks in the same pass.

## Core Principle

The host should almost never be asked to curate while trying to run the room.

Split host work into three distinct modes:

1. `Run Show`
   - manage the active performance
   - scan the queue
   - make the next obvious decision quickly

2. `Pick Track`
   - choose the best backing for one unresolved request
   - accept one candidate or reject it and look at the next one

3. `Curate Library`
   - inspect quality/history
   - tune room preferences
   - do power-user cleanup and sharing

Do not mix all three modes inside the same card.

## Runtime Anchor

The queue page remains the host's primary operational home.

That means:

- the queue-page run-of-show strip is the primary live HUD
- the show workspace is the deeper drill-down
- queue and show must not evolve into two competing runtime systems

The live host should be able to stay in one place most of the night:

- queue page for active operation
- show workspace only when fixing something or changing the plan

## Interaction Budget

Target host interaction budget per request:

- known good match: `0` actions
- uncertain but usable match: `1` action
- bad outcome or edge case: `1` extra action after the song

If a normal request requires:

- pre-queue approval
- backing review
- post-song rating
- manual curation

then the system is too manual.

## Product Rules

### 1. Pre-Queue Decision

For unresolved requests, the host should primarily answer one question:

`Should I use this track for this request right now?`

Primary review actions:

- `Use This`
- `Pick Another`

Advanced actions should not compete with those controls in the live review card.

### 2. Post-Performance Learning

Positive feedback should be inferred whenever possible.

System should automatically learn from:

- host chose `Use This`
- song completed normally
- no replacement / no abort / no obvious playback problem

Explicit host feedback should be reserved for:

- `Use Again`
- `Bad Track`

Do not prompt for every successful song.

### 3. Diagnostics Language

Use one plain-language trust system across host surfaces:

- `Recommended`
- `Check First`
- `Avoid`

Support text should explain the meaning in operational terms:

- `Recommended`
  - this has worked before
- `Check First`
  - mixed or limited history
- `Avoid`
  - multiple rooms had trouble with this track

Avoid exposing ranking jargon like:

- global suppression
- confidence score
- review candidate score
- approval state

Those can remain available in Curator / diagnostics views.

## Layout Modes

Define layout by operator task and viewport width.

### Wide Desktop

Suggested target: `>= 1440px`

Use a two-column operational layout:

- left: queue + unresolved requests
- right: current stage controls / now playing

Allow inline diagnostics only for the selected review item.

### Laptop / Small Desktop

Suggested target: `1100px - 1439px`

Use a single primary pane with one secondary drawer.

- default primary pane: queue + stage
- review/search opens in a right-side drawer or takeover panel
- do not force queue and rich search results to compete side-by-side

This is the main problem case reported already and should be treated as the default optimization target.

The queue-page run-of-show HUD is especially important here because it avoids forcing the host into a second workspace during live operation.

### Compact / Tablet-Like Host View

Suggested target: `< 1100px`

Use one active workflow at a time:

- queue view
- track picker drawer
- current song controls

Review/search should open as a full-height sheet or takeover panel.

Do not render dense inline review cards inside the main queue in this mode.

## Queue UI

### Queue Row Anatomy

Collapsed queue row should show only:

- singer
- song title
- one source/trust chip
- one main action if needed

Optional second line:

- short supporting text only when the row is active, selected, or needs intervention

Do not show by default:

- multiple status chips
- long diagnostics copy
- score numbers
- several peer action buttons

### Queue Status Hierarchy

Visible status should collapse into one of:

- `Ready`
- `Needs Track`
- `Needs Host Check`
- `Playing`
- `Queued for Later`

Internal resolution state can remain richer in code.

### Queue Runtime HUD

When run of show is enabled, the queue page should expose one compact runtime HUD:

- one status chip
- one one-line summary
- one primary action
- one drill-down action: `Show Workspace`
- optional timeline strip
- low-frequency controls hidden behind `More`

Shared status words across queue HUD and show workspace:

- `Ready to start`
- `Running smoothly`
- `Needs attention`

Shared primary action language:

- `Go Live Check`
- `Start Show`
- `Resume`
- `Fix Issue`
- `Advance`

If those words differ between surfaces, the host experience will drift back into two systems.

Low-frequency runtime controls should not sit as peer buttons beside the primary CTA. Put them behind `More`:

- `Collapse Timeline` / `Expand Timeline`
- `Previous`
- `Stop Show`

### Queue Review Card

The live review card for unresolved requests should use:

- primary: `Use This`
- secondary: `Pick Another`
- optional tertiary menu: `More`

`More` can contain:

- `Save for This Room`
- `Open in Curator`
- `Share as Trusted`

Those advanced controls should not be visible by default on every review row.

### Candidate List

Each candidate row should show:

- title + artist
- one trust chip: `Recommended`, `Check First`, or `Avoid`
- one short support line
- one primary action: `Use This`

Optional controls only after expansion:

- `Why this status`
- `More actions`

## Search / Autocomplete UI

### Operational Rule

Search is a focused task, not a background panel.

When the host enters `Pick Track`, search results should take over the area needed to make that decision clearly.

Do not permanently squeeze search previews beside the queue on narrow or medium-width layouts.

### Result Row

Default result row should show:

- thumbnail
- title + artist
- one trust chip
- one main action

Hide by default:

- raw score
- long reason text
- full diagnostics history

Use tap/expand to reveal more.

## Stage UI

Stage panel should stay operational, not diagnostic-heavy.

It should show:

- current song
- next up
- transport controls

## Current Friction Audit

The biggest remaining sources of host friction are:

1. `Build Show` is still visually heavy.
   The live path is cleaner than the editor path.

2. Queue and run-of-show still overlap around performance prep.
   This is better than before but not fully collapsed.
   Next state: performance slots should lead with one `Slot Prep` card and one next-step action, with queue/approval/backing sections demoted underneath.
   `Slot Prep` should summarize the overall state once, the `Singer / Song / Track` stepper should orient, and the open step should carry the detailed explanation.
   Inside `Track`, the default path should stay short: current track, one main action, and optional alternates. Source overrides should stay collapsed unless that slot actually needs them, and the fallback path should open as one surface instead of nested panels.
   Repair headers should stay terse. Once the host is in repair mode, the slot itself should carry the visual weight, not another explainer banner.
   Secondary explainers, duplicate status chips, and submission-rule controls should stay quieter still, especially in repair mode.
   Generic scene metadata like title, automation, visibility, timing, and notes should sit below prep in a lower-priority `Scene Settings` panel.
   The left rail should also collapse in repair mode so it reads as a compact status summary, not a second builder surface.

3. Top chrome density remains high.
   The host still has a lot of neighboring controls competing for attention.
   When the queue-page run-of-show HUD is present, adjacent host-guide messaging should get out of the way instead of stacking another live explainer above it.
   Live room cues should use a tiny `Moments` strip in the queue lane instead of pushing the host back to a full soundboard or another quick-menu cluster.
   When a cue fires, the shell should confirm it with one compact banner instead of another toast-only path or a second dashboard.

5. The queue panel should act like the stage companion, not a separate dashboard.
   Lead with one next-action summary.
   Use plain section labels like `Needs Review`, `Ready To Run`, and `Tied To Show`.
   Do not spend space on empty-state subsections when the live queue already tells the story.
   On tighter viewports, collapse `Add to Queue` by default once live queue work exists so execution wins over creation.

4. `Fix Issue` is not narrow enough yet.
   It still sometimes opens a broad workspace instead of the smallest useful repair flow.
   Next state: use a temporary repair mode that hides builder scaffolding and keeps the host on one scene until they explicitly choose `Open Full Builder`.

5. Curator/admin behaviors still leak into operational surfaces in subtle ways.
   That is much better than before, but the separation is not complete.
- simple guest-picked track check when needed

6. Track picking still needs one dominant path in performance slots.
   `Track Setup` should lead with the current track, one main browse action, and the best few picks.
   `Track Check` should only handle final confirmation, while `Track Details` stays collapsed until the host needs an exception path.

7. Singer prep should use one inbox, not multiple competing panels.
   The host should first see a single `Prep Inbox` with the best pending singer picks or queue matches.
   Deeper `Queue Options` and the full singer-submission list should remain secondary so slot prep still feels like one path.

8. Support forms should explain readiness before showing inputs.
   `Singer Setup` and `Song Setup` should each lead with a short status summary and the one next move they support.
   Raw inputs still matter, but they should no longer look like unlabeled editor fields dropped into the prep path.

9. Solved setup steps should stop occupying full vertical space.
   `Singer Setup`, `Song Setup`, and `Track Check` should collapse once they are already satisfied, unless the host is actively editing them.
   That keeps the unresolved step at the center of the inspector instead of burying it below finished sections.

10. Alternate choices should become optional once a good answer exists.
   After a workable track is selected, the alternate match grid should collapse into a compact `Track Picks` section.
   This preserves flexibility without forcing the host to visually re-evaluate solved choices.

11. Prep should feel like one sequence, not stacked accordions.
   `Singer`, `Song`, and `Track` should present as step chips with one active step expanded at a time.
   That keeps the host focused on the next unresolved action instead of scanning a full stack of semi-related setup panels.

12. Advanced editing should be grouped, not sprinkled through prep.
   During live slot prep, policy/admin controls should collapse behind one `More Slot Controls` entry point.
   This keeps the main prep surface centered on the stepper while still preserving every advanced capability.

Post-song prompt should be lightweight:

- `Use Again`
- `Bad Track`
- `Dismiss`

Only show this prompt when:

- the track was new to the room
- the track was guest-picked and unverified
- the track had caution status
- playback had trouble

Do not show it after every successful known-good song.

## Curation UI

Curator should own the detailed quality view.

That includes:

- room-vs-global evidence
- last success room
- last avoid room
- health/trust explanation
- explicit save/share tools

Curator can remain rich because it is not the live operational surface.

## Visibility Rules

### Always Visible In Live Mode

- current song
- next song
- queue length
- unresolved request count
- one primary action per actionable row

### Hidden Until Expanded

- detailed diagnostics
- multi-room evidence
- alternate candidate list beyond the top item
- curator-level actions

### Hidden From Live Queue Entirely

- raw scoring math
- track IDs / internal source labels
- full trust history

## Automation Rules

To reduce host interaction without losing functionality:

1. Auto-resolve strong matches
   - room favorite
   - room-proven
   - globally approved with high confidence

2. Auto-learn from successful use
   - if host picked `Use This` and the song completed cleanly, boost room confidence automatically

3. Reserve prompts for uncertainty
   - only ask for explicit track feedback on low-confidence or problematic tracks

4. Treat negative feedback as the high-value explicit signal
   - hosts should not need to repeatedly confirm obvious good tracks

## Accessibility / Readability Requirements

Given existing feedback about queue/search readability at small resolutions:

- increase spacing before adding more metadata
- prefer fewer rows with clearer hierarchy over dense information packing
- use larger action targets in live host mode
- keep one prominent accent color for the next action
- avoid rows with more than one primary-looking button
- allow the selected review row to expand while keeping the rest collapsed

## Implementation Direction

### Phase A

- simplify live review card to `Use This` + `Pick Another`
- move advanced curation actions behind `More`
- reduce visible candidate metadata to one trust chip + one support line

### Phase B

- make laptop layout open track review/search in a drawer or takeover panel
- collapse queue rows by default
- keep current song / next song sticky

### Phase C

- gate post-song prompts so they only appear for new/risky/problematic tracks
- infer positive learning automatically from clean completion

### Phase D

- keep full diagnostics and sharing tools in Curator only
- remove remaining live-surface duplicates that compete with queue operation

## Non-Goals

This spec does not change:

- the underlying backing policy model
- room/global trust storage strategy
- audience search behavior
- existing power-user curator functionality

It only changes how much of that power is exposed in the live host operating surface.

## Related Constraint

If run of show is active, this spec should be interpreted alongside `RUN_OF_SHOW_LOW_INTERACTION_SPEC.md`.

That document defines:

- what disappears from the UI once the show starts
- how queue/backing decisions yield to run-of-show ownership
- how low-interaction runtime behavior should work block-by-block
