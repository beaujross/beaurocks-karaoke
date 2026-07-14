# Games and Crowd Interaction Lifecycle Audit

Date: 2026-07-12

## Outcome

The established game identities remain owned by `gameRegistry.js`. A new operational lifecycle overlay classifies when each mode runs and which surfaces own launch, response, reveal, scoring, moderation, and recap. This avoids renaming games or changing live room state while making collisions testable.

## Key Clarification

`Trivia` and `Pop Trivia companion` are not the same product mode:

- `trivia_pop` is an exclusive between-song A/B/C/D round using the shared prompt-vote family.
- `pop_trivia_companion` is tied to an active performance and must not become a standalone takeover.
- `wyr` is another between-song prompt-vote mode and cannot safely run concurrently with Trivia because they share state ownership.

## Lifecycle Classification

| Mode | Kind | Host launch | Audience action | TV reveal | Scoring | Recap | Moderation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Trivia | Between-song | Yes | Answer | Answer/reveal | Yes | Yes | No |
| Would You Rather | Between-song | Yes | Vote | Split/reveal | Yes | Yes | No |
| Pop Trivia companion | Performance companion | Automatic/Host policy | Answer | Overlay/reveal | Yes | Pending | No |
| Bingo | All-night companion | Yes | Mark/confirm | Board/win | Yes | Yes | Yes |
| Doodle-oke | Between-song | Yes | Draw/guess/vote | Gallery/winner | Yes | Yes | Yes |
| Selfie Challenge | Between-song | Yes | Submit/vote | Wall/winner | Yes | Yes | Yes |
| Karaoke Bracket | Standalone tournament | Yes | Perform/vote | Match/champion | Yes | Yes | No |
| Voice cartridges | Standalone or between-song | Yes | Voice/tap | Game-specific | Yes | Partial | No |

## Confirmed Collision Risks

- More than one exclusive takeover can compete for `activeMode` and TV ownership.
- Trivia and Would You Rather share prompt-vote state and require mutual exclusion.
- Pop Trivia companion without an active performance has no valid subject or lifecycle owner.
- Bingo is designed to coexist across the night, but its win/reveal must not steal an active performance-companion overlay without explicit priority.
- Doodle and Selfie require moderation ownership before reveal when review is enabled.

## Next Bounded Implementation

Expose lifecycle kind and collision guidance in Host game selection, then route launch through one guard that rejects incompatible concurrent modes. Do not change individual game scoring or payloads in that checkpoint.
## Lifecycle Slot and Shared Presentation Checkpoint (Completed 2026-07-13)

`resolveGameLifecycleSlots` now projects the legacy room document into separate read-only concepts:

- one exclusive takeover;
- zero or more all-night companions;
- active performance companions;
- configured but dormant performance companions;
- one primary audience/TV moment plus collision risks.

The adapter recognizes a persisted Bingo board while Trivia/WYR owns the current takeover and only activates Pop Trivia when a performance subject exists. It does not change `activeMode`, game payloads, scoring, or Firestore writes.

Completed integration evidence:

- Run of Show game starts use one room-aware preflight before mutation and receive the resolved lifecycle slots with the compatibility result.
- Audience and TV consume one shared presentation resolver; lifecycle cards expose the owning slot and normalized mode as diagnostic data attributes.
- Dormant Pop Trivia stays silent, explicit Pop Trivia owns the performance-companion slot, persisted Bingo does not masquerade as a takeover, and active surface ownership rejects unsafe cross-kind starts.
- Full stability gates passed at 264 unit-test files / 940 tests, full lint with zero errors, and a production build.
- Hosting deployed successfully. A narrowed production matrix then passed Host launch, Audience interaction/guidance, TV guidance, and normal End Mode for Trivia, Would You Rather, and Bingo in fresh QA rooms.
- The matrix itself was hardened to reject `ALREADY` as a false room code, accept current WYR result language, and select the lifecycle bundle containing each game before looking for its quick-launch card.

Next bounded checkpoint: route direct quick and configured launches inside `UnifiedGameLauncher` through the same preflight before any room mutation. Keep game scoring, payload schemas, and stored lifecycle state unchanged.

## Unified Launcher Preflight and Production Collision Closure (Completed 2026-07-13)

The direct Host launcher now uses the same room-aware lifecycle preflight as Run of Show before any game setup or room mutation:

- Quick Launch checks the requested mode before changing participant defaults, opening fallback configuration, or calling a mode start.
- Every configured callback that can make a mode live is wrapped, including Trivia, Would You Rather, Bingo, Doodle-oke, Selfie Challenge, voice games, team/volley/musical rounds, and bracket queue/go-live actions.
- Preview, content authoring, bracket creation, scoring, winner selection, and clear operations remain outside launch preflight because they do not claim a live lifecycle slot.
- Re-launching or advancing the currently active Trivia/WYR mode remains allowed; incompatible takeover, companion-displacement, shared-state, and performance-subject cases return actionable Host guidance.
- No scoring formula, game payload, Firestore schema, stored lifecycle field, or BeauBucks behavior changed.

Release evidence:

- Focused lifecycle/launcher checks passed, then the complete unit suite passed at 267 files / 947 tests.
- Targeted launcher and QA lint passed; full repository lint passed with zero errors and the established warning baseline.
- The Vite production build passed and Hosting release `d1581e4d336f5020` finalized successfully on 2026-07-13.
- Authenticated production acceptance followed the real Host workflow through the compact live-game summary and `Open Launcher Drawer` recovery action.
- Live Trivia blocked a Bingo start and remained `trivia_pop`; Audience response, TV reveal, interaction, and End Mode also passed.
- Live Bingo blocked a Would You Rather takeover and remained `bingo`; Audience companion guidance, TV board, interaction, and End Mode also passed.

Next bounded checkpoint: package the shipped launch simplification as before/after persona evidence for the executive roadmap. Capture the three timing bundles, live-game drawer, shared Audience/TV guidance, and collision recovery. Measure whether a Host can identify the right bundle and return to launch controls in no more than two deliberate actions. Do not reopen game mechanics or lifecycle schemas in that evidence slice.

## Compact Live Switcher Production Closure (Completed 2026-07-13)

The live Host drawer now uses a presentation-only compact card variant while preserving the lifecycle bundle and launch contracts:

- live recovery remains `Games` then `Open Launcher Drawer` (`2` deliberate actions);
- the timing model remains Between songs, Alongside karaoke, and Full-screen rounds (`3` choices);
- visible compact cards expose at most `Configure` plus one primary action;
- standard setup cards and configuration depth remain available outside the live-switching context;
- the active moment remains live until a compatible start succeeds.

Release evidence is `268` unit-test files / `951` tests, full lint with zero errors, a passing production build, Hosting release `8a0fc00146a6f351`, deterministic screenshot metrics, and authenticated production acceptance for Trivia and Bingo. Both collision paths preserved their original live mode, and Audience, interaction, TV, and End Mode passed.

No game scoring, payload, schema, persistence, economy, Run of Show, or content-provider behavior changed. The next checkpoint is executive cross-workstream evidence packaging, not another game-mechanics expansion.
