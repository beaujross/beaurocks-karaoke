# Technical Risks and Priorities

As of 2026-02-08, this is a focused engineering assessment of current technical risk in the codebase.

## Severity 1 - High

1. Monolithic UI modules increase regression risk and slow changes.
- `src/apps/Mobile/SingerApp.jsx` and `src/apps/Host/HostApp.jsx` are each very large and own many concerns (state orchestration, Firestore subscriptions, billing hooks, game flows, and UI rendering).
- Risk: high bug surface area, hard reviews, difficult testability, and brittle refactors.

2. Client write permissions are broad under room public data.
- `firestore.rules` allows authenticated writes to `artifacts/{appId}/public/data/**`.
- Risk: accidental/abusive writes to unrelated docs, weak least-privilege boundaries, and integrity issues for competitive features.

3. Mixed product maturity inside one runtime path.
- Web Stripe payments are wired, while iOS IAP is scaffolded with deliberate not-implemented paths.
- Risk: user-facing dead ends and environment-specific failures if purchase UI is exposed without platform gating.

## Severity 2 - Medium

4. Repository hygiene and artifact sprawl.
- Large local artifacts and tooling bundles exist in the project root (for example cloud SDK installers/archives).
- Risk: accidental oversized commits, slower clones, and push failures.

5. Limited automated verification coverage for core flows.
- No obvious test suite coverage for room lifecycle, queue transitions, scoring, or payment webhook outcomes.
- Risk: behavior drift and production regressions during feature changes.

6. Data model and query coupling in client code.
- Firestore collection names and query patterns are repeated across major app surfaces.
- Risk: schema drift and inconsistent behavior when evolving fields.

7. Error handling is uneven across async boundaries.
- Many async operations are handled inline in UI components.
- Risk: inconsistent failure UX and difficult post-incident debugging.

8. Firebase Auth email-link flows are vulnerable to client retry loops if URL state is not consumed.
- Audience email-link verification depends on browser URL auth params plus locally stored email state.
- Risk: repeated `auth/invalid-action-code` or `auth/expired-action-code` loops if spent links are retried on every render or effect pass instead of being treated as terminal failures and cleared from the URL.

9. Audience shell render ordering remains a high-regression surface.
- `src/apps/Mobile/SingerApp.jsx` has repeatedly regressed when hooks or derived values were declared after early-return render branches.
- Risk: hard production-only React crashes during join, voting, lyrics, or ready-check flows.
- Guardrail: `tests/unit/singerAppHooks.test.mjs` must be extended whenever major audience-shell render structure changes.

10. Run-of-show operator access is split across workspace access and role capabilities.
- Room-level host access (`hostUids`) and run-of-show co-host capability (`runOfShowRoles.coHosts`) are separate systems.
- Risk: a user can be described as a co-host in product copy but still lack a practical operator entry point or room-scoped host access.

11. Song resolution and backing automation depend heavily on room-curated YouTube quality.
- Audience song intent now resolves against layered catalog sources, including room YouTube curation.
- Risk: hosts can still get stuck if unresolved requests do not have an obvious backing-selection path, and poor curation quality weakens automation confidence.

12. Event credits and paid perks still carry abuse risk if they rely on shared secrets.
- Guest-first points are correct for live-event UX, but VIP / skip-line style rewards should not depend on reusable shared codes.
- Risk: code leakage converts paid/limited rewards into low-trust redemptions unless attendee entitlements or one-time promo records are used.

13. Source-only tests can create false confidence around giant UI modules.
- `SingerApp.jsx`, `HostApp.jsx`, and some live-ops surfaces have historically been protected by source-shape assertions more than behavior tests.
- Risk: a refactor can keep the same strings or structure patterns while still breaking the live room flow.
- Guardrail: for event-facing flows, prefer small extracted helpers plus deterministic unit/runtime tests over additional regex/source checks.

14. Optional modes can silently consume hardening time without improving event confidence.
- Trivia, Would You Rather, Doodle Oke, Selfie Cam, and other audience-side extras are real product surfaces, but they should not automatically receive the same testing depth as join/request/queue/run-of-show flows.
- Risk: unstable optional experiences dilute engineering time and make the room feel more complex if they are over-promoted before they are trusted.
- Guardrail: keep optional modes in a smoke-and-graceful-failure lane unless they are explicitly promoted into the event contract.

## Severity 3 - Low

15. Inconsistent documentation source-of-truth.
- Many roadmap/spec docs exist, but not all appear synchronized with current implementation.
- Risk: onboarding confusion and duplicate planning effort.

16. Legacy/duplicate files increase ambiguity.
- Keep legacy scaffolds out of active `src/` paths (archive only).
- Risk: accidental edits to non-active paths.

17. Functions dependency drift is visible in production deploys.
- `functions/package.json` still warns on deploy for outdated `firebase-functions`.
- Risk: unnecessary deployment noise, delayed compatibility problems, and harder incident triage when warnings are normalized.

## Priority Plan

### P0 (This week)

1. Protect baseline branch and repository hygiene.
- Ensure large local binaries/archives are excluded from source control.
- Keep only application source, configs, docs, and deployment assets in baseline.

2. Introduce minimum guardrails for integrity-sensitive writes.
- Split critical writes (scores, payouts, hall-of-fame records) behind callable functions only.
- Tighten Firestore rules for writable room documents by role and document type.

3. Add smoke tests for critical end-to-end flows.
- Host create/open room.
- Singer join/request/react.
- Song completion -> `logPerformance` -> leaderboard update.
- Stripe webhook idempotency path.

### P1 (Next 2-3 weeks)

4. Decompose `SingerApp` and `HostApp` by domain.
- Extract data hooks (`useRoom`, `useQueue`, `useChat`, `useBilling`, `useGames`).
- Extract feature sections into composable containers.
- Keep top-level apps as orchestration shells only.

5. Centralize Firestore collection paths and update contracts.
- Introduce shared path helpers/constants and typed payload validators.
- Reduce repeated literal collection strings across components.

6. Standardize async error boundaries and telemetry.
- Add uniform `try/catch` wrappers for function calls and writes.
- Track structured failure events with context (mode, roomCode, operation).

7. Upgrade `functions` runtime dependencies before they become blocking.
- Bring `firebase-functions` to a current supported version and verify callable/onCall behavior, scheduled jobs, and document triggers in emulator plus production.

### P2 (Next 1-2 months)

8. Align billing by platform capability.
- Explicitly gate unavailable purchase actions with clear messaging.
- Complete iOS verification path before exposing IAP purchase UX.

9. Consolidate docs into one implementation truth set.
- Keep architecture + operational runbooks current.
- Archive or mark superseded planning docs.

## Suggested Refactor Order

1. `HostApp` extraction first (highest orchestration complexity).
2. `SingerApp` extraction second (highest UI+feature density).
3. Rules/data-contract hardening in parallel with incremental extractions.

## Exit Criteria for a Safer Baseline

- Baseline branch contains no oversized/non-source artifacts.
- Core room flow has deterministic smoke coverage.
- Security rules enforce role-scoped writes for critical paths.
- Host and Singer top-level files reduced to orchestration-focused modules.
