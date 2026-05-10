# Host Settings Undo and Recovery Model

Date: 2026-05-09
Status: First recovery contract for bundle-first host settings

## Purpose

The host-settings migration is intentionally making setup and live control faster by introducing bundles like:

- `Crowd mode`
- `Operating style`

That lowers mental load, but it also increases blast radius because one action can change multiple settings.

This model defines how recovery should work so simplification does not reduce operator trust.

## Recovery layers

### 1. Immediate undo

Use for:

- last bundle application
- last save-target action
- last grouped room-policy shortcut

Behavior:

- one-tap reversal
- restore the exact prior field snapshot
- available inline in the same surface that triggered the action

Examples:

- `Undo High Energy Crowd`
- `Undo Tight Stage Control`

### 2. Restore tonight

Use for:

- room-level reset after several changes
- getting back to the current room's prior stable state

Behavior:

- restore from the last stable room snapshot
- can span multiple bundle changes
- should be host-only by default

### 3. Restore from source

Use for:

- go back to preset
- reapply host default
- reapply workspace template

Behavior:

- restore from explicit saved source
- clearly say what source is being restored
- should not be confused with undo

## History entry contract

Every bundle or save action should produce a normalized history entry with:

- `action`
- `bundleId`
- `label`
- `before`
- `after`
- `provenance`
- `actorUid`
- `actorRole`
- `changedAtMs`

The code-side helper for this contract is:

- [src/lib/hostSettingsChangeHistory.js](</c:/Users/beauj/Desktop/beaurocks-karaoke/src/lib/hostSettingsChangeHistory.js:1>)

## Provenance relationship

Undo and recovery should preserve provenance awareness.

That means a reversible settings action should still know:

- whether it came from a preset
- whether it was saved to tonight, host defaults, or workspace template
- who applied it

This should align with:

- [src/lib/hostSettingsSavePolicy.js](</c:/Users/beauj/Desktop/beaurocks-karaoke/src/lib/hostSettingsSavePolicy.js:1>)

## Persona approval criteria

### CTO

Requires:

- deterministic history format
- low-risk rollback path
- no ad hoc per-surface undo implementation

### CPO

Requires:

- fast actions stay fast
- mistakes are easy to reverse
- host confidence increases rather than decreases

### Chief Marketing Officer

Requires:

- premium template and kit actions do not feel risky
- branded or sponsored setup changes remain safe to trial

### UX

Requires:

- undo labels are plain language
- restore actions clearly distinguish:
  - `undo`
  - `restore tonight`
  - `restore from source`

## Remaining holistic gaps around recovery

This model closes the contract gap, but three follow-ups still remain:

1. persisted room-history storage rules
2. UI placement rules for undo and restore actions
3. telemetry for undo usage and failed restore attempts

## Final recommendation

No bundle-first control should broaden rollout without an undo path.

That is now a governance rule, not just a design preference.
