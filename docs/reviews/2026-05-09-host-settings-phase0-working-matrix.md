# Host Settings Phase 0 Working Matrix

Date: 2026-05-09
Status: Initial implementation-facing working artifact

## Purpose

This document starts Phase 0 with two practical artifacts:

1. a canonical matrix for the first migration slice
2. a host decision inventory focused on mental-load reduction

This is not the final full-room catalog. It is the working seed for the first cleanup tranche.

## Host jobs

The host-facing model should optimize for these jobs:

1. `Set up tonight`
2. `Run live`
3. `Save or share what worked`

The system-facing scope model remains:

1. `organization`
2. `host`
3. `room`
4. `runtime_override`

## First migration slice

This slice was chosen because it has high duplication, visible audience impact, and lower structural risk than queue governance or run-of-show ownership.

Included settings:

- `chatShowOnTv`
- `chatTvMode`
- `showScoring`
- `marqueeEnabled`
- `marqueeShowMode`
- `popTriviaEnabled`
- `autoPlayMedia`
- `readyCheckDurationSec`
- `queueSettings`
- `hostUiPrefs.runtimeModeEmphasis`
- `eventCredits`
- `audienceFeatureAccess`

## Canonical matrix

| Setting | Canonical domain | Effective owner scope | Primary host job | Owner surface | Shortcut surface | Save behavior | Current main producers | Current main consumers | Decision burden |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `chatShowOnTv` | `tvPresentation.crowdChat` | `room` | `run_live` | `Live > Crowd` | `Tonight > Crowd experience` | `tonight`, optional save to host/workspace via recipe/template | provisioning, presets, mission setup, direct room edits | TV, top chrome, chat panels | high |
| `chatTvMode` | `tvPresentation.crowdChatMode` | `room` | `run_live` | `Live > Crowd` | `Tonight > Crowd experience` | `tonight`, optional save to host/workspace via recipe/template | provisioning, presets, direct room edits | TV, top chrome | medium |
| `showScoring` | `tvPresentation.scoring` | `room` | `run_live` | `Live > Crowd` | `Tonight > Crowd experience` | `tonight`, optional save to host/workspace via recipe/template | provisioning, presets, mission setup, direct room edits | TV, mobile, top chrome | high |
| `marqueeEnabled` | `tvPresentation.marquee` | `room` | `run_live` | `Live > Crowd` | `Tonight > Crowd experience` | `tonight`, optional save to host/workspace via recipe/template | provisioning, presets, mission setup, direct room edits | TV, top chrome, overlays panel | high |
| `marqueeShowMode` | `tvPresentation.marqueeMode` | `room` | `set_up_tonight` | `Tonight > Crowd experience` | `Live > Crowd` | `tonight`, optional save to host/workspace via recipe/template | provisioning, presets, mission setup | TV | medium |
| `popTriviaEnabled` | `runtimeAutomation.crowdMoments` | `room` | `run_live` | `Live > Crowd` | `Tonight > Crowd experience` | `tonight`, optional save to host/workspace via recipe/template | provisioning, presets, mission setup, direct room edits | TV, mobile, game flows, top chrome | high |
| `autoPlayMedia` | `runtimeAutomation.stageStart` | `room` | `run_live` | `Live > Flow` | `Tonight > Operating style` | `tonight`, optional save to host/workspace via recipe/template | provisioning, presets, mission setup, direct room edits | stage start flow, top chrome, automation controls | medium |
| `readyCheckDurationSec` | `roomPolicy.readyCheck` | `room` | `run_live` | `Live > Flow` | `Tonight > Operating style` | `tonight` by default | base room defaults, direct room edits | top chrome, ready check flow | medium |
| `queueSettings` | `roomPolicy.queue` | `room` | `set_up_tonight` | `Tonight > Operating style` | `Live > Flow` | `tonight`, optional save to host/workspace via recipe/template | provisioning, presets, mission setup, event profiles, direct room edits | audience queue, mobile, TV, room flow, mission setup | very_high |
| `hostUiPrefs.runtimeModeEmphasis` | `hostPreferences.runtimeShell` | `host` | `save_or_share` | `Library / Workspace > My defaults` | none | `host` only | direct host edits today via room compatibility | host runtime shell model | low |
| `eventCredits` | `supportEconomy.eventCredits` | `room` with future `organization` kit source | `set_up_tonight` | `Brand + Money` | none | `tonight`, optional save to workspace kit/template | provisioning, event profiles, direct room edits | mobile, support flows, TV support modules, callables | high |
| `audienceFeatureAccess` | `audienceAccess.engagementPolicy` | `room` with future org/host defaults | `set_up_tonight` | `Tonight > Crowd experience` | none | `tonight`, optional save to host/workspace via recipe/template | provisioning, presets, mission setup, event profiles, direct room edits | mobile audience app, onboarding/access logic | high |

## Host decision inventory

### Required decisions for a standard room launch

These should be explicit in the default `Tonight` flow:

1. what kind of night is this
2. how tightly the room should be moderated
3. how interactive the crowd experience should be
4. whether brand/sponsor/support layers are active

### Optional decisions

These can be visible in setup but should have strong defaults:

- queue limit style
- scoring visibility
- chat on TV
- marquee posture
- auto-play posture

### Advanced-only decisions

These should be hidden under advanced by default:

- detailed `chatTvMode`
- detailed `marqueeShowMode`
- fine-grained audience access policy
- event-credit internals
- host runtime shell emphasis
- edge-case timing values unless a recipe depends on them

### Machine-defaulted decisions

These should usually be chosen by recipe, preset, template, or prior host defaults:

- initial crowd interaction posture
- standard automation posture
- standard queue posture
- standard sponsor-treatment posture
- standard audience access posture

## Bundles to reduce host mental load

### Crowd mode bundle

Bundle these into one host-facing control first:

- `chatShowOnTv`
- `showScoring`
- `marqueeEnabled`
- `popTriviaEnabled`

Recommended presets:

1. `Quiet Room`
2. `Balanced Crowd`
3. `High Energy Crowd`

The host can override individual parts in advanced or live shortcuts.

### Operating style bundle

Bundle these together in setup:

- `queueSettings`
- `autoPlayMedia`
- `readyCheckDurationSec`

Recommended presets:

1. `Low-Touch Autopilot`
2. `Balanced Host Assist`
3. `Tight Stage Control`

### Brand and support bundle

Bundle these together:

- `eventCredits`
- sponsor kit activation
- brand kit selection

This should feel like activating a package, not filling out multiple utilities.

## First implementation rules

1. Every setting in this slice gets one owner surface.
2. Every shortcut must point to the same underlying semantic owner.
3. Every setting in this slice needs a plain-language summary sentence.
4. Scope choice should appear only on explicit save/share actions unless there is a strong reason otherwise.
5. No new duplicated toggle should be added for any setting in this slice.

## Immediate engineering follow-up

1. create a code-side catalog for this slice
2. use it to guide owner-surface cleanup
3. use it to design grouped controls and save patterns
4. expand it into the full canonical matrix after the first slice is stable
