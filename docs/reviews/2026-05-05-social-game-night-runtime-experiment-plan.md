# Social Game Night Runtime Experiment Plan

Date: May 5, 2026

Audience: CEO, Product, Design, Engineering

## Decision

We should move forward with a new experimental runtime shell using the `Social Game Night` visual family as the parent direction.

This is not a rewrite.
This is a layered experiment over the existing host runtime, Public TV, and audience flows.

## Why This Direction

The visual exploration suggests `Social Game Night` is the best fit because it:

- feels more like karaoke and less like production software
- keeps the room socially legible
- supports crowd energy without turning the app into a toy
- matches the product's existing warmth better than the more formal directions
- still leaves room for a strong operational host surface

The goal is not to make everything playful.
The goal is to make the system feel like one coordinated room experience.

## Product Thesis

The runtime should feel like:

- the `Host` is guiding the room
- the `Public TV` is telling the room what is happening
- the `Audience App` is letting the crowd participate at the right moments

All three surfaces should stay synchronized across three core states:

1. `Live Performance`
2. `Post-Song Wrap`
3. `Next-Up Transition`

## Non-Negotiable Rules

- The experiment must preserve the current operational model in the repo.
- The new host shell must sit on top of existing handlers and state.
- `Queue`, `Add`, `Inbox`, and `Planner` remain available as depth surfaces.
- The current performer remains the dominant live object on the host surface.
- The radial menu remains performance-scoped, not room-scoped.
- Playback and transport remain visually separate in a lower dock.
- Room-wide toggles like `Ready Check` and `Auto DJ` stay outside the performer ring.
- The audience mobile surface is crowd-facing, not singer-admin or host-admin.
- Public TV must have a true karaoke performance mode, not just transition slides.

## What Each Surface Must Do

### Host Console

Primary job:

- run the live performance
- handle wrap-up
- prepare the next moment
- manage rotation and curated inserts without scanning five different panels

Must visibly group:

- `Current Performer`
- `Next Performer`
- `Rotation Lane`
- `Candidate Scenes / Crowd Moments`
- `Inbox / Attention`
- `Room Controls`
- `Playback Dock`

Hero interaction:

- contextual radial ring around the current performance

Good ring actions:

- `End Song`
- `Applause`
- `Track Check`
- `Return`
- `Bonus`
- `Details`

Actions that stay outside the ring:

- `Ready Check`
- `Auto DJ`
- queue rules
- `Pop Trivia`
- room launch / TV controls

### Public TV

Primary job:

- make the room feel the active moment
- support karaoke performance clearly during the song
- celebrate the singer after the song
- make `Up Next` obvious at the right time

Must have three distinct visual states:

- lyrics / performance
- applause / recap
- next-up reveal

### Audience App

Primary job:

- give the crowd one clear way to participate in each state
- keep interaction lightweight and mobile-native
- reinforce room energy, not expose host operations

Examples by state:

- `Live Performance`: cheer, react, vote, support
- `Post-Song Wrap`: recap, favorite, standout reaction, applause
- `Next-Up Transition`: react to next singer, vote on crowd moment, support next beat

## Real Repo Anchors

The experiment should explicitly build on the current host architecture:

- [HostQueueTab.jsx](/abs/path/c:/Users/beauj/Desktop/beaurocks-karaoke/src/apps/Host/components/HostQueueTab.jsx:1) remains the runtime integration point
- [StageNowPlayingPanel.jsx](/abs/path/c:/Users/beauj/Desktop/beaurocks-karaoke/src/apps/Host/components/StageNowPlayingPanel.jsx:1) is the clearest current source of performance-scoped actions and transport separation
- [QueueListPanel.jsx](/abs/path/c:/Users/beauj/Desktop/beaurocks-karaoke/src/apps/Host/components/QueueListPanel.jsx:1) already owns queue rules, automation controls, and queue shaping helpers
- [HostTopChrome.jsx](/abs/path/c:/Users/beauj/Desktop/beaurocks-karaoke/src/apps/Host/components/HostTopChrome.jsx:1) remains the home for room-wide controls
- [HostInboxPanel.jsx](/abs/path/c:/Users/beauj/Desktop/beaurocks-karaoke/src/apps/Host/components/HostInboxPanel.jsx:1) remains the escalation surface for moderation and co-host activity
- [hostUiPrefs.js](/abs/path/c:/Users/beauj/Desktop/beaurocks-karaoke/src/apps/Host/lib/hostUiPrefs.js:1) is the first place to hang the experimental shell preference

Current repo features that must remain represented in the new shell:

- `Queue`, `Add`, `Inbox`, `Planner`
- `Launch Room`
- `Track Check`
- applause
- `Fill Next Slot`
- `Auto DJ`
- `Ready Check`
- queue rotation / request limits / first-time boost
- scene or media moments
- inbox-driven collaboration and moderation

Audience and cross-surface primitives already present in the repo that must also stay supported:

- audience shell variants in [audienceShellVariant.js](/abs/path/c:/Users/beauj/Desktop/beaurocks-karaoke/src/apps/Mobile/audienceShellVariant.js:1)
- applause and reaction-driven audience states in [qaAudienceFixtures.js](/abs/path/c:/Users/beauj/Desktop/beaurocks-karaoke/src/apps/Mobile/qaAudienceFixtures.js:1)
- crowd-vote and co-host-vote release windows in [runOfShowDirector.js](/abs/path/c:/Users/beauj/Desktop/beaurocks-karaoke/src/lib/runOfShowDirector.js:1)
- moderation and direct-message escalation in [HostInboxPanel.jsx](/abs/path/c:/Users/beauj/Desktop/beaurocks-karaoke/src/apps/Host/components/HostInboxPanel.jsx:1)

## Coverage Guardrail

The main design risk is not missing inspiration.
It is accidentally optimizing only for the hosted-room operator while dropping crowd-led behavior that already exists.

The experiment must therefore pass a simple test:

- do not carry the entire kitchen sink into the center of the screen
- do not delete or orphan real room capabilities that matter to live flow

The right way to do that is to separate:

- `primary runtime eye-line`
- `secondary but reachable controls`
- `mode-specific behaviors`

The host should not see every control at once.
The system still has to support them.

## Core Functionality Retention Matrix

These capabilities must survive the redesign even if they move out of the central eye-line.

### Always In The Main Runtime Eye-Line

- current performer
- end / wrap / applause actions
- next performer
- playback state and transport
- track readiness or blockers for the next live object
- queue / rotation context
- immediate attention count

### Reachable Within One Interaction

- `Queue`, `Add`, `Inbox`, `Planner`
- `Ready Check`
- `Auto DJ`
- queue rules
- `Fill Next Slot`
- scene and moment selection
- track check follow-up
- host bonus and standout actions

### Preserved As Deeper Or Mode-Specific Workflows

- moderation queues
- co-host direct messages
- crowd-vote release windows
- co-host-vote release windows
- trivia and WYR overlays
- audience access / event-credit behaviors
- room launch / TV / overlay controls
- run-of-show governance and release policy details

If a capability lands in this third bucket, that is acceptable.
If it becomes hard to discover or impossible to trigger in live ops, that is not acceptable.

## Runtime Mode Architecture

The design has to support more than one room style.
We should not force one surface to pretend all nights work the same way.

The right model is one shared runtime system with different emphasis modes.

### 1. Host-Led Mode

Best for:

- venue nights
- branded events
- rooms with an active MC or KJ

Operating model:

- host owns what is live now
- host confirms or shapes what is next
- crowd participates through applause, reactions, and invited votes

UI consequence:

- host shell is primary
- audience app is mostly reactive between explicit vote moments

### 2. Co-Host / Collaborative Mode

Best for:

- busier rooms
- producer + operator teamwork
- rooms where one person handles stage while another handles queue or scenes

Operating model:

- primary host still owns the live performance
- co-hosts help shape next-up and vote-driven decisions
- moderation and DMs stay in inbox-oriented workflows

UI consequence:

- same host shell
- stronger attention and inbox pathways
- vote windows can be targeted to co-hosts instead of the full room

### 3. Audience-Led Mode

Best for:

- house parties
- couch karaoke
- low-friction self-running rooms
- nights where fairness or crowd energy matters more than curation

Operating model:

- the room largely advances itself
- the audience can help decide what should go next
- host presence can be minimal or absent
- system leans more on `crowd_vote`, rotation logic, and lightweight automation

UI consequence:

- host shell becomes optional or supervisory
- Public TV and Audience App carry more of the room narrative
- next-up decisions can be surfaced as crowd prompts at the right transition moments

Important constraint:

- do not interrupt a live performance with a new room-wide vote overlay unless the product already intentionally supports that flow
- default vote moments should remain aligned to transition windows, not mid-song clutter

### 4. Curated Showcase Mode

Best for:

- structured events
- sponsor or scene-heavy nights
- nights paced from a planned sequence

Operating model:

- host or producer promotes from pool and planned scenes
- queue fairness still matters, but momentum and composition matter more
- run-of-show and release-window logic play a bigger role

UI consequence:

- same shell family
- stronger candidate-pool and planner emphasis

## Extensibility Rule

We should not build separate products for each mode.
We should build one runtime language with configurable emphasis.

That means:

- same core state model
- same three cross-surface states
- same visual family
- different control emphasis depending on room mode

Good extensibility targets:

- `hostLed`
- `collaborative`
- `audienceLed`
- `curatedShowcase`

These do not need to be fully exposed as user-facing presets on day one.
They do need to exist in the architecture so we are not painting ourselves into a host-only corner.

## Experiment Scope

### In Scope for Phase 1

- new host runtime shell behind an experiment toggle
- `Social Game Night` visual system
- synchronized state thinking across `Host`, `Public TV`, and `Audience App`
- current-performer radial ring
- separate playback dock
- stronger grouping of current, next, rotation, and candidate objects
- visual refinement of Public TV runtime states
- visual refinement of Audience App participation states
- architecture that does not block future `audienceLed` or `collaborative` runtime emphasis modes

### Out of Scope for Phase 1

- replacing core queue logic
- replacing run-of-show logic
- syncing host preferences across accounts by default
- inventing a second queue or second live-state model
- removing classic host surfaces
- over-customizable skins or theme editors
- solving every audience-led flow in the first host-shell implementation

## Design Deliverables

We should move from broad exploration into a disciplined design package.

### Deliverable 1: Host Runtime Spec Board

One polished board that locks:

- host grouping
- radial menu placement and behavior
- playback dock placement
- top-chrome vs live-object separation
- runtime density rules

It should show:

- `Live Performance`
- `Post-Song Wrap`
- `Next-Up Transition`

### Deliverable 2: Public TV Runtime Board

One polished board that locks:

- lyric-performance mode
- applause / recap mode
- next-up mode
- scene-takeover language if relevant

### Deliverable 3: Audience App Runtime Board

One polished board that locks:

- mobile proportions
- one primary action per state
- reaction / voting behavior
- how much room context appears without clutter

### Deliverable 4: Cross-Surface Storyboard

One storyboard showing the same performer and song through:

1. live performance
2. song ending
3. applause / recap
4. next-up handoff

This should prove that all surfaces tell one coherent story.

## UX / IA Requirements

### Host Grouping Model

The host shell should be organized around six zones:

1. `Current Performance Core`
2. `Next-Up / Prep`
3. `Rotation Lane`
4. `Candidate Pool`
5. `Attention / Inbox`
6. `Transport + Room Controls`

### Visual Hierarchy

- one dominant live object at a time
- only one ring-centered object at a time
- supporting modules should feel adjacent, not competitive
- risk should live on the object that owns it
- avoid floating summary bars and generic KPI cards

### Audience App Simplicity Rule

The mobile surface should not try to expose everything.

The right model is:

- one main performer card
- one primary action cluster
- one secondary context panel

That simplicity rule changes by mode emphasis, but not by visual clutter budget:

- in `hostLed`, mobile is mostly support and reaction
- in `audienceLed`, mobile carries more vote and next-up influence
- in both cases it should still feel lightweight and obvious

### Public TV Simplicity Rule

Public TV should never read like software.
It should read like the room's shared stage language.

## Customization Strategy

We should support host flexibility without blowing up the product model.

### Host-Level Shell Preferences

Good candidates:

- runtime shell mode
- radial open behavior
- radial action density
- candidate-pool expanded vs compact
- rotation-lane compact vs full
- transport dock collapsed vs persistent

### Room-Level Policy Stays Separate

These should remain room settings, not shell prefs:

- `Ready Check`
- `Auto DJ`
- `Auto End`
- request limits
- queue rotation mode
- first-time boost
- moderation / approval policy

### Room Mode Presets

This is the better place to support broader behavioral variation.

Good future presets:

- `Host-Led Venue`
- `Collaborative Booth`
- `Audience-Led Party`
- `Curated Showcase`

Those presets can tune:

- surface emphasis
- vote eligibility
- release-window behavior
- automation defaults
- whether host confirmation is required for next-up decisions

## Build Plan

### Phase 0: Design Lock

Goal:

- stop broad exploration
- choose one visual parent direction and one grouping model

Outputs:

- approved `Social Game Night` runtime family
- approved host grouping model
- approved state sync rules across surfaces
- approved mode architecture for `hostLed`, `collaborative`, `audienceLed`, and `curatedShowcase`

### Phase 1: Experimental Shell Foundation

Goal:

- introduce a safe runtime shell experiment path

Implementation shape:

- extend `hostUiPrefs` with an experimental shell mode
- default remains `classic`
- branch the render path inside the host runtime without removing the current one

Suggested values:

- `classic`
- `social_game_night_experiment`

The first experiment toggle is visual / structural.
It should not hard-code the product to host-led assumptions that block later mode emphasis.

### Phase 2: Derived Runtime View Model

Goal:

- compute one cleaner runtime model for the new shell without replacing source state

Target objects:

- `currentPerformance`
- `nextPerformance`
- `rotationFlow`
- `candidatePool`
- `inboxAttention`
- `trackCheckState`
- `roomAutomationState`

Target mode signal:

- `runtimeModeEmphasis`

Suggested initial values:

- `hostLed`
- `collaborative`
- `audienceLed`
- `curatedShowcase`

This model should be derived from the existing queue, stage, inbox, and room state in `HostQueueTab`, not persisted as a new system.

### Phase 3: Host Shell UI

Goal:

- build the new host surface over current behaviors

Suggested new components:

- `HostRuntimeShellExperimental.jsx`
- `HostPerformerRing.jsx`
- `HostPlaybackDock.jsx`
- `HostRotationLane.jsx`
- `HostCandidatePool.jsx`
- `hostRuntimeShellModel.js`

Phase 3 rule:

- bind ring actions to existing handlers first

### Phase 4: Public TV State Refresh

Goal:

- align Public TV visuals with the host shell's live-state model

Focus:

- true karaoke performance state
- cleaner applause / recap
- clearer next-up reveal

This should follow the same state model already approved in the design boards.

### Phase 5: Audience App State Refresh

Goal:

- turn the phone into a clean crowd companion

Focus:

- one primary action per state
- mobile-native layout
- clear live / wrap / next-up transitions
- ability to scale up to audience-led vote moments without turning the phone into admin software

### Phase 6: Preferences and Presets

Goal:

- add limited flexibility without destabilizing rollout

Potential presets:

- `House Party`
- `Venue Rotation`
- `Curated Showcase`
- `Audience-Led`

These can come after the shell is already working.

## Validation Plan

We should validate the experiment in layers.

### Design Validation

- CEO review on visual distinctiveness
- product review on hierarchy and host comprehension
- host walkthroughs using the three runtime states
- mode walkthroughs for `hostLed` and `audienceLed`

### Functional Validation

- confirm ring actions map cleanly to existing handlers
- confirm host can still reach `Queue`, `Add`, `Inbox`, `Planner`
- confirm automation and room controls remain discoverable
- confirm crowd-vote and co-host-vote paths still have a coherent home
- confirm hostless or low-host room operation is not blocked by the new model

### Live-Ops Validation

- test busy-night host scanning behavior
- test post-song wrap speed
- test next-up preparation speed
- test whether crowd participation on mobile feels additive rather than noisy
- test whether audience-led next-up decisions can happen without a visible host bottleneck

## Success Criteria

The experiment is successful if:

- hosts can identify the current and next live objects faster
- hosts can end, wrap, and advance performances with less panel-scanning
- Public TV feels more like a show and less like a utility screen
- Audience App participation is obvious but lightweight
- the runtime feels visually distinctive without sacrificing operational control
- the architecture still supports hosted nights, co-hosted nights, and audience-led nights without a second redesign

## Immediate Next Steps

1. Lock the `Social Game Night` visual system as the current design parent.
2. Produce the final refined spec boards for `Host`, `Public TV`, and `Audience App`.
3. Approve the host grouping model and ring action set.
4. Add the experimental shell mode in `hostUiPrefs`.
5. Scaffold the host shell behind the experiment toggle.
6. Implement the host shell first, then align Public TV, then Audience App.

## Recommendation

Proceed with a phased experiment, not a rewrite.

Use `Social Game Night` as the visual parent.
Use the current-performer ring as the signature host interaction.
Keep the visual fidelity high, but keep the first implementation bounded to existing runtime primitives and real live-ops needs.
