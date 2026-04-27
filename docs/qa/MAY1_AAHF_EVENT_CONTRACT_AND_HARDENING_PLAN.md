# May 1 AAHF Event Contract And Hardening Plan

## Purpose

This document defines what the product is expected to do on May 1 for the AAHF karaoke event, what is optional, what should stay out of the critical path, and how engineering should spend hardening time without creating unnecessary test sprawl.

The goal is not repo-wide coverage. The goal is event confidence.

## Implemented Hardening Status As Of 2026-04-27

The following hardening work has already been landed against this contract:

- Singer-side logic extraction for deterministic testing:
  - `src/apps/Mobile/lib/reactionCooldowns.js`
  - `src/apps/Mobile/lib/coHostSignalPayload.js`
  - `src/apps/Mobile/lib/audienceAccessPresentation.js`
  - `src/apps/Mobile/lib/singerHomeState.js`
- Host/discover-side logic extraction for deterministic testing:
  - `src/apps/Host/lib/openSlotSuggestions.js`
  - `functions/lib/discoverVisibility.js`
- Behavior and contract coverage added for:
  - reaction/applause cooldown isolation
  - karaoke-first AAHF access presentation
  - co-host `Tell Host` payload context
  - streamlined Singer idle-home state
  - host open-slot suggestion logic
  - public discover filtering
  - optional-mode smoke/runtime coverage for Trivia, Would You Rather, Doodle Oke, and Selfie Cam

This document should now be treated as both the event contract and the rationale for why those extracted helpers and tests exist.

## Product Rules

- Keep the room karaoke-first.
- Keep co-hosts helpful but narrow.
- Keep the Singer app simple and low-friction.
- Reuse existing primitives and flows wherever possible.
- Add tests only when they protect a real event behavior, enable safe simplification, or guard extracted logic that is likely to regress.

## Event Contract

### Core

These flows are release-blocking for May 1. If any of them break, the event experience is meaningfully degraded.

- AAHF join from QR/link
- Emoji selection
- Name entry and room entry
- Streamlined Singer home
- Search and request flow
- Moderated queue messaging after request
- Queue viewing
- Audience reactions
- Applause meter
- Co-host helper catalog
- Co-host `Tell Host` audio path
- Host queue management
- Host `Fill Next Slot`
- Host `Fill All Suggested`
- Official discover filtering for public event visibility
- TV basic live-room display

### Optional

These features are allowed and worth light hardening, but the room must not depend on them to operate smoothly.

- Co-host song face-off vote
- Co-host slot-fill choice vote
- Donation/support QR moments on TV
- Passive co-host long-ahead queue building through helper catalog
- Trivia mode
- Would You Rather
- Doodle Oke
- Selfie Cam

### Off For May 1 Critical Path

These are not part of the event contract and should not drive release-blocking work.

- Vocal games
- Any experimental audience mini-games or side experiences not explicitly listed above

## What The Tests Are Supposed To Achieve

The expected result of the hardening effort is:

- Fewer live-event surprises
- Safer simplification of Singer, co-host, and host surfaces
- Faster iteration during the final event-prep window
- Less dependence on broad manual QA
- Better confidence in real room behavior, not prettier coverage numbers

The expected result is not:

- Maximum repo-wide coverage
- Snapshotting every UI branch
- Preserving accidental complexity through over-testing

## Test Strategy

## Lane 1: Release-Blocking Confidence

These tests should be the strongest and most deterministic.

### Audience

- Join from AAHF QR/link into emoji selection
- Complete name entry and room entry
- Land on streamlined Singer home
- Open search/request flow
- Submit request and see correct moderated queue messaging
- Use reactions with per-button cooldown isolation
- Use applause without shared cooldown collisions

### Co-Host

- Launch helper catalog
- Select singer target
- Add multiple songs for the same singer
- Open `Tell Host`
- Send `Track Up`, `Track Down`, `Vocal Up`, `Vocal Down`, and `Mix Issue`
- Verify active performance context is attached when available

### Host

- See correct official discover behavior
- Receive co-host audio signals in the intended live-ops surface
- Use `Fill Next Slot`
- Use `Fill All Suggested`

### TV

- Basic live-room display still reflects the current room state cleanly

## Lane 2: Optional-Feature Smoke And Graceful Failure

These features should not get the same depth of automation as core flows. The goal is to verify they can launch, work at a basic level, and fail without taking down the room.

- Trivia mode can launch and recover cleanly
- Would You Rather can launch and recover cleanly
- Doodle Oke can launch and recover cleanly
- Selfie Cam can launch and recover cleanly
- Co-host voting moments can open and close cleanly
- TV support QR moments can surface without disrupting the live room

If any optional feature remains too unstable to smoke meaningfully, it should be demoted in the surfaced event experience rather than receiving deep last-minute test investment.

## Lane 3: Logic Extraction For High-Payoff Coverage

Do not broadly refactor giant files. Extract only the smallest pure logic units that improve testability and tuning speed.

Recommended extraction targets:

- `src/apps/Mobile/lib/reactionCooldowns.js`
  - per-button cooldown timing
  - cooldown labels
  - cooldown state lookup
- `src/apps/Mobile/lib/coHostSignalPayload.js`
  - `Tell Host` payload shaping
  - performance/song/timestamp context
- `src/apps/Mobile/lib/audienceAccessPresentation.js`
  - karaoke-first AAHF presentation rules
- `src/apps/Mobile/lib/singerHomeState.js`
  - streamlined idle home state decisions
- `src/apps/Host/lib/openSlotSuggestions.js`
  - `Fill Next Slot` and `Fill All Suggested` suggestion logic
- `src/apps/Host/lib/helperCatalogSingerTargeting.js`
  - helper singer-target persistence and queue payload shaping

## Lane 4: Convert Weak Tests Into Better Tests

Some current tests are useful tripwires but weak as confidence signals. Keep them if they are cheap, but add behavior tests where it matters.

Recommended conversions:

- `tests/unit/aahfAudienceMonetizationSource.test.mjs`
  - add a runtime presentation test for karaoke-first AAHF access behavior
- `tests/unit/discoverHostRoomSource.test.mjs`
  - add a behavior-level discover filtering test
- `tests/unit/hostLiveOpsPanelSource.test.mjs`
  - add a rendered host live-ops signal behavior test
- `tests/unit/singerRunOfShowGovernanceSource.test.mjs`
  - add a rendered co-host prompt behavior test
- `tests/unit/eventCreditsConfigPanelSource.test.mjs`
  - add a behavior/state serialization test

## Lane 5: Small Release Gate

Before May 1, require a small Playwright gate. Keep it short and deterministic.

Recommended release-gating flows:

1. AAHF audience join and request
2. AAHF reaction cooldown behavior
3. Co-host helper catalog add flow
4. Co-host `Tell Host` flow
5. Host slot-fill flow
6. Public discover official-listing check

Optional features should not be added to the release gate unless they become central to the event contract.

## Simplification Plan

Hardening should also reduce surface complexity wherever that makes the product easier to run and easier to test.

### Singer App

- Keep one obvious primary action per state
- Keep support/donation secondary to karaoke participation
- Keep co-host primary phone UX limited to audio feedback
- Avoid crowding idle home with secondary utilities

### Co-Host Experience

- Use the helper catalog as the main operational assist surface
- Keep phone-based co-host actions binary and fast
- Keep `Tell Host` contextual and lightweight

### Host Experience

- Keep live room issues in live ops
- Keep moderation in inbox
- Keep run-of-show approvals in run-of-show
- Avoid duplicating incoming attention across multiple surfaces

### Optional Modes

- Do not over-promote unstable optional modes
- Favor "available but contained" over "prominent and flaky"
- If an optional mode is unstable, it should fail quietly and not derail the karaoke path

## Two-Bucket Priority Model

Use this when deciding work over the next few days.

### P0: Release Blocking

- Core event flows
- Extracted logic that directly protects those flows
- Small Playwright gate

### P1: Confidence Expanding

- Adjacent Singer/co-host/host behaviors
- Optional feature smoke and graceful-failure checks
- Runtime tests replacing weak source-only assertions

## Success Criteria

By May 1, success looks like this:

- Core audience/co-host/host flows are protected by deterministic tests
- Optional features are smoke-checked and do not destabilize the room
- The experience is simpler than it is today, not more complex
- We can keep tuning quickly without guessing what broke
