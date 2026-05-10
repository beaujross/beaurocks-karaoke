# Host Settings Persistence Model

## Purpose

The save policy, permission model, and provenance model are already defined. This document closes the remaining gap by defining where promoted settings should live and how the write scopes differ.

Code-side contract: `src/lib/hostSettingsPersistenceModel.js`

Current implementation status:

- backend callable wired in `functions/index.js` as `manageHostSettingsDefaults`
- client wrapper wired in `src/lib/firebase.js`
- first saved bundles live in Host setup for `crowd_mode` and `operating_style`

## Canonical save targets

- `tonight`
- `host_default`
- `workspace_template`

## Recommended storage mapping

### Tonight

Write to:

- room runtime state via `updateRoomAsHost`

This is not a reusable template. It is the effective room state for the current room.

### Host default

Write to:

- `users/{uid}/hostDefaults`

Initial expectation:

- one stable document or bundle map per host
- stores portable personal defaults
- never stores tonight-only runtime noise

### Workspace template

Initial write target:

- `organizations/{orgId}/settings/defaults`

Later expansion:

- named `roomTemplates/{templateId}` for reusable packaged templates

This keeps the first promotion seam simple while leaving room for true template libraries later.

## Bundle keys

Initial code-side bundle keys:

- `settings_core`
- `crowd_mode`
- `operating_style`

These keys are not host-facing labels. They are stable write-contract identifiers.

## Executive guardrails

`CTO`

- promoted saves must use a stable locator model before any backend persistence is wired

`CPO`

- hosts should not be asked to reason about storage paths, only about save intent

`Chief Marketing Officer`

- workspace-level promotion must remain compatible with packaging and reusable commercial templates

`UX`

- `Tonight only`, `My default`, and `Workspace template` are the only host-facing labels needed at this layer

## Final rule

The product may expose save intent before named workspace templates exist, but it should not pretend full template persistence exists until the backend contract is actually implemented.
