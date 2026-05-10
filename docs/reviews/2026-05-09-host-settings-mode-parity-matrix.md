# Host Settings Mode Parity Matrix

## Purpose

The bundle-first model cannot assume every room behaves like standard karaoke. This matrix defines where the simplified model is allowed to stay simple and where a mode must preserve extra structure.

## Canonical modes

Code-side profile contract: `src/lib/hostSettingsModeProfiles.js`

Modes:

- `standard`
- `competition`
- `self_serve`
- `sponsor_festival`
- `run_of_show_showcase`
- `social_game_night`

## Matrix

| Mode | Required setup questions | Allowed live bundles | Hidden defaults | Forbidden simplifications | Allowed promoted saves |
| --- | --- | --- | --- | --- | --- |
| standard karaoke | crowd energy, request policy, room branding | crowd mode, operating style | run-of-show policy, sponsor kit activation | none | tonight, host default, workspace template |
| competition | scoring rules, judge visibility, queue governance | crowd mode, operating style | guest-search relaxation | hiding scoring logic, collapsing judge authority | tonight, host default, workspace template |
| self-serve | auction policy, guest access, support-surge rules | crowd mode | manual ready check prompts | forcing host-only recovery, forcing manual-only stage start | tonight, workspace template |
| sponsor festival | sponsor kit, scene pack, brand palette | crowd mode, operating style | default brand theme | ad hoc sponsor asset edits in room | tonight, workspace template |
| run-of-show showcase | run-of-show template, operator roles, automation policy | crowd mode | queue rotation shortcuts | hiding automation state, collapsing operator authority | tonight, workspace template |
| social game night | game mix, crowd activity, runtime shell | crowd mode, operating style | formal scoring panels | forcing classic runtime only | tonight, host default, workspace template |

## Executive guardrails

`CTO`

- no mode may silently bypass permission or rollback rules
- no mode may expand save targets beyond its profile contract

`CPO`

- each mode must preserve a short setup path
- exceptions should be mode-specific, not global leakage back into advanced settings

`Chief Marketing Officer`

- sponsor/festival mode must keep reusable kit activation structured and packageable

`UX`

- mode-specific questions should appear only when the room format truly requires them
- hidden defaults are allowed only when recovery and provenance stay visible

## Final rule

If a requested simplification breaks one of the `forbidden simplifications` above, it should not be treated as a cleanup. It is a mode-contract violation.
