# Host Settings Accessibility And Comprehension Acceptance Criteria

Date: 2026-05-09
Status: Contract defined for bundle, save, and review surfaces

## Purpose

This document closes the last fully open host-settings gap.

The goal is not vague usability intent.
The goal is explicit acceptance criteria that can block or approve rollout for:

- `Tonight` bundle setup
- `Live` bundle control
- promoted save actions
- plain-language review summaries

It is paired with:

- `src/lib/hostSettingsAccessibility.js`
- `tests/unit/hostSettingsAccessibility.test.mjs`
- `tests/unit/hostSettingsAccessibilitySource.test.mjs`

## Executive framing

### CTO

Accessibility and comprehension are now part of the rollout contract, not discretionary polish.

### CPO

The host must be able to answer three questions quickly:

1. what changes now
2. what stays for next time
3. how to undo it

### Chief Marketing Officer

Premium workspace features only help commercially if hosts can understand and activate them under pressure.

### UX

Bundle-first controls only count as simpler if they remain keyboard-safe, screen-readable, and scannable in one pass.

## Scope surfaces

The first mandatory surfaces are:

1. `tonight_bundles`
2. `live_bundles`
3. `promoted_saves`
4. `review_summary`

Broad rollout should not proceed unless all four have explicit evidence.

## Surface criteria

## 1. Tonight bundles

Applies to:

- `Crowd mode`
- `Operating style`

Acceptance criteria:

- every preset button is keyboard reachable
- selected preset state is exposed semantically, not only by color
- current bundle summary is announced as live status text
- helper text explains that detailed controls are secondary
- restore path is visible when a saved room value exists

## 2. Live bundles

Applies to:

- `Live > Crowd`
- `Live > Room`

Acceptance criteria:

- menu toggles expose expanded state
- preset buttons expose pressed state
- current live bundle summary is announced as status text
- live surface explains that changes affect tonight only
- undo action exists for the last live bundle change
- state cannot be communicated by color alone

## 3. Promoted saves

Applies to:

- `Save as my default`
- `Save to workspace template`
- `Use my default`
- `Use workspace template`

Acceptance criteria:

- save labels are plain language and avoid storage jargon
- role-gated actions do not leave dead or misleading controls visible
- scope language stays short enough to scan under stress
- source or destination cue stays next to the action cluster

## 4. Review summary

Applies to:

- setup review
- bundle summaries
- future room-template review surfaces

Acceptance criteria:

- summary fits on one screen in the common host viewport
- summary tells the host what the room will do, not what fields were set
- summary distinguishes `tonight` from `next time`
- summary does not depend on color alone

## Copy guardrails

The following limits now apply to host-facing bundle and save copy:

- label length: `36` characters max
- description length: `160` characters max
- description length: `2` sentences max
- action labels: `30` characters max

Avoid default host-facing copy that includes:

- `organization`
- `inheritance`
- `precedence`
- `runtime override`
- `room override`
- implementation tokens such as `host_default` or `workspace_template`

Allowed host-facing scope labels remain:

- `Tonight only`
- `My default`
- `Workspace template`

## Required evidence

Each new bundle or promoted-save slice needs:

1. checklist coverage for the required surfaces
2. plain-language summary samples that pass the copy guardrails
3. source-level confirmation for semantic states when relevant:
   - `aria-expanded`
   - `aria-pressed`
   - live status announcement

## Rollout gate

For pilot:

- criteria must be defined
- source semantics must exist on the first migrated surfaces
- bundle and save copy samples must pass the guardrails

For broad rollout:

- the active host surfaces must pass a manual keyboard and screen-reader check
- provenance/source cues must be visible on promoted-save flows
- new bundle families must be checked against the same contract before shipping

## Current slice status

For the current bundle and persistence slice:

- `Tonight bundles`: contract defined and semantic state added
- `Live bundles`: contract defined and semantic state added
- `Promoted saves`: contract defined and copy guardrails defined
- `Review summary`: contract defined, broader review surface still pending

## Final recommendation

Treat accessibility and comprehension as a release gate on the same level as permissions, rollback, and telemetry.

If the product is simpler structurally but not legible under live-show pressure, the migration has not actually succeeded.
