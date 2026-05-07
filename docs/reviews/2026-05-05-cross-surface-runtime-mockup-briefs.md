# Cross-Surface Runtime Mockup Briefs

Date: May 5, 2026

Audience: Product, Design, CEO Review

## Purpose

These briefs exist to constrain the next round of mockups so they are not invented on the fly.

The goal is to lock:

- visual look and feel
- information hierarchy
- grouping and organization
- cross-surface consistency
- realism against current repo features

This pack assumes the approved product direction:

- experimental host runtime shell
- contextual performer ring around the current performance
- separate playback dock
- hybrid of `Rotation Engine` and `Curated Show Engine`
- current host capabilities preserved behind `Queue`, `Add`, `Inbox`, and `Planner`

## Design System North Star

All mockups should feel like one premium live-show product family.

### Visual Character

- dark, theatrical, premium
- operational, not corporate
- confident, not cute
- tactile enough to feel like an instrument
- legible at a glance

### Surface Language

- charcoal and black foundations
- warm ivory for primary text
- cyan and teal for live/action state
- amber for transition / crowd-energy state
- muted red for real risk or stop state
- soft green for validated or cleared state
- no purple-heavy palette

### Material Feel

- glass + stage-light glow
- thin borders
- soft layered depth
- occasional felt/paper/tactile texture where it helps the control metaphor
- avoid flat enterprise panels

### Interaction Rules

- no detached warning strips
- state belongs to the object that owns the issue
- one dominant live object per screen
- room-wide controls are visually distinct from performance-scoped controls
- deep workflows stay behind explicit entry points

## Shared Runtime Object Model

These mockups should all express the same runtime objects, even if each surface emphasizes them differently:

- current performance
- next performance or scene
- candidate pool
- played history
- post-song track check
- applause / recap transition
- queue and rotation state
- planner / scene library support
- inbox / co-host / moderation escalation

## Cross-Surface Roles

### Host

The host runs the room.

Primary responsibilities:

- control the current performance
- choose or confirm what is next
- resolve track and queue exceptions
- optionally shape the night from a pool of candidates

### Public TV

Public TV tells the room what is happening.

Primary responsibilities:

- celebrate the active performance
- make `Next` legible to the room when appropriate
- support applause, recap, and planned scene moments
- make transitions feel like show beats, not admin state

### Singer / Audience App

The singer app tells one person what they can do now.

Primary responsibilities:

- request or join the queue
- understand where they are in the flow
- react to the current live moment
- optionally help shape the next moment when invited

## Mockup Pack Structure

The next mockup round should be produced as four focused artifacts:

1. Host runtime shell
2. Public TV live state system
3. Singer app runtime shell
4. Cross-surface sequence storyboard

## Brief 1: Host Runtime Shell

### Title

`Host Runtime Shell: Rotation + Curation`

### Objective

Refine the host interface that combines:

- rotation awareness
- curated candidate promotion
- contextual performer ring
- separate playback dock

### Must Reflect Real Repo Features

- `Launch Room` / room readiness in top chrome
- `Queue`, `Add`, `Inbox`, `Planner` as real workspaces
- stage transport and applause
- post-song `Track Check`
- `Fill Next Slot`
- `Auto DJ`
- `Ready Check`
- scene library / moments
- inbox-driven co-host and moderation flow

### Must Show

- one dominant current performer object
- a prominent radial menu around that performer
- a clearly separate lower playback dock
- a visible next/rotation lane
- a curated pool of candidate singers and scenes
- a subtle top chrome with room controls
- queue/add/inbox/planner entry points as depth navigation, not the whole page

### Must Not Show

- giant summary bars
- dashboard metric cards
- a second generic live snapshot panel
- room-wide toggles inside the performer ring
- inbox content scattered through the live center

### Radial Menu Scope

The ring must feel contextual to the current performance.

Good ring actions:

- `End Song`
- `Applause`
- `Return`
- `Track Check`
- `Bonus`
- `Details`

Bad ring actions:

- `Ready Check`
- `Auto DJ`
- `Queue Rotation`
- `Pop Trivia`
- `TV Mode`

### Variants To Generate

- host shell with denser candidate pool
- host shell with stronger rotation lane
- host shell with more restrained theatrical chrome

## Brief 2: Public TV Live State System

### Title

`Public TV: Performance, Transition, and Next-Up Language`

### Objective

Define how Public TV visually responds to the new host runtime shell.

This should not just be one screen.
It should show the TV logic for:

- live performance
- applause
- recap
- next-up reveal
- planned scene takeover

### Must Reflect Real Repo Features

- active performance and playback state
- applause phases
- recap identity
- scene / media takeovers
- crowd reactions
- planned run-of-show moments
- join path / room code where relevant

### Must Show

- a strong live performance state
- a clean next-up moment that can be triggered by host flow
- applause transition that feels like a show beat
- planned scene takeover state for media library / scene moments
- optional crowd-choice or room-choice treatment only if invited by host flow

### Must Not Show

- operator language
- technical queue jargon
- dense host-style controls
- too many simultaneous visual priorities

### Core Design Question

When the host uses the performer ring to end a song or trigger applause, what does TV become?

The mockup should answer:

- how `Now` is celebrated
- how `Next` is announced
- how scenes and singers share the same visual language without looking identical

### Variants To Generate

- more cinematic / event-forward TV
- more practical / venue-legible TV
- hybrid TV with strong readability and still some spectacle

## Brief 3: Singer App Runtime Shell

### Title

`Singer App: Where Am I In The Night?`

### Objective

Refine the audience/singer shell so it reflects the same runtime model as the host shell without becoming cluttered.

The singer app should answer:

- am I on stage?
- am I next?
- am I in the pool?
- can I do anything right now?

### Must Reflect Real Repo Features

- queue join / request flow
- current performance state
- applause participation
- co-host helper affordances
- release-window vote / crowd-choice moments when eligible
- audience reactions
- direct room entry / streamlined shell behavior

### Must Show

- one obvious current state
- one obvious primary action
- a readable personal place in the flow
- clear differentiation between:
  - `on stage`
  - `on deck`
  - `in pool`
  - `waiting`

### Must Not Show

- host-level complexity
- full queue governance controls
- second-guessing about what the user should do
- admin vocabulary

### Core Design Question

If the host surface becomes `rotation + curation`, what does that mean to one singer?

The mockup should show how the singer interprets:

- being in the rotation
- being promoted from the pool
- being invited into a crowd moment
- seeing applause / recap / next-up transitions

### Variants To Generate

- more singer-status-forward shell
- more room-energy-forward shell
- more social / party-forward shell

## Brief 4: Cross-Surface Storyboard

### Title

`One Song Through Three Surfaces`

### Objective

Show the same sequence across:

- host
- Public TV
- singer app

This is the most important sanity check.

### Sequence To Visualize

1. singer is live
2. host performer ring is open
3. song ends
4. applause begins
5. recap / track check / next-up transition
6. next singer or scene promoted

### Must Show

- how the same event is represented differently on each surface
- how the host’s ring action changes TV and singer states
- how post-song `Track Check` remains host-owned
- how `Next` becomes legible to TV and phone without creating confusion

### Must Not Show

- disconnected screens that feel like different products
- TV and singer surfaces that still speak old queue language while host speaks new shell language

## Broad Organizational Guidance

### Host Groupings

The host panel should be organized into:

- current performer
- playback dock
- next/rotation lane
- candidate pool
- depth navigation
- top chrome room controls

### Public TV Groupings

Public TV should be organized into:

- live spotlight
- transition beat
- next-up reveal
- planned scene takeover
- audience invitation when appropriate

### Singer App Groupings

Singer app should be organized into:

- my current state
- my primary action
- room context
- optional invited participation

## Customization Guidance

Mockups should hint at customization, but not let it dominate.

Good customization hints:

- host can choose shell emphasis
- host can choose ring density
- host can choose candidate-pool openness

Bad customization hints:

- giant settings surfaces
- room-policy toggles embedded into the live shell
- personalization that makes the product visually inconsistent

## Recommended Next Render Order

1. Host runtime shell refinements
2. Cross-surface storyboard
3. Public TV system
4. Singer app shell

That order ensures the next visual round is anchored in the host experience but immediately pressure-tested across the real room system.

## Final Constraint

Every mockup in the next round should answer this:

> Does this feel like a stronger way to run a live karaoke room using the features we already have, rather than a different app entirely?

If the answer is no, the mockup has drifted too far from the real product.
