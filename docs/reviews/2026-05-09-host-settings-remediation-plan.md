# Host Settings Remediation Plan

Date: 2026-05-09
Status: Revised for host mental-load reduction

## Purpose

This plan turns the settings audit into an execution roadmap aligned across:

- `CTO`
- `CPO`
- `Chief Marketing Officer`
- `UX Designer`

It builds on:

- `docs/host-admin-audit.md`
- `docs/reviews/2026-05-09-host-settings-ownership-model.md`
- `docs/reviews/2026-05-09-host-settings-systems-migration-plan.md`
- `docs/reviews/2026-05-09-host-settings-gap-register.md`
- `docs/reviews/2026-05-09-host-settings-executive-signoff-scorecard.md`
- `docs/reviews/2026-05-09-host-settings-accessibility-acceptance-criteria.md`
- `docs/reviews/2026-05-09-host-settings-monetization-downgrade-model.md`
- `docs/reviews/2026-05-09-host-settings-audit-trail-model.md`
- `docs/TURNKEY_ONBOARDING_MONETIZATION_PLAN.md`

## Core Revision

The earlier plan improved ownership and IA, but it still assumed the host could keep too many concepts separate:

- `room` vs `host` vs `organization`
- defaults vs live state
- queue rules vs automation rules vs show-plan rules
- scene library vs media library vs sponsor assets

That is too much for a live operator.

The revised principle is:

- the system should understand scope
- the host should mostly understand intent

Most host workflows should reduce to three jobs:

1. `Set up tonight`
2. `Run the room live`
3. `Save what worked`

The storage model can stay sophisticated. The host-facing model should not.

## Target Ownership Model

The system should still move to this canonical scope model:

1. `Organization`
   - billing
   - roles
   - entitlements
   - branding kits
   - sponsor kits
   - scene and audio packs
   - room templates

2. `Host`
   - personal defaults
   - operating preferences
   - favorite assets
   - preferred branding and support defaults

3. `Room`
   - tonight's rules
   - tonight's runtime state
   - active show plan
   - active sponsor treatment
   - tonight-only media

But scope should be explicit to the host mainly at save/share time, not at every edit point.

## Host Cognitive Load Strategy

### Design rules

1. Hosts choose outcomes, not raw field bundles.
   - Example: `Tighter moderation tonight` is better than making the host tune five related toggles separately.

2. Hosts should not have to pick a scope before making a normal change.
   - Apply the change to tonight first.
   - Offer save options afterward when appropriate.

3. High-frequency controls should be grouped by live job.
   - Example: crowd-facing controls belong together even if they touch chat, marquee, scoring, and trivia.

4. Setup should be guided.
   - Most hosts should not need to hunt across multiple settings areas before the room is ready.

5. Advanced options should be present but secondary.
   - Recipes first, overrides second, edge-case controls last.

6. The product should summarize behavior in plain language.
   - Hosts should be able to read what the room will do without decoding implementation details.

### Anti-goals

Do not make hosts:

- reason about inheritance chains during normal setup
- manually keep related toggles in sync
- decide between `room`, `host`, and `workspace` before they even know whether the change works
- browse seven equal-weight admin areas before a standard launch

## Persona Alignment

### CTO

Primary objective:

- enforce one canonical contract and one precedence model

Non-negotiables:

- every persisted setting has one owner
- every live control has one execution surface
- adapters and compatibility reads exist before major IA migration
- shared libraries become first-class scoped entities

Success criteria:

- reduced direct multi-surface room writes
- scoped helpers instead of ad hoc room-key mutations
- lower coupling in `HostApp.jsx` and related runtime surfaces

### CPO

Primary objective:

- reduce the number of decisions a host has to make before becoming show-ready

Non-negotiables:

- hosts always know `now` vs `next time`
- high-frequency tasks are faster
- setup flows are intent-driven, not backend-driven

Success criteria:

- fewer steps to first show-ready room
- fewer surfaces visited during setup
- lower confusion around crowd controls, automation, and overlays

### Chief Marketing Officer

Primary objective:

- make branding, sponsor kits, and shared templates reusable without adding operator burden

Non-negotiables:

- premium capabilities must feel curated, not like loose engineering switches
- sponsor and branding flows must be fast to activate
- onboarding must communicate leverage, not complexity

Success criteria:

- reusable workspace kits
- sponsor activation that is demo-able and sellable
- clearer packaging of shared-value features

### UX Designer

Primary objective:

- make the product legible under live-show pressure

Non-negotiables:

- progressive disclosure
- clear setup vs live boundary
- clear grouping by operator task
- visible summaries and source cues

Success criteria:

- fewer concepts held at once
- reduced visual density
- better scan paths
- fewer cases where scope ownership must be understood explicitly

## Host-Facing Interaction Model

The host-facing product should center on three entry points:

1. `Tonight`
   - guided setup
   - room preset or template choice
   - tonight's key decisions

2. `Live`
   - queue
   - show
   - crowd controls
   - scenes and recovery

3. `Library / Workspace`
   - reusable assets
   - sponsor kits
   - branding kits
   - operators and billing

This is cleaner than exposing raw categories like policy, automation, and presentation as equal first-class starting points.

## Setup Model

### Primary setup flow

The default setup experience should be a guided flow, not tab browsing.

Recommended sequence:

1. `Pick tonight's format`
   - open karaoke
   - competition
   - trivia/social
   - festival/sponsored
   - run-of-show showcase

2. `Pick tonight's operating style`
   - low-touch autopilot
   - balanced host assist
   - tightly moderated
   - curated showcase

3. `Pick the crowd experience`
   - crowd chat
   - scoring
   - trivia and hype moments
   - marquee and presentation mode

4. `Pick brand and money options`
   - brand kit
   - sponsor kit
   - tips
   - event credits

5. `Review tonight`
   - plain-language summary
   - advanced exceptions drawer

### Setup outputs

The review screen should say things like:

- `Audience chat will stay off TV by default`
- `Scoring is on for tonight`
- `Queue is limited to two songs per singer`
- `Run of show will guide moments between performances`

The host should not need to infer room behavior from scattered toggles.

## Revised Admin IA

Admin should become secondary infrastructure for defaults, templates, and advanced setup.

The top-level host-facing groups should be:

1. `Tonight`
   - tonight's rules
   - tonight's automation defaults
   - tonight's TV and audience defaults
   - review summary

2. `Brand + Money`
   - tips
   - event credits
   - sponsor activation
   - room brand selection

3. `Library`
   - scenes
   - background tracks
   - uploads
   - reusable packs

4. `Workspace`
   - operators
   - billing
   - entitlements
   - shared kits
   - templates

5. `Recovery`
   - smoke tests
   - diagnostics
   - recovery tools

Inside those groups, advanced drawers can still expose lower-level domains like automation policy, audience access, or TV presentation. The host should not start there.

## Revised Live IA

Top Chrome should contain only live controls grouped by live job:

1. `Flow`
   - start next
   - ready check
   - approval mode
   - queue policy shortcuts
   - automation pause/resume

2. `Crowd`
   - chat on TV
   - marquee
   - scoring
   - pop trivia
   - hype moments

3. `Look`
   - scene launch
   - previews
   - SFX
   - visual effects

4. `Recover`
   - playback retry
   - emergency fallback
   - diagnostics shortcuts

This deliberately differs from the storage model. It is optimized for recall under pressure.

## Save Behavior

Scope should become explicit mainly at save time.

Recommended pattern:

1. host changes something
2. system applies it to tonight
3. optional save actions appear:
   - `Keep for tonight only`
   - `Save as my default`
   - `Save to workspace template`

This removes a major source of branching during setup and runtime.

## Defaults, Recipes, and Templates

The product should rely more on:

- recipes
- presets
- templates
- recommended defaults

And less on:

- long toggle lists
- one-field-at-a-time setup
- early scope decisions

Recommended recipe families:

- `Open Karaoke Night`
- `Competition Night`
- `Festival / Sponsored Event`
- `Low-Touch Autopilot`
- `Run of Show Showcase`

Each recipe should set multiple underlying behaviors at once, with only important exceptions exposed up front.

## Data Model Plan

### Organization

Introduce or formalize:

- `organizations/{orgId}/settings/defaults`
- `organizations/{orgId}/brandingKits/{kitId}`
- `organizations/{orgId}/sponsorKits/{kitId}`
- `organizations/{orgId}/sceneTemplates/{templateId}`
- `organizations/{orgId}/audioPacks/{packId}`
- `organizations/{orgId}/roomTemplates/{templateId}`

### Host

Introduce:

- `users/{uid}/hostDefaults`
- `users/{uid}/hostPrefs`
- `users/{uid}/favoriteAssets`

### Room

Keep runtime and event-specific state on:

- `rooms/{roomCode}`
- `room_uploads`
- `room_scene_presets`
- room-scoped working libraries only when truly tonight-specific

## Migration Principle

Do not do a big-bang rewrite.

Use this order:

1. define semantics and precedence
2. reduce decision burden in the host-facing model
3. move write surfaces
4. migrate storage
5. remove legacy fields last

## Delivery Plan

### Phase 0: contract and decision inventory

Goal:

- freeze the ownership model and count host decisions before code migration

Deliverables:

- canonical settings matrix
- approved glossary
- producer/consumer map
- setup-decision inventory:
  - required
  - optional
  - advanced-only
  - machine-defaulted

Exit criteria:

- every setting has scope owner, UI owner, storage owner, migration action
- every setup decision is classified as required, optional, or advanced
- at least one candidate bundle is proposed for every cluster of repeated decisions

Current supporting artifacts:

- `docs/reviews/2026-05-09-host-settings-glossary.md`
- `docs/reviews/2026-05-09-host-settings-qa-scenario-matrix.md`
- `docs/reviews/2026-05-09-host-settings-support-troubleshooting-map.md`
- `docs/reviews/2026-05-09-host-settings-onboarding-copy-map.md`

### Phase 1: duplicate reduction and bundle design

Goal:

- remove the worst duplication and replace repeated micro-decisions with higher-level bundles

Actions:

- eliminate the worst duplicate owner surfaces
- label `Default` vs `Live` clearly
- convert repeated toggle clusters into recipe-first controls
- keep individual overrides in advanced drawers

Priority slice:

1. `chatShowOnTv`
2. `popTriviaEnabled`
3. `showScoring`
4. `marqueeEnabled`
5. `autoPlayMedia`

Exit criteria:

- each top duplicated setting appears in one owner surface plus at most one shortcut
- hosts can activate common crowd modes from grouped controls instead of four separate toggles

### Phase 2: guided setup and review layer

Goal:

- make `Tonight` the primary setup surface

Actions:

- build guided setup
- build plain-language review summary
- build advanced exceptions drawer
- move low-level settings out of the default setup path

Exit criteria:

- most standard room launches can be completed from the `Tonight` flow plus review
- hosts do not need to visit multiple peer admin tabs for a normal launch

### Phase 3: host and organization layer introduction

Goal:

- create real host-personal and organization-shared layers without forcing hosts to think about them constantly

Actions:

- add host defaults documents
- add org shared settings documents
- define precedence:
  - global defaults
  - organization defaults
  - host defaults
  - room overrides
  - runtime overrides
- expose scope mostly through explicit save actions

Exit criteria:

- new rooms can inherit from org and host defaults
- room changes do not silently mutate host or organization source records
- mixed old/new records still render correctly

### Phase 4: library architecture cleanup

Goal:

- make library systems reusable and mentally manageable

Actions:

- define `workspace library` vs `host favorites` vs `tonight's library`
- keep tonight-only uploads clearly separate
- make sponsor kits and scene templates reusable
- layer background tracks:
  - built-ins
  - workspace packs
  - tonight uploads
- default browsing should prioritize `Recommended` and `Recently used`

Exit criteria:

- reusable items and tonight-only items are visually distinct
- library source is visible but not the primary thing the host must decide first

### Phase 5: packaging and onboarding

Goal:

- make the new model visible in onboarding and premium packaging

Actions:

- align capability packages to real product areas
- make first-run setup follow:
  - workspace
  - host defaults
  - room template
  - tonight setup
- position shared assets and sponsor tooling as leverage, not complexity

Exit criteria:

- onboarding matches the real architecture
- premium features map cleanly to reusable kits, templates, and workspace controls

## Workstreams

### Workstream A: settings contract

Output:

- canonical matrix
- precedence rules
- compatibility adapters

### Workstream B: host-first IA

Output:

- `Tonight / Live / Library-Workspace` model
- guided setup flow
- review summary model
- `Keep tonight / Save as default / Save to workspace` save pattern

### Workstream C: data model and migration

Output:

- host defaults
- organization defaults
- inheritance helpers
- migration-safe fallback reads

### Workstream D: libraries and sponsor systems

Output:

- shared library model
- sponsor kit model
- source attribution and reusable-vs-tonight rules

### Workstream E: onboarding and commercialization

Output:

- feature packaging alignment
- workspace onboarding path
- premium capability framing

### Workstream F: governance, permissions, and recovery

Output:

- role and surface permissions matrix
- save provenance model
- undo and recovery rules
- executive signoff packet per major slice
- rollout telemetry and rollback checkpoints

Reference artifacts:

- `docs/reviews/2026-05-09-host-settings-undo-recovery-model.md`
- `docs/reviews/2026-05-09-host-settings-rollout-telemetry-runbook.md`

## Decision Framework

Use this order when placing a setting:

1. What job is the host trying to do?
   - `set up tonight`
   - `run live`
   - `save or share a pattern`

2. Does it change the live room right now?
   - If yes, it belongs in a runtime surface.

3. Is it specific to tonight's event?
   - If yes, it is room-scoped.

4. Should it follow one host across rooms?
   - If yes, it is host-scoped.

5. Should it be shared across hosts or venues?
   - If yes, it is organization-scoped.

6. Is it reusable content rather than a simple setting?
   - If yes, model it as a library or template object, not a raw room field.

## Risks

### Product risks

- moving too much at once may confuse existing hosts
- hiding controls before summaries and shortcuts are strong enough may reduce trust
- simplifying labels without simplifying behavior will fail

### Engineering risks

- mixed old/new data can create fallback bugs
- `HostApp.jsx` remains a bottleneck unless paired with domain extraction
- the runtime contract can drift if adapters are skipped

### UX risks

- if scope complexity is merely renamed instead of absorbed, mental load will not improve
- if bundled controls are too opaque, advanced hosts may feel loss of control

### Revenue risks

- if shared assets remain implicit, premium workspace value stays hard to package

## Success Metrics

### Product

- settings duplication drops by at least `50%`
- setup requires fewer surfaces
- first show-ready room time decreases
- decision count before a standard room launch decreases materially
- fewer standard launches require advanced settings

### Engineering

- fewer direct multi-surface room writes
- more settings resolved through scoped helpers
- lower orchestration burden in `HostApp.jsx`

### UX

- fewer live controls touched in common scenarios
- more hosts complete setup from `Tonight` plus review
- fewer moments where scope ownership must be taught explicitly

### Commercial

- workspace features become demo-able
- sponsor and branding kits become packageable
- onboarding completion improves

## Recommended Sequence

1. Phase 0: contract and decision inventory
2. Phase 1: duplicate reduction and bundle design
3. Phase 2: guided setup and review layer
4. Phase 3: host and organization layer introduction
5. Phase 4: library architecture cleanup
6. Phase 5: packaging and onboarding alignment

Before broad rollout, require explicit closure on:

- permissions by role and surface
- save provenance and inheritance visibility
- undo/recovery behavior
- rollout telemetry and rollback readiness
- accessibility and comprehension acceptance criteria

## Immediate Next Step

Create the canonical settings matrix and the setup-decision inventory together.

The matrix will show where settings belong.
The decision inventory will show which of those settings the host should never have to think about directly.
