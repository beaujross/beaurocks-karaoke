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

## Severity 3 - Low

8. Inconsistent documentation source-of-truth.
- Many roadmap/spec docs exist, but not all appear synchronized with current implementation.
- Risk: onboarding confusion and duplicate planning effort.

9. Legacy/duplicate files increase ambiguity.
- Presence of files like `src/main_old.jsx`, `src/App_old.jsx`.
- Risk: accidental edits to non-active paths.

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

### P2 (Next 1-2 months)

7. Align billing by platform capability.
- Explicitly gate unavailable purchase actions with clear messaging.
- Complete iOS verification path before exposing IAP purchase UX.

8. Consolidate docs into one implementation truth set.
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
