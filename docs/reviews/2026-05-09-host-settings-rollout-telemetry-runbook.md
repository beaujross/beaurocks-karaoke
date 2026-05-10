# Host Settings Rollout Telemetry Runbook

## Purpose

This migration needs an operational contract, not just a UX contract. The bundle-first host settings work changes how multiple room behaviors are authored at once, so rollout safety depends on measuring both host comprehension and state correctness.

This runbook is the control layer for:

- `CTO`: contract drift, permission drift, rollback speed, incident detection
- `CPO`: decision-count reduction, setup speed, live confidence
- `Chief Marketing Officer`: workspace-template adoption, reusable branding/sponsor leverage
- `UX`: bundle clarity, undo discoverability, exception-edit frequency

## Canonical telemetry events

The code-side event contract now lives in `src/lib/hostSettingsTelemetry.js`.

Initial canonical events:

- `host_settings_bundle_applied`
- `host_settings_undo_applied`
- `host_settings_restore_applied`
- `host_settings_save_requested`
- `host_settings_save_denied`

Each event should carry:

- `bundleId`
- `presetId`
- `surface`
- `runtimeRole`
- `workspaceRole`
- `roomCode`
- `roomMode`
- `sourceType`
- `sourceId`
- `saveTarget`
- `changedKeyCount`
- `changedKeys`
- `changedAtMs`

## Required dashboards

### 1. Host friction dashboard

Track:

- bundle apply rate by surface
- undo rate within 2 minutes of apply
- restore-to-saved-room rate
- custom-exception edits after preset apply
- save-target attempts once persistence is wired
- save-denied rate by role

Interpretation:

- high preset apply + low undo + low exception edits means the bundle is grouping correctly
- high preset apply + high exception edits means the bundle is too coarse or mislabeled
- high undo means hosts do not trust the bundle outcome or did not understand scope

### 2. Contract integrity dashboard

Track:

- divergence between intended bundle patch and persisted room state
- room update failures on bundle apply
- permission-denied mismatches
- rollback completion time
- mode-specific failure rate for `karaoke`, `run_of_show`, `self_serve`, and sponsor-heavy rooms

Interpretation:

- any divergence between issued patch and room snapshot is a state-contract defect
- rollback time above threshold means the migration is not operationally safe

### 3. Workspace leverage dashboard

Track:

- workspace-template saves by role
- reuse rate of workspace templates across rooms
- host-default saves by host
- rooms still relying on raw primitive edits instead of bundles

Interpretation:

- low reuse means the ownership model is still too abstract or the save surfaces are badly placed

## Rollout gates

### Gate 1: internal / design-partner

Required before expanding:

- no high-severity contract drift
- bundle apply failure rate stays below agreed threshold
- undo works from both setup and live surfaces
- restore-to-saved-room works in setup

### Gate 2: limited production cohort

Required before broadening:

- median setup decision count decreases
- live crowd/flow changes happen faster than baseline
- undo rate trends down after first use
- no unresolved role/permission contradictions

### Gate 3: broad release

Required before promoting defaults/templates:

- workspace-role save permissions verified
- provenance/source labels understood in usability review
- rollback runbook exercised in staging and production-like data

## Rollback triggers

Pause or reverse rollout if any of the following occurs:

- bundle apply writes an unexpected state combination
- undo fails for a bundled change
- setup draft and persisted room state drift without a visible recovery path
- a non-authorized role can promote settings to a wider scope
- mode-specific breakage appears in `run_of_show` or `self_serve`

## Scientific migration rule

No new bundle should broaden rollout until it has:

1. a canonical patch contract
2. undo coverage
3. source/provenance labeling
4. telemetry coverage
5. rollback criteria

That rule is the minimum approval bar for `CTO`, `CPO`, `Chief Marketing Officer`, and `UX`.
