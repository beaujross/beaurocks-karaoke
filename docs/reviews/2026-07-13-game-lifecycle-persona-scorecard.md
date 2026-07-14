# Game Lifecycle Persona and Executive Scorecard

Date: 2026-07-13
Status: Compact Live Switcher completed, deployed, and production-accepted

## Decision

The shipped lifecycle simplification is safe and materially clearer than the documented primitive-heavy baseline. It is approved for continued production use.

The next bounded UI change should be a presentation-only `Live Switcher` variant inside the existing launcher drawer. It should preserve the three timing bundles and every current launch/configuration path while reducing each visible live-drawer game card to two immediate decisions:

1. `Quick Launch`
2. `Configure`

Preview, participant targeting, category/voice metadata, visual-mechanic pills, smart-default details, and other setup context should remain in the standard launcher or configuration modal rather than competing with live moderation.

## Evidence Sources

- Documented baseline: [Host Runtime Shell Executive Packet](2026-05-05-host-runtime-shell-executive-packet.md)
- Executive guardrails: [Social Game Night Runtime Executive Review Addendum](2026-05-05-social-game-night-runtime-executive-review-addendum.md)
- Approval model: [Host Settings Executive Signoff Scorecard](2026-05-09-host-settings-executive-signoff-scorecard.md)
- Program plan: [Original Plan Program Roadmap](2026-07-11-original-plan-program-roadmap.md)
- Lifecycle contract and production evidence: [Games Lifecycle Audit](2026-07-12-games-lifecycle-audit.md)
- Current visual evidence manifest: [Game Lifecycle Evidence Manifest](evidence/2026-07-13-game-lifecycle/after/manifest.json)

Historical screenshots of the original primitive-only launcher are not available in the evidence set. This review therefore uses the documented baseline and current deterministic screenshots; it does not fabricate a visual `before` state.

## Baseline to Current Mapping

| Product question | Documented baseline | Current production behavior | Result |
| --- | --- | --- | --- |
| When should this game run? | Lifecycle ownership was implicit and every primitive competed in one launcher. | Three intent-led bundles: Between songs, Alongside karaoke, Full-screen rounds. | Passed |
| What owns the room now? | Active mode, performance companion, and persistent companion concepts could collide. | Shared lifecycle slots distinguish takeover, all-night companion, performance companion, and primary presentation. | Passed |
| Can an incompatible game replace the live mode accidentally? | Launch functions could write room state independently. | Run of Show, Quick Launch, and configured starts share one room-aware preflight. | Passed |
| What should the audience do? | Mode-specific screens could explain phases differently. | Audience and TV share one phase/action/reveal presentation contract. | Passed |
| Can the Host recover launch controls while live? | Live focus and deep controls competed for the same eye-line. | `Games` then `Open Launcher Drawer`: two deliberate actions. | Passed |
| Is the reopened live launcher cognitively narrow? | Prior governance required a brutally focused host eye-line. | The full standard card returns, exposing setup metadata and at least five common controls per card. | Follow-up required |

## Measured Decision Load

### Standard timing choice

- Top-level timing decisions: `3`
- Labels are plain-language and mutually distinct.
- Each choice includes a one-sentence host cue.
- Pop Trivia companion remains separate from standalone Trivia.

### Live recovery path

1. Select `Games` from the live controlpad or Host navigation.
2. Select `Open Launcher Drawer`.

Measured deliberate actions: `2`
Target: `<= 2`
Result: `pass`

### Live drawer card load

A common card can expose:

- participant scope: `All` / `Select`;
- `Configure`;
- `Quick Launch`;
- `Preview on TV`;
- optional next/stop controls;
- three visual-mechanic pills;
- category and voice metadata;
- up to three capability badges;
- smart-default details.

This is appropriate during setup but exceeds the intended live-switching job. The follow-up target is two immediate controls per card, with setup depth preserved behind `Configure`.

## Executive Signoff

### CTO

- status: `approved_with_follow_up`
- evidence:
  - one pure lifecycle-slot adapter;
  - one room-aware compatibility preflight;
  - shared Host, Audience, and TV presentation contracts;
  - 268 unit-test files / 951 tests;
  - full lint, production build, Hosting release, and authenticated collision acceptance.
- required follow-up:
  - implement compact mode as a render-only variant over existing callbacks;
  - do not add room fields, persistence, scoring, or orchestration branches;
  - retain standard launcher and configuration paths as rollback-safe escape hatches.

### Chief Product Officer

- status: `approved_with_follow_up`
- evidence:
  - top-level game choice is reduced to three timing intents;
  - live recovery meets the two-action goal;
  - collision copy tells the Host what must finish.
- required follow-up:
  - live drawer should answer one question: `What moment do I want next?`;
  - hide setup-only metadata in live-switching context;
  - retain `Configure` for deliberate exceptions.

### Chief Marketing Officer

- status: `approved_with_follow_up`
- evidence:
  - `Launch a crowd moment` and timing-led language support the content-agnostic party-game position;
  - Host, Audience, and TV feel like one branded interaction system;
  - collision recovery is confident and non-technical.
- required follow-up:
  - compact live cards should retain BeauRocks color, iconography, and theatrical energy;
  - do not regress to generic list rows or enterprise admin styling;
  - keep provider/content-source language out of the live game switcher.

### UX / Design

- status: `approved_with_follow_up`
- evidence:
  - timing hierarchy, active-mode ownership, and recovery path are visible;
  - progressive disclosure already exists at the drawer level;
  - current collision toast is actionable.
- required follow-up:
  - add a distinct compact card hierarchy for live switching;
  - keep touch targets and focus order intact;
  - expose a short cue that the current game remains live until a compatible start succeeds.

## User Persona Review

| Persona | Status | Current benefit | Remaining friction |
| --- | --- | --- | --- |
| Primary Host | `approved_with_follow_up` | Understands when modes belong and can recover controls in two actions. | Full cards require scanning setup detail during live pressure. |
| Co-host | `approved_with_follow_up` | Shares the same timing vocabulary and collision protection. | Needs a faster switch surface when assisting the primary Host. |
| Singer | `approved` | Receives a clear required action without learning Host mechanics. | None in this bounded slice. |
| Non-singer guest | `approved` | Can participate in Trivia/Bingo without karaoke-specific knowledge. | Keep lifecycle labels short on smaller devices. |
| Venue/operator | `approved_with_follow_up` | Unsafe mode replacement is blocked and recovery is explicit. | Compact switching should preserve deliberate configuration access. |
| Remote/TV viewer | `approved` | Shared screen consistently owns prompt and reveal context. | None in this bounded slice. |

## Bounded Live Switcher Specification

### In scope

- Pass a presentation-only compact/live-switching flag from the existing Host drawer to `UnifiedGameLauncher`.
- Preserve the three timing-bundle choices.
- Preserve Pop Trivia companion as a distinct alongside-karaoke control.
- Render compact cards with game identity, short description, lifecycle-relevant state, `Quick Launch`, and `Configure`.
- Keep the shared preflight on every start.
- Add source-contract coverage and deterministic screenshots.

### Out of scope

- game scoring or reward changes;
- game payload or Firestore schema changes;
- new lifecycle persistence;
- changes to Run of Show orchestration;
- BeauBucks or Points changes;
- provider/catalog/music changes;
- removal of standard launcher controls.

## Definition of Done

1. Live recovery remains no more than two deliberate actions.
2. Each compact game card exposes no more than two immediate action buttons.
3. Standard launcher cards remain unchanged outside live-switching context.
4. Trivia-to-Bingo and Bingo-to-WYR collision checks still preserve the live mode.
5. Full unit, lint, build, Hosting deploy, and authenticated production acceptance pass.

## Rollout Gate

- current lifecycle slice safe for production: `yes`
- compact Live Switcher safe to implement: `yes, bounded presentation-only slice`
- compact Live Switcher safe for broad rollout: `yes; deterministic and authenticated production acceptance passed`
- rollback ready: `yes; remove the compact prop and retain the standard drawer content`

## Implementation Closeout (2026-07-13)

The approved presentation-only follow-up is complete:

- a live room keeps the existing controlpad and lifecycle focus above the launcher;
- reopening the drawer preserves the three timing bundles and renders compact `Live Switcher` cards;
- every visible compact card exposes no more than `Configure` plus one primary action;
- the standard launcher remains unchanged when no game owns a live lifecycle slot;
- no scoring, payload, Firestore schema, lifecycle persistence, Run of Show, economy, or provider behavior changed.

Measured and release evidence:

- deterministic evidence: `3` timing choices, `2` deliberate recovery actions, `7` visible compact cards, and a maximum of `2` action buttons per card;
- complete unit suite: `268` files / `951` tests;
- full lint: zero errors with the established warning baseline;
- production build and Hosting release: `8a0fc00146a6f351`;
- authenticated production Trivia: audience, interaction, TV, collision block, and End Mode passed; Bingo was blocked and Trivia remained live;
- authenticated production Bingo: audience, interaction, TV, collision block, and End Mode passed; WYR was blocked and Bingo remained live;
- the production harness now verifies the compact-card contract and preserves the timed audience interaction window before collision stress.

Executive result: `approved_complete` for CTO, Chief Product Officer, Chief Marketing Officer, UX, Host, co-host, guest, venue/operator, and TV-viewer review within this bounded slice.

Sequence 6 checkpoint completed: the cross-workstream BeauRocks 10-slide executive plan and PDF now use verified current evidence and explicitly distinguish documented baselines from screenshots. The next bounded checkpoint is event-readiness evidence for Apple/background recovery and the compliant YouTube quota-extension packet.
