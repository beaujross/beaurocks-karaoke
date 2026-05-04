# AAHF Event War Room Brief

Date: May 1, 2026
Event: AAHF Karaoke Kick-Off
Room: `AAHF`
Goal: stability first for tonight's live event

## Status

- Live hosting deploy completed on May 1, 2026.
- AAHF Media Library now includes the two new assets:
  - `Karaoke Kickoff Mama Fong`
  - `Atticus Kick Off Video`
- AAHF scene count increased from `13` to `15`.

## Decision Rule

For tonight, success means:

1. Guests can join reliably.
2. Host can operate the room without auth or media blockers.
3. TV remains in sync with the live room state.

Anything outside those three goals is secondary and may be deferred until after the event.

## Known Risks

### P0

- Audience join can bottleneck on shared venue Wi-Fi because join traffic is rate-limited per IP.
- Prod App Check behavior is unstable in real sessions and can create intermittent action failures.

### P1

- The stage `Open Media Library` launcher still appears unreliable in production.
- Host, TV, and audience surfaces all subscribe to broad room collections, which increases live fanout load.
- Cold load size is still heavy for weaker mobile devices and congested networks.

## Ownership

### CTO

- Owns event-mode technical readiness.
- Decides whether to:
  - raise or relax join-path limits for tonight
  - increase function headroom
  - reduce App Check friction for event-critical flows
  - route hosts to a fallback media workflow if the stage launcher remains broken
- Runs final go/no-go on production readiness.

### Chief Product Officer

- Owns scope discipline.
- Declares a stability freeze for the remainder of May 1, 2026.
- Limits changes to P0 join, auth, host control, TV sync, and recovery fixes only.

### Chief Marketing Officer

- Owns guest-facing clarity.
- Confirms QR, room code, and join instructions all match the live flow.
- Prepares one short fallback message for delays, refreshes, or retry guidance.
- Removes or suppresses any extra copy that slows guests down at doors-open.

### Customer Service Lead

- Owns real-time issue handling.
- Assigns:
  - one host-support owner
  - one guest-support owner
  - one incident scribe
- Keeps a live escalation channel open to the CTO for production issues.

## Must-Run Checks Before Doors Open

1. Verify multiple guests can join from the same venue network without being blocked.
2. Verify host login, room entry, queue controls, and TV sync in production.
3. Verify the host has a working fallback for media playback if the stage media launcher misbehaves.
4. Verify the room code, QR, and marketing copy point to the same live join path.
5. Confirm support staff have the runbook and escalation chain.

## Freeze Policy

- No new features.
- No visual polish changes unless they remove confusion in a critical flow.
- No refactors.
- No deploys after the readiness check unless approved by the CTO and CPO together.

## Escalation Threshold

Escalate to the CTO immediately if any of the following happen:

- more than a few guests fail to join from the same network
- host login or host controls fail
- TV stops tracking room state
- media playback controls fail during live operation
- App Check or auth failures appear in active event flows
