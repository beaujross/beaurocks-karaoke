# One-Minute Mic Production Hardening Plan

Date: 2026-06-30
Status: Draft for product inclusion
Owner surface: Host room setup, Host top chrome queue menu, Cloud Functions automation

## Executive Summary

One-Minute Mic and crowd-driven karaoke should expand the product without changing the contract of standard hosted karaoke. The production bar is explicit mode separation: full-song host-led rooms must keep behaving like full-song host-led rooms, while crowd-driven rooms may allow the audience and automation to open decisions, rotate singers, run applause, finalize recaps, and advance the queue.

The product should present this as a room control model, not as scattered technical toggles.

## Product Modes

### Host-Led

- Full songs are the default.
- Host owns queue pacing, skips, rewards, and end-of-song decisions.
- Auto-DJ is off.
- One-Minute Mic decisions are disabled and any active continue/rotate or skip-performance decision is cleared when restoring this mode.

### Assisted Host

- Full songs remain protected.
- Host keeps authority, but Auto-DJ may help between performances.
- Crowd decisions are not allowed to cut a performance short unless a specific protected decision is opened.

### Crowd-Driven

- One-Minute Mic is enabled.
- Auto-DJ is enabled.
- The crowd can decide whether a singer earns more than the opening minute.
- Protected intervention decisions require high support before moving to the next singer.

### Fully Automated Party

- Future target, not the default production claim until the full capability contract is hardened.
- Requires explicit capabilities for opening decisions, ending performances, advancing the queue, issuing rewards, and handling no-show/blocked-song recovery.

## Production Protections

Backend automation must only act when all relevant gates pass:

- The room is explicitly One-Minute Mic via `oneMinuteMicEnabled === true` or `performanceProgressionMode === "one_minute_mic"`.
- The room is in `karaoke` mode.
- The active decision matches the current `songId` and `sessionId`.
- A one-minute continue/rotate decision has not already been opened for the same song/session/opening window.
- Auto-DJ advancement only runs when no current performance session or performance meta exists.
- Server-side finalize only consumes commands with `source: "one_minute_mic"` and `status: "server_started"`.
- Sensitive intervention votes require minimum vote and threshold checks, currently 8 votes and 70% for `Move To Next`.

## Compute And Read/Write Hygiene

Scheduled functions should be safe to leave enabled for rooms that opt in.

Required hygiene:

- Query only eligible rooms: One-Minute Mic enabled or `performanceProgressionMode === "one_minute_mic"`.
- Keep room query limits tight.
- Return no-op immediately when a room is not in karaoke, has no active performance, has no decision to resolve, has no finalize-ready command, or is still inside the Auto-DJ hold.
- Do not write heartbeats from scheduled automation.
- Write only on state transitions: vote opened, vote resolved, applause started, recap finalized, or next song advanced.
- Read queue candidates only after the room is actually eligible to advance.
- Limit queue candidate reads to a small bounded set.
- Use dedupe keys such as `oneMinuteMicLastDecisionKey` so the same song cannot repeatedly open votes.
- Ignore stale decisions that do not match the current performance.
- Add counters for rooms scanned, no-ops, opened, resolved, finalized, advanced, and skipped-by-reason before broad rollout.

## UX And UI Consistency

### Setup Surface

Room setup should own launch-time intent. The user should answer: who drives this room?

The setup screen should show a clear room control model group:

- Host-Led
- Assisted Host
- Crowd-Driven

This group belongs near Automation Defaults + Policy because it decides the room's default authority and pacing. Setup copy should explain that Host-Led protects full songs, Assisted Host keeps full songs with automation support, and Crowd-Driven enables One-Minute Mic plus Auto-DJ.

### Host Panel Dropdown

The host panel queue dropdown should expose the same room control model as a live override:

- Host-Led: restores full songs and disables Auto-DJ.
- Assisted Host: restores full songs and enables Auto-DJ.
- Crowd-Driven: enables One-Minute Mic and Auto-DJ.

The dropdown should then show detailed controls in this order:

1. Room control model
2. Host assist style
3. Song length and One-Minute Mic timing
4. Request, queue, search, and ready-check details

This keeps the interaction consistent: choose the operating model first, then tune the underlying mechanics.
### Audience Display Control Model

Audience-on-TV controls should follow the same hierarchy as room automation controls:

- Room setup owns the operating model: Host-Led, Assisted Host, or Crowd-Driven. This is a launch-time intent decision.
- Audience > On TV owns persistent casting configuration: selected guests, Commentator Row, Lobby Wall, reaction visibility, and role-based fills like co-hosts or most-active guests.
- The TV dropdown owns fast show-time toggles only: Off, Commentator Row, and Lobby Wall.

This prevents dropdown navigation from becoming a second setup screen while still giving the host a fast way to turn the audience layer on or off during a live night. Any mode that changes who participates, who is selected, or how reactions behave belongs in the Audience tab. Any action that simply changes what Public TV is showing now can live in the TV dropdown.

## Acceptance Criteria

- Full-song host-led rooms never open one-minute votes.
- Full-song host-led rooms never auto-end a song at the one-minute mark.
- Switching to Host-Led clears active `continue_or_rotate` and `skip_performance` room decisions.
- Crowd-Driven explicitly enables One-Minute Mic and Auto-DJ.
- Assisted Host explicitly keeps `performanceProgressionMode: "full_song"`.
- Room setup and the host dropdown use the same labels for the same concepts.
- Tests cover the UI labels and field bundles.
- Scheduled automation has no-op fast paths and bounded reads.

## Next Implementation Slices

1. Harden mode isolation tests across backend automation and HostApp source.
2. Add no-op reason counters to the scheduled automation result.
3. Add a compact automation status strip to the host panel showing current room control model, song length mode, Auto-DJ state, and active crowd decision.
4. Promote the room control model into a normalized helper if additional modes are added.
5. Add production telemetry for automation reads, writes, no-op reasons, and state transitions.