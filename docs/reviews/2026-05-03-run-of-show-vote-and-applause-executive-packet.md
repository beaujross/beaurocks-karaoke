# Run-Of-Show Vote And Applause Executive Packet

Date: May 3, 2026

Audience: CEO, CTO, Chief Product Officer, Chief Marketing Officer

## Topic

We reviewed three related show-flow questions:

- Should an upcoming-song vote be allowed to trigger during a live performance?
- Should that vote become part of the post-performance sequence alongside applause and recap moments?
- Should applause default to no warm-up so the room gets to the live reaction faster?

## Current Product Behavior

- A host-triggered run-of-show release-window vote can currently appear during a live performance.
- If triggered, the audience prompt and Public TV takeover can show immediately.
- There is no current guard that defers that vote until the song ends.
- The post-performance sequence already supports applause and recap behavior, but it does not automatically launch these release-window votes.
- Applause warm-up now defaults to `0s`.
- Applause still keeps a separate countdown before live measurement begins.

## Executive Input

### CTO

CTO read:

- Do not allow a new room-wide vote overlay to interrupt an active performance.
- Protect the performance as the highest-priority live state.
- Keep this change narrow: add sequencing/guardrails, not a new orchestration system.
- The applause default change is correct because it improves pace through configuration, not architecture.

CTO recommendation:

- Block or defer release-window voting while `performing` is active.
- If the host triggers it mid-song, queue it for the first eligible post-performance slot instead of showing it immediately.
- Keep the applause countdown for now; removing that is a separate pacing experiment, not a default-only change.

### Chief Product Officer

CPO read:

- A song vote during a performance is a journey conflict: it asks the room to choose the next thing before the current thing is finished.
- The better product shape is a clean post-song sequence with one emotional beat at a time.
- The applause default improvement is directionally right because it reduces dead air without changing operator complexity.

CPO recommendation:

- Make upcoming-song voting a post-performance moment, not an in-performance interruption.
- Sequence it after the applause capture and before the room fully returns to idle or next-up flow.
- Only inject the vote when there is a real decision to make, such as a queue faceoff or slot-fill choice.
- Preserve host override, but default the product to the sequenced path.

### Chief Marketing Officer

CMO read:

- Mid-song vote prompts dilute the spotlight and weaken the room narrative.
- A vote works better as a deliberate "what happens next" moment after applause, when the room is ready to re-engage together.
- Fast applause entry is good for energy and makes the room feel more responsive.

CMO recommendation:

- Do not put decision UI on top of an active performance unless it is truly essential.
- Use the post-performance sequence to turn voting into a visible crowd ritual on Public TV.
- Keep the TV treatment big, legible, and emotionally framed around the room choosing the next moment together.
- Maintain total-vote visibility only; do not clutter the room with per-option live counts.

## Alignment

The three executive perspectives are aligned on the main point:

- Upcoming-song voting should not interrupt a live performance.
- It should become a sequenced post-performance moment when needed.
- Applause should stay fast by default.

There is one deliberate non-decision:

- We should not remove the applause countdown yet just because warm-up is now `0s`.
- That is a separate product decision with show-pacing implications.

## CEO Brief

Recommendation for CEO approval:

1. Approve the product rule that upcoming-song votes do not surface during a live performance.
2. Approve the default behavior that host-triggered vote requests are deferred into the post-performance sequence when triggered mid-song.
3. Approve the sequence order: performance ends, applause opens, then an optional next-song vote appears if the room actually needs that decision.
4. Approve the faster applause default already implemented: `0s` warm-up, with countdown retained for now.

Why this is the right call:

- It protects the performer moment.
- It makes the room flow easier to understand.
- It turns voting into a stronger shared crowd beat instead of a distraction.
- It improves pace without introducing a risky systems rewrite.

## Proposed CEO Decision

Approve:

- no mid-performance release-window vote overlays
- queued post-performance vote sequencing
- `0s` applause warm-up as the default

Hold for separate review:

- whether applause countdown should also be allowed to hit `0s`

## Next Product Action

If approved, implementation should be scoped as:

- add a live-performance guard for release-window display
- queue host-triggered vote requests until the performance completes
- insert the queued vote into the post-performance sequence at the correct point
- keep the existing large-format Public TV vote treatment
