# Host Console Moment Audio Spec
Date: 2026-04-04

## 2026-04-26 Terminology Guardrail

User-facing `cue` language is too easy to confuse with `queue`, especially in voice-to-text and live verbal collaboration.

Current product rule:

- scheduled flow items remain `Performance`, `Moment`, and `Scene`
- short audio punctuation should prefer `Sting` in user-facing copy
- do not use `Cue` as a separate primary host-facing scheduling concept

Practical implication:

- sponsor beats, announcements, and similar planned beats should be modeled as `Moment` or `Scene`
- a `Sting` may optionally decorate those items
- raw cue/audio concepts can remain internal until a larger post-event sound-bank cleanup happens

## Goal
Make BeauRocks feel more like a live game console or game show desk during hosting:

- fast feedback
- stronger pacing
- low-friction celebration and reveal moments
- no sprawling mid-show soundboard workflow

The host should think in terms of **moments** and **outcomes**, not individual sound assets.

## Product Principle
Do not ask the host:

- Which sound should I play?

Ask the host:

- What kind of moment am I creating?

This means the live host UI should expose a very small number of intent-driven buttons and let the system map those to sound, lighting, TV treatment, and optional overlays.

## Core Model
Moment audio should exist in three layers.

### 1. System Earcons
Tiny product feedback sounds for the host surface itself.

Examples:

- confirm
- success
- warning
- reveal
- advance
- start show

These are not show moments. They are interface feedback.

Rules:

- very short
- subtle
- should never fight with backing audio
- should be muteable with host SFX mute
- should help the product feel responsive and "console-like"

### 2. Planned Show Cues
Audio cues that belong to a run-of-show beat or scene.

Examples:

- intro sting
- next performer sting
- game break bumper
- trivia reveal sting
- celebration / win sting
- finale lift

These are tied to the show structure and should be configured as part of run of show, not improvised every time.

Rules:

- scene-safe
- should be available as optional scene fields, not required
- should be low-latency and short
- should work well with TV takeovers and light-mode moments

### 3. Live Override Moments
A tiny set of host-triggered presets for unplanned pivots during a live room.

Examples:

- `Hype`
- `Celebrate`
- `Reveal`
- `Next Up`
- `Reset`

Rules:

- keep to 4-6 max
- large, safe, obvious buttons
- never a long scrolling library
- these should feel like console "moment triggers," not a soundboard grid

## UX Model
The host should not switch into a separate "audio mode."

Instead:

- planned cues live in run of show
- live moment triggers live on the queue page as a compact strip
- deeper SFX browsing remains secondary / fallback only

This avoids a second control surface while preserving spontaneity.

## Live Button Set
Recommended default live buttons:

### `Hype`
Use when the room needs lift.

Effect bundle may include:

- short upbeat bumper
- optional lighting energy nudge
- optional TV emphasis

### `Celebrate`
Use after wins, milestones, standout moments, or strong applause.

Effect bundle may include:

- celebration sting
- optional confetti / winner overlay
- optional brief light hit

### `Reveal`
Use for trivia, bingo, WYR, challenge results, or countdown payoffs.

Effect bundle may include:

- suspense-to-answer sting
- optional TV reveal emphasis

### `Next Up`
Use to tee up the next performer or next block.

Effect bundle may include:

- performer intro sting
- optional room reset of overlays

### `Reset`
Use to clear the room back to a neutral baseline.

Effect bundle may include:

- short neutral transition sound
- clear temporary overlays
- clear transient light or crowd effect state when safe

## What Should Not Be On The Main Live Surface
Do not put these in the default host lane:

- individual sound asset names
- giant SFX button grids
- novelty effects with unclear purpose
- separate mode switches for "audio console"
- deep per-asset tuning controls

Those can exist in fallback tools, but not in the main operating path.

## Relationship To Current Soundboard
Current state:

- `SoundboardControls.jsx` exposes a generic SFX board
- Live Deck exposes SFX quick access and mute/volume
- this is useful as a fallback, but too low-level for the primary host runtime model

Decision:

- keep the current soundboard as a secondary/fallback tool
- introduce a higher-level `Moments` layer above it
- the host should use `Moments` by default and reach for raw SFX only rarely

### First Rollout Mapping
The first shipping pass should reuse the current host primitives instead of waiting for a brand-new audio system.

- `Hype` -> existing beat-drop room effect plus a hype SFX
- `Celebrate` -> existing crowd/applause SFX
- `Reveal` -> existing drumroll/reveal SFX
- `Next Up` -> existing short intro sting plus light room reset when safe
- `Reset` -> clear transient room effects and play a short neutral transition cue

This keeps the UX outcome-first immediately, while leaving room for a cleaner dedicated cue library later.

## Interaction Design
### Queue Page
The queue page should expose:

- run-of-show HUD
- stage essentials
- live queue summary
- compact `Moments` strip
- compact host confirmation banner when a cue fires

That strip should:

- sit near the runtime controls
- stay visible without opening a large menu
- use large labels and icons
- show cooldown state when recently used
- reflect the most recent cue so manual triggers and auto-fired scene cues feel like one system

### Run Of Show
Each eligible scene can optionally define:

- `cueFamily`
- `cueId`
- `cueTiming`
- `cueAutoFire`

First shipping simplification:

- use one compact `Scene Cue` field on the scene
- store one cue id plus `start` / `end` timing
- auto-fire from run-of-show lifecycle instead of asking the host to trigger it manually every time
- render the cue choices as a small preset picker with the same icon, tone, and cue family used in the live `Moments` strip

Run of show should use cues for:

- opener scenes
- performer intro scenes
- reveals
- break transitions
- finale scenes

### Fallback / Power User Path
Keep the raw soundboard in a secondary surface for:

- emergency/manual triggering
- testing
- niche host preferences

But it should not be required for normal hosting.

## Audio Design Rules
### Duration
- Most earcons: under `500ms`
- Most moment cues: under `1.5s`
- Rare feature bumpers: under `2.5s`

### Loudness / Mixing
- cues should sit above the interface but not overwhelm the room
- cues should duck gracefully under backing audio where appropriate
- celebration and reveal cues can be slightly stronger than earcons

### Cohesion
All cues should sound like one product family:

- same sonic identity
- same production quality
- same emotional palette

Do not mix random meme sounds or unrelated stock effects into the default system.

## Safety / Guardrails
### Cooldowns
Live moment buttons should have cooldowns to avoid accidental spam.

Recommended defaults:

- `Hype`: `8-12s`
- `Celebrate`: `10-15s`
- `Reveal`: `6-10s`
- `Next Up`: `5-8s`
- `Reset`: `5-8s`

### Song Safety
Some moments should be reduced or discouraged during delicate performance moments.

Examples:

- avoid loud celebration stings during a quiet ballad verse
- prefer softer reveal tones when a singer is mid-line

### Global Control
Hosts need:

- mute all SFX
- volume for moment audio
- emergency silence

### Accessibility
- no cue should be the only way a state is communicated
- pair important moments with visual confirmation
- provide flash-safe alternatives where visuals are tied to cues

## Trigger Rules
### Auto Triggers
Good candidates for automatic cue firing:

- show start
- performer intro
- reveal state change
- winner declared
- block complete

### Manual Triggers
Good candidates for manual host trigger only:

- hype push
- room reset
- extra celebration
- emergency crowd recovery moment

### Never Auto Trigger
- novelty sounds
- host-only earcons meant purely for UI feel
- high-intensity celebration sounds more than once per state transition

## Data / Config Model
Recommended model:

### Cue Families
Examples:

- `system`
- `transition`
- `reveal`
- `celebration`
- `performer_intro`
- `room_reset`

### Cue Metadata
Each cue should define:

- `id`
- `family`
- `label`
- `durationMs`
- `defaultVolume`
- `cooldownMs`
- `safeDuringPerformance`
- `supportsAutoFire`

### Scene Config
Optional run-of-show scene fields:

- `momentCueId`
- `momentCueAutoFire`
- `momentCueTiming`

### Live Trigger Presets
Moment buttons should map to presets rather than raw assets:

- `hype`
- `celebrate`
- `reveal`
- `next_up`
- `reset`

Each preset can map to:

- cue id
- optional light mode
- optional overlay action
- optional TV emphasis

## Recommended Rollout
### Phase 1
Define the moment-cue model and UX.

- keep raw soundboard untouched
- document cue families and host buttons

### Phase 2
Add a compact `Moments` strip to the queue page.

- 4-6 buttons max
- volume / mute remains shared with existing SFX controls

### Phase 3
Add optional run-of-show scene cues.

- intros
- reveals
- celebration beats
- transitions

### Phase 4
Add auto-trigger support for key room events.

- show start
- next performer
- reveal
- winner

### Phase 5
Tune mixing, cooldowns, and visual pairings.

## Design Test
If the host sees the moment system and asks:

- "Which one should I click to make this moment land?"

the design is good.

If the host asks:

- "Which of these 18 sounds is the right one?"

the design has failed.

