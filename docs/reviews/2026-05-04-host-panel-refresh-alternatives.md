# Host Panel Refresh Alternatives

Date: May 4, 2026

Audience: Chief Product Officer, Chief Technology Officer

## Prompt

The current host queue surface may not primarily need a stronger queue concept.
It may need a stronger information architecture.

The right question is:

> What does the host actually need to see while running a busy karaoke night?

This document pressure-tests the current `Hopper` proposal and explores alternative host-panel shapes before we commit to implementation.

## Current Surface Read

The current live host experience already contains many useful pieces, but too many of them are visible as peers:

- `StageNowPlayingPanel`
  - current performer
  - transport
  - up next summary
  - backing feedback
- `HostLiveOpsPanel`
  - `On Stage`
  - `Next Singer`
  - `Planned`
- `RunOfShowQueueHud`
  - `Now`
  - `Next`
  - `Then`
  - status line
  - planner controls
- `QueueListPanel`
  - queue summary bar
  - queue controls
  - `Ready To Run`
  - `Awaiting Approval`
  - `Tied To Show`
  - `Held`
- workspace tabs
  - `Live Queue`
  - `Add`
  - `Inbox`
  - `Planner`

The product smell is not that any one of these is wrong.
It is that multiple widgets are trying to answer the same live questions:

- who is on stage?
- who or what is next?
- is the room blocked?
- what should I do now?

## CPO Read

The host should not be required to synthesize six adjacent summaries into one mental model.

The live host panel should optimize for:

- spotlight protection
- next-action clarity
- low-glance comprehension
- low-friction recovery when something breaks

The host does not need a broad dashboard during live performance.
The host needs one trustworthy operating strip with clear escalation paths.

CPO concern with the current direction:

- a stronger hopper is promising, but it can still become another summary layer if it sits beside the old ones
- if we keep `Stage`, `Live Snapshot`, `Queue Bar`, and `Hopper`, we have not simplified the host job
- the product may need a true refresh of what is visible by default, not just a better top card

## CTO Read

The current codebase already has enough primitives to support a host refresh without major architecture change.

The problem is primarily:

- visibility hierarchy
- duplicated summaries
- mode confusion

not missing data.

CTO concern with the current direction:

- if we implement a new `hopperModel` but keep all existing runtime surfaces visible, we add one more decision layer
- we should first decide the runtime information budget, then decide which helpers/components survive
- any refresh should prefer subtractive UI and derived state reuse over new persisted concepts

## What The Host Actually Needs To See

This is the strict live-runtime information budget.

### Always Visible

These are the only things that deserve permanent live visibility:

1. `Now`
   - performer or active scene
   - source/playback state
2. `Next`
   - the next committed thing
   - whether it is playable
3. `State`
   - the condition of `Next`
   - ready, review, fallback, or broken
4. `Action`
   - one primary next action

### Usually Visible

These should be available close by, but not permanently expanded:

- one short queue count summary
- one short inbox/attention count
- one short planner/horizon state
- applause / recap / end-song actions

### Hidden Until Asked For

These should not compete with live operation by default:

- queue rules
- automation toggles
- full queue chips
- assigned / held subsections
- deep planner controls
- detailed moderation/chat activity
- raw soundboard browsing

## Design Principle

The host should see:

- one live truth
- one next truth
- one visible state on the next committed item
- one action

Everything else should be secondary or contextual.

## Alternative Directions

## Option A: Hopper-First Console

This is the refined version of the prior proposal.

### Shape

One dominant `Live Hopper` at the top of the host queue page:

- `Now`
- `Next`
- `Then`
- one status line
- one repair lane
- one primary action

The existing `StageNowPlayingPanel` collapses into the `Now` slot.
`HostLiveOpsPanel` disappears as a separate widget.
`RunOfShowQueueHud` becomes the canonical live strip.

### What The Host Sees

- current performer or scene
- next committed item
- third item in horizon
- whether `Next` is playable
- one fallback if not

### Product Strengths

- strong mental model
- best fit for queue plus run-of-show unification
- supports crowd/co-host shaping of future positions
- protects the live sequence well

### Product Risks

- still somewhat abstract for hosts who think in singer rotation rather than planned horizon
- can over-index on planning language if not simplified aggressively
- third slot may be valuable for the system but not always for the host

### CTO Read

Best fit if we want to reuse current run-of-show and queue primitives.

### CPO Read

Good if we truly replace adjacent widgets, not if we add it beside them.

## Option B: Stage-First Console

This is a simpler and less conceptual alternative.

### Shape

Make the host panel explicitly about stage operation, not sequence planning.

Top surface:

- `On Stage`
- `Up Next`
- `After That`

This reads less like a planner and more like a live stage board.

### What The Host Sees

- one large `On Stage` block
- one strong `Up Next` card
- issue state attached directly to `Up Next` when something is broken
- one smaller `After That` preview

The queue remains visible below as feeder inventory.
Run of show becomes background support.

### Product Strengths

- lowest cognitive load
- most legible for traditional karaoke hosts
- easiest bridge from current host habits
- preserves spotlight and immediate handoff focus

### Product Risks

- weaker unification with planned scenes and run-of-show moments
- may continue to privilege singers over all other room beats
- less elegant if we want future nights to be more show-structured

### CTO Read

Simplest to implement because it mostly reorganizes existing stage and queue surfaces.

### CPO Read

Best if the product thesis is still fundamentally karaoke-host-first, with show planning as support.

## Option C: Exception-First Console

This alternative assumes the host mostly does nothing until the system needs help.

### Shape

Default live shell shows:

- `Now`
- `Next`
- `Room Healthy`

When something breaks, the third slot becomes:

- `Fix This`

The UI only expands when there is an exception.

### What The Host Sees

Healthy room:

- current performer
- next playable item
- quiet status

Unhealthy room:

- current performer
- next at risk
- one repair card with direct action

### Product Strengths

- strongest hands-off posture
- least visual noise
- emphasizes intervention only when needed

### Product Risks

- can feel too sparse for hosts who want confidence about later flow
- hides future planning until late
- may underserve co-host/crowd guidance moments

### CTO Read

Good if paired with strong derived issue detection and fallback ranking.

### CPO Read

Attractive for operational clarity, but only if the system's automation quality is high enough.

## Option D: Producer / Operator Split

This is the most radical option.

### Shape

Separate the host experience into two explicit live modes:

- `Operator`
  - stage, next, fix, advance
- `Producer`
  - queue shaping, run-of-show shaping, crowd guidance

The host can stay in `Operator` most of the night.
Co-hosts or producers can work in `Producer`.

### Product Strengths

- clean role boundary
- scales well for larger events
- preserves a very calm operator screen

### Product Risks

- highest product and implementation complexity
- easy to create two competing control systems
- does not match current repo simplification direction

### CTO Read

Not recommended for near-term implementation.

### CPO Read

Potential long-term event product direction, but too heavy for current needs.

## Recommended Decision Matrix

### Best for near-term simplification

- `Option B: Stage-First Console`

Why:

- it most directly answers what the host needs to see
- it minimizes conceptual overhead
- it gives us a real UI refresh, not just a better queue abstraction

### Best for long-term product coherence

- `Option A: Hopper-First Console`

Why:

- it best unifies performances, scenes, and crowd-guided flow
- it fits the existing run-of-show trajectory
- it gives the product a stronger canonical model

### Best for hands-off automation posture

- `Option C: Exception-First Console`

Why:

- it most cleanly reduces visual noise
- it forces the product to become trustworthy instead of verbose

## Hybrid Recommendation

The strongest answer is likely a hybrid of `Option B` and `Option C`, with some `Option A` structure behind the scenes.

### Recommended UX Shape

Visible runtime shell:

- `On Stage`
- `Up Next`
- `Fix This` or `After That`
- one primary action

Underlying logic model:

- still derive `Now / Next / Then`
- still treat queue and run of show as one operational horizon
- but do not expose all three equally unless the host benefits from seeing them

This means:

- use hopper logic internally
- present stage-first language externally

That is probably the best answer to your concern.

It refreshes the host panel without forcing the host to think like a planner.

## Concrete Visibility Changes

Regardless of which option we choose, these changes look correct:

### Remove As Default-Persistent Live Elements

- standalone `HostLiveOpsPanel`
- separate queue summary bar when a stronger live header exists
- full `Queue Controls` panel from default live view
- always-visible planner tab emphasis

### Keep But Demote

- queue rules
- automation toggles
- assigned and held sections
- planner detail actions
- soundboard browsing

### Strengthen

- current performer block
- next playable item block
- direct fallback action
- inline issue state on the owned card
- post-performance advancement / recap flow

## Implementation Approaches

## Approach 1: Subtractive Refresh

Goal:

- improve the host panel mostly by removing and merging surfaces

Actions:

- merge `StageNowPlayingPanel` and `HostLiveOpsPanel`
- collapse planner/live snapshot duplication
- move queue controls into a `Live Settings` drawer
- keep current queue list structure with lighter relabeling

Pros:

- fastest path
- lowest risk

Cons:

- less transformative

## Approach 2: New Live Header + Existing Body

Goal:

- add one strong new runtime header, but leave most queue body structure intact

Actions:

- introduce one canonical live header
- demote legacy summary widgets
- preserve existing queue sections and tabs below

Pros:

- good balance of change and safety

Cons:

- can still feel layered if we do not remove enough

## Approach 3: Full Runtime IA Refresh

Goal:

- redesign the runtime queue tab around one dominant live shell and one secondary body

Actions:

- define runtime information budget first
- rebuild the queue page around that budget
- make all secondary functions drawer-, tab-, or intent-based

Pros:

- clearest product outcome

Cons:

- highest design and regression risk

## Recommendation

Recommend:

1. Choose the `Stage-First Console` as the visible UX language.
2. Use hopper-style horizon logic internally.
3. Put readiness, fallback, and breakage state on `Up Next` or `After That`, not in a separate strip.
4. Implement via `Approach 2` first.
5. If the result still feels too layered, continue to `Approach 3`.

This gives us:

- a real host-panel refresh
- lower cognitive load
- a clean answer to what the host actually needs to see
- continued compatibility with queue/run-of-show unification

## Next Design Questions

Before implementation, answer these explicitly:

1. Does the host truly need to see a third future slot all the time?
2. Should planned scenes and singer performances use the same live label language?
3. Is `Queue` the right primary noun, or should the live tab become `Stage` or `Live`?
4. Should queue rules and automation leave the main queue page entirely during active runtime?
5. Does the host need one inbox badge, or separate co-host/moderation/chat visibility live?

## Bottom Line

The right next step is probably not:

- `make the queue smarter`

The better next step is:

- `make the host screen quieter and more honest about what matters`

That means deciding what the host must always see, then cutting the rest out of the live eye-line.
