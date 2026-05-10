# Host Settings Executive Signoff Scorecard

Date: 2026-05-09
Status: Executive approval framework for the host-settings migration

## Purpose

This scorecard makes executive alignment operational.

The goal is not just that the `CTO`, `CPO`, `Chief Marketing Officer`, and `UX Designer` were considered in strategy.
The goal is that each major slice can be approved or blocked against explicit criteria before it rolls out broadly.

## Signoff model

Every major slice should carry four checks:

1. `CTO approval`
2. `CPO approval`
3. `Chief Marketing Officer approval`
4. `UX approval`

Broad rollout should not proceed until all four are either:

- `approved`
- `approved with follow-up`

No slice should rely on informal alignment alone.

## Approval levels

| Status | Meaning |
| --- | --- |
| `approved` | ready for broad rollout |
| `approved_with_follow_up` | safe to proceed, but follow-up items are tracked |
| `blocked` | do not broaden rollout |
| `not_applicable` | persona does not materially govern this slice |

## Persona scorecard

## CTO

Approval questions:

1. Is there one canonical semantic contract for this slice?
2. Are producer and consumer paths explicitly known?
3. Is rollback possible without ad hoc surgery?
4. Are permissions and persistence rules explicit?
5. Is telemetry sufficient to detect divergence or regressions?

Evidence required:

- contract helper or schema
- tests
- rollout and rollback notes
- permissions mapping when relevant

## CPO

Approval questions:

1. Does this reduce host decisions instead of just renaming them?
2. Is the default path faster for a standard host launch?
3. Does this avoid behavioral surprises between setup and runtime?
4. Does it preserve trust for experienced operators?

Evidence required:

- before/after decision count
- default path walkthrough
- exception handling model
- host copy and summary behavior

## Chief Marketing Officer

Approval questions:

1. Does this make premium/shared value more legible?
2. Does it strengthen brand, sponsor, or workspace packaging?
3. Does it reduce operational cost for branded or sponsored setups?
4. Does it avoid exposing complexity in customer-facing flows?

Evidence required:

- packaging impact note
- sponsor/branding implications
- workspace leverage story

## UX Designer

Approval questions:

1. Is the grouping aligned to host jobs rather than implementation domains?
2. Are labels plain enough under live-show pressure?
3. Are advanced controls truly secondary?
4. Is there a clear summary, undo path, and source cue when relevant?
5. Is the slice accessible and scannable?

Evidence required:

- wireframe or implemented surface
- copy review
- hierarchy review
- accessibility acceptance criteria and audit notes

## Slice signoff template

Use this for each major slice:

### Slice

- name:
- scope:
- owner surfaces:
- affected settings:

### CTO

- status:
- notes:
- required follow-up:

### CPO

- status:
- notes:
- required follow-up:

### Chief Marketing Officer

- status:
- notes:
- required follow-up:

### UX

- status:
- notes:
- required follow-up:

### Rollout gate

- safe for pilot:
- safe for broad rollout:
- rollback ready:

## Current slices

## Executive checkpoint: bundle and persistence slice

Date: 2026-05-09
Scope:

- `crowd_mode`
- `operating_style`
- undo/recovery for first bundle slice
- promoted saves:
  - `Save as my default`
  - `Save to workspace template`
  - `Use my default`
  - `Use workspace template`

Evidence snapshot:

- shared bundle helpers
- permissions helper
- save policy helper
- persistence locator model
- mode-parity helper
- telemetry helper
- backend callable implementation
- unit coverage
- callable integration coverage

### CTO

- status: `approved_with_follow_up`
- notes:
  - canonical bundle contracts exist
  - persistence is now server-enforced through `manageHostSettingsDefaults`
  - role enforcement is tested for workspace-template saves
  - undo, telemetry, and mode restrictions are present for the first slice
- required follow-up:
  - expand saved-bundle persistence beyond the first two bundle types
  - add audit-trail read/query surfaces on top of the new write path
  - keep rollback and divergence checks active as more settings migrate

### CPO

- status: `approved_with_follow_up`
- notes:
  - host decisions are materially reduced because the default path is still bundle-first
  - setup and live remain behaviorally distinct instead of collapsing into one confusing surface
  - save intent now exists without forcing the host to think about storage structure
- required follow-up:
  - add clearer inherited/source cues in the UI beyond restore/save labels
  - extend the same mental-model simplification to the remaining non-bundled settings clusters

### Chief Marketing Officer

- status: `approved_with_follow_up`
- notes:
  - workspace-template saving now strengthens the packaging story in a real way
  - the system is closer to reusable premium workspace behavior instead of ad hoc room tweaks
  - mode-aware save restrictions reduce the risk of exposing the wrong complexity in specialized formats
- required follow-up:
  - wire sponsor kits, branding kits, and reusable room templates into the same promoted-save story
  - extend the downgrade-safe capability pattern to sponsor kits, branding kits, and room templates

### UX

- status: `approved_with_follow_up`
- notes:
  - bundle cards still lead with outcomes first
  - undo and restore actions now support safe experimentation
  - save actions are attached to the setup surface where hosts already understand the context
- required follow-up:
  - complete a manual audit against the formal accessibility criteria
  - clearer visual provenance labels such as inherited/default/template source badges

### Rollout gate

- safe for pilot: `yes`
- safe for broad rollout: `not yet`
- rollback ready: `yes, for the first slice`

## Slice: crowd mode bundles

Surface footprint:

- `Tonight`
- `Live > Crowd`

Settings:

- `chatShowOnTv`
- `chatTvMode`
- `showScoring`
- `marqueeEnabled`
- `popTriviaEnabled`

Persona framing:

- `CTO`: positive because semantic grouping now has a shared helper and tests
- `CPO`: positive because four separate crowd-energy decisions were reduced into one first
- `Chief Marketing Officer`: neutral-positive because this is not directly monetization-facing, but it supports cleaner branded setups
- `UX`: positive because the host sees clear presets before advanced exceptions

Outstanding follow-up before broad rollout:

- provenance cues
- broader inheritance/source visibility
- manual accessibility audit against the defined criteria

## Slice: operating style bundles

Surface footprint:

- `Tonight`
- `Live > Flow / Room`

Settings:

- `queueSettings`
- `autoPlayMedia`
- `readyCheckDurationSec`

Persona framing:

- `CTO`: positive because setup intent now has a shared bundle contract
- `CPO`: positive because pacing choices are now bundled into one decision first
- `Chief Marketing Officer`: neutral because indirect value is mainly operational simplicity
- `UX`: positive because detailed queue and pacing controls remain available as exceptions

Outstanding follow-up before broad rollout:

- mode parity validation for self-serve and run-of-show rooms
- broader inheritance/source visibility
- manual accessibility audit against the defined criteria

## Required approval checkpoints by phase

### Before save actions ship

- `CTO`: provenance and permissions model approved
- `CPO`: save behavior does not create confusion between tonight and future defaults
- `Chief Marketing Officer`: workspace template save supports packaging strategy
- `UX`: save prompts and labels are clear

### Before workspace templates broaden

- `CTO`: role enforcement and rollback are proven
- `Chief Marketing Officer`: template and kit positioning support premium value
- `UX`: source attribution and inheritance cues are visible

### Before broad migration rollout

- all four personas approve:
  - permissions
  - provenance
  - undo/recovery
  - telemetry/rollback readiness

## Final recommendation

Every new slice should ship with a short signoff packet, not just code.

That packet does not need to be heavy.
But it should make it impossible to confuse:

- technical readiness
- product readiness
- monetization readiness
- operator-experience readiness
