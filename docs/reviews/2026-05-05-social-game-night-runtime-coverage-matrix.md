# Social Game Night Runtime Coverage Matrix

Date: May 5, 2026

Audience: Product, Design, Engineering

## Purpose

This document answers two questions before implementation starts:

1. What functionality must survive the new runtime experiment?
2. How do we support hosted, co-hosted, and audience-led nights without stuffing the host shell full of controls?

This is the practical companion to the main plan:

- [2026-05-05-social-game-night-runtime-experiment-plan.md](<C:\Users\beauj\Desktop\beaurocks-karaoke\docs\reviews\2026-05-05-social-game-night-runtime-experiment-plan.md:1>)

## Core Principle

We are not redesigning around one perfect host screen.
We are redesigning around one shared runtime language with different emphasis by mode.

That means:

- no core capability gets orphaned
- no one screen tries to show everything
- the host eye-line stays clean
- deeper capabilities stay reachable and coherent

## Existing Capability Inventory

The current repo already spans more than a single host panel.
The experiment has to account for all of these surfaces and control families.

### Host Runtime

Anchors:

- [HostQueueTab.jsx](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Host\components\HostQueueTab.jsx:1>)
- [StageNowPlayingPanel.jsx](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Host\components\StageNowPlayingPanel.jsx:1>)
- [QueueListPanel.jsx](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Host\components\QueueListPanel.jsx:1>)
- [RunOfShowQueueHud.jsx](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Host\components\RunOfShowQueueHud.jsx:1>)
- [HostTopChrome.jsx](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Host\components\HostTopChrome.jsx:1>)
- [HostInboxPanel.jsx](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Host\components\HostInboxPanel.jsx:1>)

Capabilities that already exist:

- stage transport
- applause flow
- post-song track check
- queue movement and hold/restore
- fill-next and fill-open-slot helpers
- automation toggles
- queue rule controls
- room launch and media controls
- inbox, moderation, and co-host communication

### Host Workspace Depth

Anchor:

- [navConfig.js](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Host\workspace\navConfig.js:1>)

Views that must remain reachable even if not all are center-stage:

- `ops`
- `queue`
- `show`
- `audience`
- `media`
- `games`
- `billing`
- `advanced`

### Room Orchestration

Anchor:

- [roomFlowOrchestrator.js](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Host\roomFlowOrchestrator.js:1>)

Flow families that must still map cleanly into the design:

- performance live
- applause flow
- ready check live
- auto crowd moment live
- between-singers bridge
- dead-air recovery
- run-of-show hold / blocked / queue-fill states

### Audience and Shared Participation

Anchors:

- [audienceShellVariant.js](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Mobile\audienceShellVariant.js:1>)
- [AudienceQaHarness.jsx](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Mobile\AudienceQaHarness.jsx:1>)
- [qaAudienceFixtures.js](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\apps\Mobile\qaAudienceFixtures.js:1>)
- [runOfShowDirector.js](<C:\Users\beauj\Desktop\beaurocks-karaoke\src\lib\runOfShowDirector.js:1>)

Capabilities that already exist:

- audience shell variants
- applause cooldown and reaction behavior
- co-host vote windows
- crowd vote windows
- trivia / WYR takeovers
- room-specific audience branding and access behavior

## Surface Ownership Model

This is the ownership split the experiment should enforce.

### Host Console Owns

- current performance control
- wrap-up actions
- next-up preparation
- queue and scene shaping
- exception handling

### Public TV Owns

- live performance spotlight
- applause / recap beat
- next-up narrative
- room-scale vote or takeover moments

### Audience App Owns

- simple state-appropriate participation
- cheering, reacting, voting
- support for next-up or crowd moments when invited

### Depth Workspaces Own

- setup
- diagnostics
- moderation details
- billing
- advanced media and overlay configuration
- rich planning workflows

## Capability Placement Matrix

### Must Stay In The Main Host Eye-Line

- current performer
- end / applause / wrap controls
- playback state
- next performer
- track blocker or readiness state on the next object
- small rotation context
- attention indicator

### Must Be Reachable In One Click Or One Tap

- `Queue`
- `Add`
- `Inbox`
- `Planner`
- queue rules
- `Ready Check`
- `Auto DJ`
- `Fill Next Slot`
- scene picker / candidate pool
- moderation summary
- room launch / media controls

### Can Live In Depth Navigation

- full moderation queue
- detailed monetization / tips controls
- diagnostics and QA
- billing and usage
- advanced overlay and marquee settings
- longer-horizon show planning

If any item in this third bucket is needed during a live song-ending transition, it should still emit an attention signal into the runtime shell.

## Mode Emphasis Matrix

The same runtime model should support different night styles by changing emphasis, not by creating new products.

### `hostLed`

Primary surface:

- Host Console

Secondary surfaces:

- Public TV
- Audience App

Decision authority:

- host confirms what is next

Audience behavior:

- reacts during the song
- participates during explicit applause or vote windows

Must feel like:

- the host is in command without being overloaded

### `collaborative`

Primary surfaces:

- Host Console
- co-host / inbox pathways

Decision authority:

- host runs live performance
- co-hosts can influence next-up or release-window outcomes

Audience behavior:

- mostly reactive
- may participate in selected room-wide moments

Must feel like:

- operator and producer can share the room without stepping on each other

### `audienceLed`

Primary surfaces:

- Public TV
- Audience App

Host surface role:

- optional supervisor
- fallback override path

Decision authority:

- rotation and audience vote logic drive the room more often

Audience behavior:

- reacts during songs
- helps decide what happens next during transition windows

Must feel like:

- the room can self-run without feeling chaotic

### `curatedShowcase`

Primary surfaces:

- Host Console
- Public TV

Decision authority:

- host or producer shapes the night more tightly

Audience behavior:

- participates when invited
- follows a more composed sequence

Must feel like:

- deliberate show composition with karaoke warmth still intact

## Feature Retention By Mode

### Queue Rotation

- `hostLed`: visible but secondary to live performer and next-up
- `collaborative`: visible plus shareable with co-host decision support
- `audienceLed`: becomes one of the primary fairness rails
- `curatedShowcase`: visible but can be overridden by planned moments

### Candidate Scenes / Crowd Moments

- `hostLed`: host promotes them intentionally
- `collaborative`: host or co-host can shape them
- `audienceLed`: audience may vote on some of them
- `curatedShowcase`: planner and run-of-show drive them heavily

### Applause

- always preserved
- host can trigger / monitor it
- Public TV must celebrate it
- Audience App must support it cleanly

### Post-Song Track Check

- always preserved
- owned by host workflow
- may surface as attention item if deferred
- should not overload the Public TV or Audience App

### Ready Check

- preserved as room-wide control
- never belongs inside the performer ring
- may matter less in audience-led rooms, but cannot disappear

### Auto DJ / Automation

- preserved as room-wide orchestration
- should influence runtime state without dominating the visual center
- especially important for low-host and audience-led rooms

### Crowd Vote / Co-Host Vote

- preserved as a first-class mode capability
- default timing should stay aligned to transition windows
- Public TV and Audience App should carry the room-facing expression
- host shell should show status and override path, not necessarily detailed vote UX at center

### Trivia / WYR / Games

- preserved as takeover-capable modes
- not permanently visible in the host eye-line
- should integrate as runtime states, not as bolted-on unrelated screens

### Moderation / DMs / Collaboration

- preserved through inbox and attention pathways
- can move out of center-stage UI
- cannot become invisible during live ops

## Phase 1 Must-Not-Break Checklist

Before phase 1 is considered safe, all of the following should still be true:

- host can run a live song from the experimental shell
- host can end and wrap the current performance
- host can see who is next
- host can access transport separately from contextual performer actions
- host can reach `Queue`, `Add`, `Inbox`, and `Planner`
- queue rules and automation remain reachable
- `Ready Check` and `Auto DJ` remain reachable
- applause still works across host, TV, and audience states
- track check still has a coherent host-owned path
- existing audience reaction flows still make sense
- no core crowd-vote or co-host-vote path becomes impossible

## Design Review Checklist

Every mockup or implementation review should answer:

1. Can the host identify the current live object instantly?
2. Can the host identify the next live object instantly?
3. Are room-wide controls clearly separate from performance controls?
4. Is the Audience App doing only what the audience needs right now?
5. Does the Public TV look like a room-facing stage system, not software?
6. Could this same structure still support an audience-led night?
7. Did we remove clutter without hiding something operationally critical?

## Engineering Review Checklist

Before starting implementation, engineering should confirm:

- no second queue system is being introduced
- no second run-of-show system is being introduced
- the new shell can derive from current `HostQueueTab` state
- room mode emphasis can be modeled without a full fork
- host-only prefs stay separate from room policy
- phase 1 scope is visually ambitious but behaviorally conservative

## Recommendation

Proceed with implementation only if the experiment is treated as:

- a new runtime shell
- a shared cross-surface state language
- a mode-extensible system

Do not proceed if the shell is allowed to become:

- host-only
- host-overloaded
- visually pretty but operationally incomplete
