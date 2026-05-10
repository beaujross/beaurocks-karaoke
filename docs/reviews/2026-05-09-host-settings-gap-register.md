# Host Settings Gap Register

Date: 2026-05-09
Status: Holistic gap pass tightened into a closure matrix with accessibility criteria defined

## Purpose

This document captures the major gaps that still exist across the full body of work.

The current plan is directionally strong, but these gaps need to be closed explicitly so we do not end up with:

- a cleaner IA with weak operational safety
- a better setup flow with unclear permissions
- a stronger scope model with no provenance or rollback story
- reusable libraries with weak lifecycle rules

## Executive summary

The largest remaining gaps were:

1. `Multi-host permissions and role-specific surfaces`
2. `Save provenance, source attribution, and inheritance visibility`
3. `Undo, recovery, and change-history safety`
4. `Library lifecycle and versioning rules`
5. `Rollout governance, telemetry, and migration observability`
6. `Mode-specific parity for self-serve, social game, and run-of-show variants`
7. `Operational enablement for support, QA, and onboarding`
8. `Accessibility and comprehension under live-show pressure`

None of these invalidate the current direction.
The important change now is that most of them are no longer abstract gaps. They have named closure artifacts and clearer implementation readiness.

## Gap matrix

| Gap | Why it matters | Current risk | Closure artifact | Status |
| --- | --- | --- | --- | --- |
| multi-host permissions | host, co-host, stage manager, media curator, and workspace roles will not all share the same allowed controls | high | `docs/reviews/2026-05-09-host-settings-permissions-matrix.md` and `src/lib/hostSettingsPermissions.js` | contract defined |
| save provenance | hosts need to know whether a value came from tonight, host defaults, workspace template, or preset | high | `docs/reviews/2026-05-09-host-settings-persistence-model.md`, `src/lib/hostSettingsSavePolicy.js`, `src/lib/hostSettingsPersistenceModel.js`, `functions/index.js` | first implementation wired |
| undo and recovery | bundle-first controls change multiple values at once, which increases blast radius without rollback affordances | high | `docs/reviews/2026-05-09-host-settings-undo-recovery-model.md` and `src/lib/hostSettingsChangeHistory.js` | first slice wired |
| asset lifecycle | reusable kits, templates, uploads, and tonight-only assets need creation, activation, archive, clone, and delete rules | high | `docs/reviews/2026-05-09-host-settings-library-lifecycle-versioning-model.md` and `src/lib/hostSettingsAssetLifecycle.js` | contract defined |
| rollout governance | migration needs flags, cohorts, telemetry, and rollback checkpoints | high | `docs/reviews/2026-05-09-host-settings-rollout-telemetry-runbook.md` and `src/lib/hostSettingsTelemetry.js` | contract defined |
| mode parity | karaoke, self-serve, competition, sponsor, and run-of-show rooms do not all want the same defaults or save semantics | medium-high | `docs/reviews/2026-05-09-host-settings-mode-parity-matrix.md` and `src/lib/hostSettingsModeProfiles.js` | contract defined |
| operational enablement | support, QA, and onboarding need scripts and reference models, not just design intent | medium-high | `docs/reviews/2026-05-09-host-settings-qa-scenario-matrix.md`, `docs/reviews/2026-05-09-host-settings-support-troubleshooting-map.md`, `docs/reviews/2026-05-09-host-settings-onboarding-copy-map.md`, `docs/reviews/2026-05-09-host-settings-glossary.md` | first packet drafted |
| monetization enforcement | packaging is not only IA, it also needs capability gating and safe degradation | medium | `docs/reviews/2026-05-09-host-settings-monetization-downgrade-model.md`, `src/lib/hostSettingsEntitlementPolicy.js`, `functions/index.js` | first implementation wired |
| audit trail | workspace-level edits and role-based changes need traceability for trust and debugging | medium | `docs/reviews/2026-05-09-host-settings-audit-trail-model.md`, `src/lib/hostSettingsAuditTrail.js`, `functions/index.js` | first implementation wired |
| accessibility and comprehension | guided setup and summaries need to remain usable under stress and across assistive contexts | medium | `docs/reviews/2026-05-09-host-settings-accessibility-acceptance-criteria.md` and `src/lib/hostSettingsAccessibility.js` | contract defined |

## Closure reading

Treat the remaining list in three groups:

1. `Closed at the contract layer`
   - permissions
   - save/provenance model
   - undo/recovery
   - rollout telemetry
   - mode parity
   - asset lifecycle

2. `Partially closed`
   - operational enablement
   - broader audit-trail display surfaces

3. `Still open`
   - none at the contract-definition level

## Detailed gaps

## 1. Multi-host permissions and role-specific surfaces

### Why this is a gap

The current plan defines `organization`, `host`, and `room`, but it does not yet define in enough detail:

- what a co-host can change live
- what a stage manager can change
- what a media curator can change
- what a workspace admin can change outside a live room
- whether role restrictions apply to bundle controls, detailed controls, save actions, or all three

The codebase already has strong signals that this matters:

- run-of-show operator roles exist
- co-host flows exist in audience and run-of-show surfaces
- organization roles and entitlements already exist

### Risk if ignored

- live helpers either get too much power or not enough
- host-first bundles accidentally bypass role boundaries
- workspace templates become editable by the wrong people

### Needed closure

Create a permissions matrix with rows for:

- `host`
- `co-host`
- `stage manager`
- `media curator`
- `workspace owner`
- `workspace member`

And columns for:

- `Tonight`
- `Live`
- `Library`
- `Workspace`
- `Save as my default`
- `Save to workspace template`
- `Activate sponsor kit`
- `Manage run-of-show template`

## 2. Save provenance and inheritance visibility

### Why this is a gap

The plan correctly moves scope decisions later, but once a room is inheriting from multiple sources, the host still needs to know:

- where a value came from
- whether tonight is overriding it
- what will happen next time

### Risk if ignored

- hosts lose trust because changes feel sticky or non-sticky unpredictably
- support cannot explain why a room behaved a certain way
- workspace templates become black boxes

### Needed closure

Define a provenance model for every canonical field:

- `sourceType`: preset, workspace_template, host_default, room_override, runtime_override
- `sourceId`
- `lastChangedBy`
- `lastChangedAt`

And define UI cues:

- `Inherited from workspace`
- `Using your default`
- `Changed for tonight`
- `Custom after preset`

## 3. Undo, recovery, and change history

### Why this is a gap

Bundle-first controls are correct for cognitive load, but they make mistakes more consequential because one click can change four or five fields.

### Risk if ignored

- hosts fear recipes and presets
- support incidents become harder to reverse quickly
- live confidence drops because there is no safe experimentation

### Needed closure

Define three recovery layers:

1. `Immediate undo`
   - for the last bundle or save action

2. `Revert to prior tonight state`
   - for room-level setup mistakes

3. `Restore from preset/template/default source`
   - for larger resets

Also define whether history is:

- session-local only
- persisted per room
- persisted per workspace template

## 4. Library lifecycle and versioning

### Why this is a gap

The plan identifies scope, but not yet lifecycle.

For scenes, background tracks, sponsor kits, brand kits, and templates, the system needs rules for:

- draft
- active
- archived
- cloned
- deprecated
- deleted

### Risk if ignored

- room edits accidentally mutate reusable sources
- sponsor activations become brittle
- template drift becomes impossible to reason about

### Needed closure

Define lifecycle and versioning rules for:

- sponsor kits
- branding kits
- room templates
- scene templates
- audio packs
- run-of-show templates

Minimum rule:

- room activations should reference reusable assets but not edit them in place

## 5. Rollout governance and telemetry

### Why this is a gap

The systems migration plan already calls for compatibility adapters and shadow-read/dual-write, but this needs to be elevated to an actual rollout program.

### Risk if ignored

- partial migrations become impossible to diagnose
- regressions show up as anecdotal operator complaints instead of measurable signals
- rollback becomes slower than it should be

### Needed closure

Create a rollout runbook with:

- migration cohorts
- feature flags by surface
- rollback checkpoints
- divergence telemetry
- host-friction telemetry

Key signals:

- time to first show-ready room
- number of advanced controls opened
- number of bundle overrides after preset selection
- frequency of undo/revert usage
- support tickets or in-product distress signals

## 6. Mode parity and exception rules

### Why this is a gap

The new bundles are strong for standard host workflows, but not every room format wants the same assumptions.

Examples:

- self-serve auctions
- sponsor-heavy events
- run-of-show showcases
- social game nights
- competition formats

### Risk if ignored

- the bundle model becomes too generic
- edge modes keep leaking raw controls back into the default path
- “advanced” becomes a dumping ground for product exceptions

### Needed closure

Create a parity matrix covering:

- karaoke standard
- competition
- self-serve
- sponsor/festival
- run-of-show showcase
- social game night

For each, define:

- required setup questions
- hidden defaults
- allowed live shortcuts
- forbidden simplifications

## 7. Operational enablement

### Why this is a gap

A migration like this changes not just screens, but how people explain and support the product.

### Risk if ignored

- support still speaks in old tab names and raw fields
- onboarding copy contradicts the product
- QA lacks a stable scenario matrix

### Needed closure

Create:

- QA scenario matrix
- support troubleshooting map
- onboarding copy map
- internal glossary
- “old surface -> new surface” translation sheet

## 8. Monetization and entitlements enforcement

### Why this is a gap

The plan treats packaging as a product problem, but the implementation also needs safe capability gating.

### Risk if ignored

- premium workspace features appear available when they are not
- hosts save templates or kits they cannot later reuse
- downgrade behavior becomes confusing

### Needed closure

Define capability handling for:

- reading a feature
- activating a feature
- saving a feature to host defaults
- saving a feature to workspace templates
- losing access after downgrade

Closure artifact now defined:

- `docs/reviews/2026-05-09-host-settings-monetization-downgrade-model.md`
- `src/lib/hostSettingsEntitlementPolicy.js`
- `functions/index.js`

## 9. Accessibility and comprehension

### Why this is a gap

Simpler structure does not automatically mean better usability under stress.

### Risk if ignored

- bundle-first UI becomes too opaque
- review summaries become too dense
- hosts with accessibility needs still struggle during live operation

### Needed closure

Add acceptance criteria for:

- keyboard flow
- screen-reader clarity
- color and motion safety
- plain-language summaries
- one-screen scanability during live use

Closure artifact now defined:

- `docs/reviews/2026-05-09-host-settings-accessibility-acceptance-criteria.md`
- `src/lib/hostSettingsAccessibility.js`

## Recommended plan adjustments

## Add a new cross-cutting workstream

Add:

- `Workstream F: Governance, Permissions, and Recovery`

Output:

- permissions matrix
- provenance model
- undo/recovery model
- rollout runbook
- change-history policy

## Add a new pre-cutover gate

Before broad rollout, require sign-off on:

1. role permissions
2. save provenance
3. undo/recovery
4. telemetry and rollback readiness
5. accessibility and comprehension acceptance criteria

## Add a new success metric category

### Operational

- fewer support clarifications about where settings live
- lower advanced-drawer open rate for standard launches
- low divergence between inherited source and effective room behavior
- safe rollback time stays under an agreed threshold

## Recommended next deliverables

1. connect capability gating and downgrade behavior to promoted saves
2. expand audit history from bundle-local history into workspace-visible change logs
3. run the formal accessibility audit against the defined criteria

## Final recommendation

Do not stop the current implementation slices.

The bundle-first direction is correct.
But from this point onward, each product slice should be checked against five cross-cutting questions:

1. who can change this
2. where did this value come from
3. how do we undo it
4. how do reusable assets behave over time
5. how will we detect breakage during rollout

If those five questions are answered for each new slice, the migration will stay coherent instead of becoming a sequence of isolated UI wins.
