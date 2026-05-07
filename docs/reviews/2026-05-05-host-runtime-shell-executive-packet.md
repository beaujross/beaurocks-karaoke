# Host Runtime Shell Executive Packet

Date: May 5, 2026

Audience: CEO, CTO, Chief Product Officer, Chief Marketing Officer

## Topic

We reviewed the proposed next-generation host runtime shell built around:

- a visually stronger live host surface
- a contextual radial menu centered on the current performer
- a separated playback/transport dock
- a hybrid of `Rotation Engine` and `Curated Show Engine`
- reuse of existing host product primitives rather than a full replacement

The question is not whether to rewrite the host app.
The question is whether to introduce a new runtime shell that makes the current host product feel more intentional, more memorable, and easier to run live.

## Current Product Reality

The current host experience already has the core ingredients:

- `Queue`, `Add`, `Inbox`, and `Planner` workspaces
- current-performance transport and applause controls
- post-song `Track Check`
- queue review and queue-to-show helpers like `Fill Next Slot`
- `Auto DJ`, `Ready Check`, queue rules, and room controls
- scene library / moments / planned media beats
- co-host and moderation workflows routed into `Inbox`

The issue is not missing capability.
The issue is that the live runtime experience still feels like a collection of operational surfaces rather than one strong host instrument.

## Proposed Product Shape

The recommended shell is:

- current performer as the visual center
- a prominent radial menu around that performer
- a separate playback dock below for transport and source controls
- a rotation-aware live flow showing current and next singers
- a curated pool of performers and scenes the host can promote into the night
- existing deeper tools preserved behind `Queue`, `Add`, `Inbox`, and `Planner`

Key rule:

- the radial menu is performance-scoped, not room-scoped

That means it should do things to the current performance:

- end song
- start applause
- return to queue
- open track check
- add host bonus
- mark standout
- open source / lyric details

It should not become a home for room-wide toggles like:

- `Ready Check`
- `Auto DJ`
- queue rotation
- host approval
- TV mode

Those remain in top chrome, drawers, or room controls.

## Executive Input

### CTO

CTO read:

- This is viable if it is implemented as a new shell over existing handlers, not as a second runtime system.
- The repo already has strong operational primitives in `HostQueueTab`, `StageNowPlayingPanel`, `QueueListPanel`, and `HostTopChrome`.
- The radial menu will only help if it calls existing actions first and stays tightly scoped to the selected performance.
- Host-level customization is desirable, but it must be clearly separated from room-wide behavior and queue policy.

CTO recommendation:

- approve an experimental shell mode, not a rewrite
- add one derived runtime model for `onStage`, `next`, `candidatePool`, `trackCheckState`, and `inboxAttention`
- keep room-wide controls in top chrome
- use `hostUiPrefs` plus local storage for host-specific shell preferences
- keep `Queue`, `Add`, `Inbox`, and `Planner` as escape hatches during rollout

### Chief Product Officer

CPO read:

- The new shell is compelling because it changes the host's core act from scanning panels to operating a live object.
- The strongest product choice here is the separation of concerns:
  - performer ring for performance actions
  - playback dock for transport
  - top chrome for room policy
  - queue/planner for depth
- The hybrid of `Rotation Engine` and `Curated Show Engine` is directionally right because it supports both fairness and momentum.
- Customization matters, but the product must not become visually chaotic or endlessly configurable.

CPO recommendation:

- approve the contextual performer ring as the signature interaction
- keep the radial menu shallow and intuitive
- start with one object of focus: the current performer
- let hosts choose shell emphasis and density, but do not let customization blur the product model
- preserve strong visual fidelity; this should feel like a premium host instrument, not a settings-heavy admin layer

### Chief Marketing Officer

CMO read:

- This is the first host concept in the exploration that feels ownable and marketable, not just operational.
- The visual identity of a performer-centered ring has strong demo value because it makes the host look like they are running a show, not browsing software.
- The separation of playback dock from live performer actions helps the concept read clearly in screenshots, demos, and stage photography.
- The hybrid of rotation and curation is useful commercially because it can speak to both home/social rooms and hosted/venue rooms.

CMO recommendation:

- approve the performer ring as a brandable signature control pattern
- maintain premium fidelity and theatrical confidence in the implementation
- keep room-wide controls out of the ring so the hero interaction stays clear
- message this as a better way to run the room live, not as a technical refactor

## Alignment

The three executive perspectives are aligned on the main point:

- this should be a new runtime shell over existing host capabilities
- the current performer should become the primary live object
- the radial menu should stay contextual to that performance
- playback controls should remain visually separate
- room-wide toggles should stay outside the ring
- host customization should exist, but with clear boundaries

There is one deliberate constraint:

- do not attempt a full host-surface replacement in the first pass

## CEO Brief

Recommendation for CEO approval:

1. Approve an experimental next-generation host runtime shell built on top of current host functionality.
2. Approve the contextual performer ring as the primary interaction concept.
3. Approve the product rule that room-wide controls stay outside the performer ring.
4. Approve a hybrid runtime model that combines:
   - rotation awareness
   - curated candidate promotion
5. Approve limited host customization for shell behavior and visual density without changing room policy by default.

Why this is the right call:

- It creates a differentiated host experience without discarding proven host logic.
- It is visually distinctive and demo-worthy.
- It respects the current app's real operational primitives.
- It improves host clarity while preserving fallback access to existing tools.
- It gives us a path to ship something premium without taking rewrite risk.

## Proposed CEO Decision

Approve:

- experimental host runtime shell
- performer-centered contextual radial menu
- separate playback dock
- hybrid rotation + curation live model
- host-level shell customization with clear boundaries

Hold for later review:

- whether the new shell should become the default host experience
- whether host-specific preferences should sync across rooms/accounts by default

## Implementation Guardrails

The approved implementation should follow these guardrails:

- no second queue system
- no second run-of-show system
- no replacement of existing callbacks in the first pass
- no stuffing room-wide toggles into the performer ring
- no removal of `Queue`, `Add`, `Inbox`, or `Planner` during the experiment

## Recommended Build Sequence

### Phase 1: Shell Foundation

- add a new experimental runtime shell mode via host UI preferences
- keep `classic` as the default
- branch render paths inside the host runtime without replacing core logic

### Phase 2: Derived Runtime Model

- compute one shared runtime view model for:
  - `onStage`
  - `next`
  - `rotationFlow`
  - `candidatePool`
  - `trackCheckState`
  - `inboxAttention`
  - `automationState`

### Phase 3: Performer Ring

- build the radial menu around the current performer
- wire it to existing performance-scoped actions first:
  - end song
  - applause
  - return to queue
  - track check
  - bonus
  - source details

### Phase 4: Playback Dock

- preserve transport and playback controls as a dedicated lower dock
- keep source state and playback interaction separate from the contextual ring

### Phase 5: Rotation + Curation Layout

- add a visible next/rotation lane
- add a candidate pool for singers and scenes
- support promotion from pool into the live flow using current queue/show helpers

### Phase 6: Customization

- support host-specific shell preferences such as:
  - ring open behavior
  - shell mode emphasis
  - density
  - candidate-pool expansion
  - radial action preset
- keep room defaults separate from host-only shell preferences

## Product Boundary Model

### Performer Ring

Owns:

- current performance actions
- performance wrap-up
- performance evaluation

### Playback Dock

Owns:

- transport
- source state
- media interaction

### Top Chrome / Room Controls

Owns:

- `Launch Room`
- `Ready Check`
- `Auto DJ`
- queue policy
- host approval
- TV and overlay controls

### Queue / Add / Inbox / Planner

Own:

- depth workflows
- approvals
- moderation
- co-host notes
- scene planning
- queue editing

## Success Criteria

The experiment is successful if:

- hosts can run a live performance from the new shell without losing access to current tools
- the performer ring feels intuitive on first use
- the new shell improves perceived clarity more than it increases cognitive load
- the concept retains the visual confidence established in the mockup
- the shell can support both small-group rotation and hosted curation without becoming muddled

## Next Product Action

If approved, implementation should be scoped as:

- add an experimental host shell mode
- build a performer-scoped radial menu over existing performance callbacks
- keep playback dock and room controls separate
- introduce a rotation-plus-candidate-pool runtime layout
- add limited host-specific shell customization
- validate with side-by-side usage against the current host runtime before any default switch
