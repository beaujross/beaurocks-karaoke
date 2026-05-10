# Host Settings Systems Migration Plan

Date: 2026-05-09
Owner lens: CTO, CPO, Chief Marketing Officer, UX Designer
Status: Deep-dive follow-on to the ownership and remediation reviews

## Executive conclusion

This is not just an admin IA cleanup.

It is a room-state contract migration across:

1. state producers
2. state editors
3. runtime orchestrators
4. TV and audience consumers
5. backend write allowlists
6. room-scoped content libraries

The main risk is not that a toggle moves from one menu to another. The main risk is that the same behavioral field is currently:

- provisioned at room creation time
- embedded in night preset payloads
- re-emitted by mission setup flows
- read by runtime orchestration
- consumed by TV and audience rendering
- patched directly by host actions

Because of that, a clean migration must treat settings as a governed system contract, not a UI reorganization exercise.

## What has to stay true

The migration should preserve four hard truths:

1. `room` is still the runtime authority for tonight.
2. `runOfShow` is a runtime sequencing system, not a substitute for a settings model.
3. `missionControl.setupDraft` is a setup seed, not a second permanent configuration store.
4. `host` and `organization` can add defaults and reusable assets, but they cannot make runtime ownership ambiguous.

## System map

### Primary state producers

These systems generate or reshape room settings before the host ever clicks a live control.

| Producer | Current role | Migration implication |
| --- | --- | --- |
| `functions/index.js` `provisionHostRoom` | creates room defaults, host library, discovery listing, preset-derived room state | provisioning must migrate to a canonical config builder first |
| `functions/index.js` preset normalization helpers | inject preset settings into room payloads | preset schema becomes part of the contract surface |
| `src/apps/Host/hostNightPresets.js` | built-in preset definitions | built-in presets must target canonical config domains, not raw scattered room keys |
| `src/apps/Host/missionControl.js` | builds setup draft from room and compiles setup draft back into room payload | this is currently a second producer of many room fields |
| `src/apps/Host/roomEventProfiles.js` | applies event profiles and experience presets | event profile behavior must be layered into the same builder pipeline |

### Primary direct editors

These systems let the host or the UI patch room state directly.

| Editor | Current role | Migration implication |
| --- | --- | --- |
| `functions/index.js` `updateRoomAsHost` | host-authorized patch gateway with allowlisted room keys | allowlists become the enforcement point for the new model |
| `src/apps/Host/HostApp.jsx` | admin tabs and setup flows | admin should become defaults and setup only |
| `src/apps/Host/components/HostTopChrome.jsx` | fast live toggles and runtime controls | top chrome should become runtime-only |
| contextual panels such as overlays, queue, run of show | feature-local live control points | each panel must only edit fields that belong to its runtime responsibility |

### Runtime orchestrators and derived systems

These systems do not merely display settings. They derive behavior from them.

| System | Current dependency shape | Migration implication |
| --- | --- | --- |
| `src/apps/Host/roomFlowOrchestrator.js` | depends on `runOfShowEnabled`, `programMode`, `missionControl.autoMoment`, queue readiness, party config, dead-air config | any schema change here can alter room ownership and automation behavior |
| `src/apps/Host/runOfShowAutopilot.js` | seeds show generation from `missionControl.setupDraft` and maps assist levels into automation behavior | setup defaults and runtime automation are currently tightly coupled |
| `src/apps/Host/lib/hostRuntimeShellModel.js` | derives attention model from room state, run of show, release windows, moderation, queue, scenes, host prefs | UI simplification depends on preserving stable derived semantics |
| `src/lib/runOfShowDirector.js` | normalizes and governs run-of-show state and policies | run-of-show policy fields must remain stable during migration |

### Downstream consumers

These systems render or act on the resulting room state.

| Consumer | Current dependency shape | Migration implication |
| --- | --- | --- |
| `src/apps/TV/PublicTV.jsx` | consumes room presentation, overlays, chat, scoring, pop trivia, queue, sponsor, and run-of-show state | TV regression risk is high because many toggles resolve here |
| audience app flows | consume access policy, branding, sponsor/event credit posture, request policy | audience experience must inherit the same canonical defaults consistently |
| storage-backed room libraries | hold logos, scene media, background tracks, presets | content scope changes require durable asset ownership rules |

## The run-of-show dependency problem

`runOfShow` has become streamlined, but it is also now deeply interdependent with general room settings.

That interdependence shows up in five ways:

1. `missionControl.setupDraft` seeds show generation.
2. `runOfShowAutopilot` translates setup intent into automation characteristics.
3. `roomFlowOrchestrator` decides whether `runOfShow`, queue logic, or dead-air recovery currently owns the room.
4. queue surfaces can assign songs into open run-of-show slots.
5. `PublicTV` renders live and preview show states, overlays, release windows, and show-specific moments.

The architectural conclusion is:

- `runOfShow` should own show plan, sequencing, slot readiness, release windows, and show-only policies.
- `room` should still own cross-cutting runtime policies such as queue behavior, audience access posture, TV overlay defaults, and sponsor activation.
- `missionControl.setupDraft` should only produce a canonical room defaults payload plus an optional run-of-show seed payload.

If that boundary is not enforced, the team will keep reintroducing duplicated controls because setup, show planning, and runtime each appear to be legitimate edit points for the same field.

## Interdependency clusters

### 1. Setup and preset cluster

Fields like `autoDj`, `autoPlayMedia`, `showScoring`, `chatShowOnTv`, `popTriviaEnabled`, and `queueSettings` currently appear in:

- provision-time defaults
- built-in night presets
- custom preset configs
- mission setup compile output
- admin controls
- top chrome or feature-local live controls

This means the team does not yet have one authoritative definition of:

- what the field means
- what layer owns its default
- what layer may override it live
- whether the override is persistent or temporary

### 2. Runtime control cluster

There is a real difference between:

- a saved default
- tonight's room policy
- a temporary live override

Today, those states are blurred together in room documents. That is acceptable for a single-room prototype, but it becomes brittle when adding:

- multiple hosts
- organization templates
- sponsor packages
- event-specific scene kits
- room templates

### 3. Presentation and sponsor cluster

Branding, media scenes, sponsor treatments, orb skins, background tracks, and event-credit moments are partly room-scoped today. Some of them clearly want organization-level reuse. Some are truly one-night assets.

The missing distinction is:

- reusable asset library
- room assignment
- live activation

Without that distinction, sponsors and branded experiences will remain operationally expensive and error-prone.

### 4. Security and callable cluster

`updateRoomAsHost` and related backend allowlists are the actual data-governance boundary.

If the schema changes in the frontend before the callable contract changes cleanly, the system will drift in one of two bad directions:

1. frontend writes silently stop working
2. backend allowlists become wider and less defensible

The CTO-safe approach is to migrate through compatibility adapters instead of widening raw write access casually.

## Canonical model to enforce

### Organization

Organization should own:

- billing and role membership
- entitlements and packaging
- shared branding kits
- sponsor kits
- reusable scene templates
- reusable background-track packs
- room templates
- event presets shared across hosts

Organization should not own:

- tonight's queue behavior
- live runtime toggles
- current show execution state

### Host

Host should own:

- personal operator preferences
- preferred default branding selections
- preferred tip and support defaults
- preferred runtime shell presentation defaults
- preferred default setup profile

Host should not own:

- active room state for another host
- sponsor inventory that belongs to the organization
- shared team templates unless explicitly copied or inherited

### Room

Room should own:

- tonight's rules
- tonight's runtime posture
- queue and request policy
- active presentation state
- active sponsor activation
- active show plan instance
- one-night media attachments
- temporary live overrides

Room should not pretend to be:

- a reusable host profile
- an organization-wide asset library
- a long-term template repository

## Scientific migration method

### Phase 0: establish the contract

Build a canonical settings matrix before moving any UI.

For every setting, define:

- canonical key
- semantic description
- owner scope: `organization`, `host`, `room`, `run_of_show_item`, or `runtime_ephemeral`
- default source
- live override source
- persistent storage location
- producer systems
- consumer systems
- whether it is monetizable, branded, safety-sensitive, or runtime-critical

Deliverable:

- one canonical matrix checked into docs and referenced by engineering and design

### Phase 1: separate domains from raw room keys

Introduce a normalized config layer in code, even if persistence still lands in `room` at first.

Suggested domains:

- `roomPolicy`
- `runtimeAutomation`
- `audienceAccess`
- `tvPresentation`
- `supportEconomy`
- `brandingSelection`
- `activeSponsorExperience`
- `libraryBindings`
- `runOfShowPolicy`

This can start as adapter functions, not a datastore rewrite.

Rule:

- no new product surface should bind directly to a random room key if a canonical domain accessor exists

### Phase 2: create compatibility adapters

Before any visible IA migration, create translation functions for:

- provisioning payload -> canonical config
- preset config -> canonical config
- mission setup draft -> canonical config
- canonical config -> legacy room payload
- legacy room payload -> canonical config

This is the scientific control layer. It lets the team compare old and new interpretations of the same room.

### Phase 3: shadow-read, then dual-write

Roll out the new model in compatibility mode:

1. read legacy room state
2. build canonical model
3. render new admin/runtime surfaces from canonical model
4. write both canonical representation and legacy-compatible room fields
5. log divergence when the two representations disagree

This should be gated behind feature flags or cohort targeting.

### Phase 4: move surfaces by responsibility

Only after the compatibility layer is stable:

- move saved defaults into `Admin`
- keep live tactical controls in top chrome
- keep feature-local overrides inside the feature surface
- keep show-plan editing inside run-of-show tooling

The UX Designer requirement here is consistency:

- every control must communicate whether it is changing a default, tonight's room policy, or a temporary live state

### Phase 5: introduce host and organization persistence

Once domain adapters are proven, move the right data up-scope:

- host defaults out of room docs
- organization libraries and templates out of room-scoped collections
- sponsor kits out of ad hoc room fields where appropriate

Important constraint:

- scope migration should happen after semantic stabilization, not before

### Phase 6: cut over and remove duplicates

Only remove legacy fields and duplicate surfaces after:

- canonical adapters are passing
- telemetry shows low divergence
- host workflows are validated in production-like sessions

## Non-negotiable invariants

These should become explicit tests and rollout gates.

### Runtime invariants

1. A room launched from a preset, a setup draft, or direct admin defaults should converge on the same effective behavior when configured equivalently.
2. `runOfShow` must not lose room ownership when policy says it should own the room.
3. queue fallback behavior must remain stable when run-of-show is blocked or gap-filling is permitted.
4. TV overlays, trivia, scoring, chat, and sponsor moments must reflect the same effective room policy regardless of where the policy was authored.
5. live host actions must not accidentally overwrite host defaults or organization templates.

### Scope invariants

1. organization defaults can seed rooms without mutating organization source records during runtime.
2. host defaults can seed a room without cross-room leakage.
3. room-specific overrides must not back-propagate into host or organization defaults unless the host performs an explicit save action.

### Data invariants

1. every migrated field has one canonical owner
2. every duplicated field has one canonical producer
3. every live override path has one explicit persistence policy

## Existing coverage that helps

The codebase already has useful tests around the highest-risk systems:

- `tests/integration/provisionHostRoomCallable.test.cjs`
- `tests/integration/updateRoomAsHostCallable.test.cjs`
- `tests/unit/hostNightPresets.test.mjs`
- `tests/unit/missionControl.test.mjs`
- `tests/unit/roomEventProfiles.test.mjs`
- `tests/unit/runOfShowAutopilot.test.mjs`
- `tests/unit/roomFlowOrchestrator.test.mjs`
- `tests/unit/runOfShowDirector.test.mjs`
- `tests/unit/hostRuntimeShellModel.test.mjs`
- run-of-show integration tests and TV source-level tests

This is good news. It means the repo already contains many of the behavioral seams that should become migration gates.

## Coverage gaps that still need to be closed

### 1. Producer equivalence tests

Missing question:

- do provisioning, preset application, mission setup compilation, and event profile application all produce the same effective canonical config when asked to represent the same room posture?

Needed artifact:

- a contract test suite that feeds equivalent setup intent through each producer and compares normalized output

### 2. Scope inheritance tests

Missing question:

- when organization defaults, host defaults, and room overrides all exist, does precedence behave exactly as designed?

Needed artifact:

- explicit `organization -> host -> room -> runtime override` precedence tests

### 3. Live override persistence tests

Missing question:

- when a host toggles a runtime control in top chrome, is that change temporary, room-persistent, host-default-persistent, or template-persistent?

Needed artifact:

- persistence-policy tests for every duplicated toggle still left in the system

### 4. Sponsor and library ownership tests

Missing question:

- can the same sponsor kit or scene pack be safely shared across rooms without room-level edits corrupting the source kit?

Needed artifact:

- asset-binding and room-activation tests for sponsor kits, scene templates, and background-track packs

## Recommended engineering workstreams

### Workstream A: settings contract and adapters

CTO priority.

Deliver:

- canonical schema
- adapter layer
- contract test suite
- divergence telemetry

### Workstream B: IA and control-surface reduction

CPO and UX Designer priority.

Deliver:

- default vs live vs temporary labeling
- duplicate surface removal plan
- control grouping by task and ownership

### Workstream C: brand, sponsor, and media library architecture

Chief Marketing Officer priority.

Deliver:

- organization-level reusable kits
- room-level activations
- explicit one-night asset rules

### Workstream D: runtime safety validation

Cross-functional priority.

Deliver:

- scripted operator scenarios
- run-of-show + queue interaction regression suite
- TV parity checks

## Risk register

| Risk | Why it happens | Severity | Mitigation |
| --- | --- | --- | --- |
| same room behavior differs depending on setup path | multiple producers emit overlapping settings | critical | canonical adapters plus equivalence tests |
| run-of-show loses control unexpectedly | schema or precedence changes affect orchestration | critical | orchestrator contract tests and rollout gating |
| top chrome writes start changing saved defaults unintentionally | live-vs-default boundary is unclear | high | explicit persistence model and UI labels |
| sponsor or brand assets leak across rooms | room assets and reusable kits are mixed | high | separate library source from room activation |
| backend write contract drifts from frontend model | allowlists and UI evolve independently | high | callable adapter layer and shared schema constants |
| org/host scoping introduces confusing inheritance | precedence is not visible or predictable | high | visible inheritance model and source attribution in UI |
| TV or audience experience regresses silently | many room flags terminate in downstream consumers | high | downstream parity snapshots and scenario testing |

## Decision framework by persona

### CTO

Success means:

- one canonical contract
- one precedence model
- adapter-based migration
- measurable divergence during rollout

Failure mode:

- UI cleanup ships before state governance is stabilized

### CPO

Success means:

- fewer host decisions
- less duplicate configuration
- no behavioral surprises between setup and runtime

Failure mode:

- simplification that changes real show behavior in edge cases

### Chief Marketing Officer

Success means:

- reusable branded kits
- reusable sponsor inventory
- event packaging that can scale across hosts and rooms

Failure mode:

- branding still depends on one-off room mutations and manual host setup

### UX Designer

Success means:

- controls grouped by mental model
- clear boundary between defaults and live controls
- visible source-of-truth cues for inherited values

Failure mode:

- a cleaner layout that still hides ownership ambiguity

## Recommended next deliverables

1. Create the canonical settings matrix with producer/consumer fields.
2. Define the precedence model: `organization -> host -> room defaults -> runtime overrides`.
3. Build normalization adapters and contract tests before moving UI.
4. Identify the first pilot slice.

Recommended pilot slice:

- `chatShowOnTv`
- `popTriviaEnabled`
- `showScoring`
- `marqueeEnabled`

Why this slice:

- high duplication
- visible downstream impact
- lower structural risk than queue governance or run-of-show ownership

## Final recommendation

Treat this as a controlled systems migration.

Do not start by moving menus. Start by stabilizing the semantics, precedence, and producer pipeline. Once the team can prove that equivalent setup intent produces equivalent room behavior, the IA cleanup and scope split become much safer and much easier to defend.
