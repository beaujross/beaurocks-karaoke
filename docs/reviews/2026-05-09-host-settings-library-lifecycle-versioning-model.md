# Host Settings Library Lifecycle and Versioning Model

## Purpose

Reusable kits and templates cannot share the same mutation rules as tonight-only room state. This model defines how shared assets move through lifecycle states and how rooms consume them safely.

Code-side contract: `src/lib/hostSettingsAssetLifecycle.js`

## Asset types

- `sponsor_kit`
- `branding_kit`
- `room_template`
- `scene_template`
- `audio_pack`
- `run_of_show_template`

## Lifecycle states

- `draft`
- `active`
- `archived`
- `deprecated`
- `deleted`

## Allowed transitions

- `draft -> active`
- `draft -> archived`
- `draft -> deleted`
- `active -> archived`
- `active -> deprecated`
- `archived -> active`
- `archived -> deleted`
- `deprecated -> archived`
- `deprecated -> deleted`

Direct `active -> deleted` is not allowed.

That rule exists to protect rooms that may still reference a shared asset.

## Activation rules by asset type

| Asset type | Activation mode | Room can edit source in place? | Versioned? |
| --- | --- | --- | --- |
| sponsor kit | reference then room override | no | yes |
| branding kit | reference then room override | no | yes |
| room template | clone into room | no | yes |
| scene template | clone into room | no | yes |
| audio pack | reference then room override | no | yes |
| run-of-show template | clone into room | no | yes |

## Scientific rule

Room activations may inherit from reusable assets, but a room must never mutate the source asset in place.

That is the minimum integrity rule for:

- sponsor kits
- scene packs
- room templates
- audio packs
- run-of-show templates

## Executive guardrails

`CTO`

- every shared asset needs stable lifecycle state and rollback-safe retirement

`CPO`

- room operators should not need to understand version graphs to run tonight

`Chief Marketing Officer`

- sponsor and branding kits must remain reusable, packageable, and auditable

`UX`

- lifecycle labels should use plain language such as `Draft`, `Active`, `Archived`, and `Deprecated`

## Final rule

If a shared asset needs room-specific edits, the system should create a room-level instance or override layer. It should not quietly rewrite the shared source.
