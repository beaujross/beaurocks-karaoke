# Backlog

Last updated: 2026-03-09

## Purpose

This file is the high-level command queue for the repo.

Use it to answer:

1. What are we doing now?
2. What comes next?
3. What is intentionally deferred?
4. What is already done?

Detailed execution plan for the current month:
- `docs/ENGINEERING_EXECUTION_PLAN_2026-03.md`

Supporting risk assessment:
- `docs/TECH_RISKS_PRIORITIES.md`

## Now

These items are the active engineering priorities. Nothing below this section should outrank them without an explicit decision.

- [ ] EX-01 Freeze and document the core-night release contract.
  - Outcome: one canonical definition of the release-critical host/audience/TV flow.
  - Source: `docs/ENGINEERING_EXECUTION_PLAN_2026-03.md`
- [ ] EX-02 Add one canonical production-facing release gate command.
  - Outcome: one smoke command that blocks deploys when the core night is broken.
  - Target command: `npm run qa:golden:host-room-hands-off:secure`
- [ ] EX-03 Expand release smoke coverage for the active performance path.
  - Outcome: smoke proves request propagation, performing state, and Pop Trivia behavior on audience + TV.
- [ ] EX-04 Keep App Check, QA account policy, and rollback steps in canonical runbooks.
  - Outcome: a second operator can run production QA safely without hidden setup knowledge.
- [ ] EX-05 Add diagnostics and recovery clarity for stuck async states.
  - Outcome: pipelines like lyrics and Pop Trivia have explicit pending/failed/retry/recovery behavior.
- [ ] EX-06 Continue extracting host access and room-launch logic from `src/apps/Host/HostApp.jsx`.
  - Outcome: host access changes stop requiring edits inside a monolithic app shell.
- [ ] EX-07 Split high-risk Cloud Functions domains out of `functions/index.js`.
  - Outcome: lyrics, Pop Trivia, and host-access logic become separately owned/testable modules.
- [ ] EX-08 Centralize AI entitlement and fallback policy.
  - Outcome: authorization is never inferred from secrets or environment state.
- [ ] EX-09 Separate incubation access policy from public launch policy.
  - Outcome: whitelist/super-admin exceptions remain explicit and temporary.
- [ ] EX-10 Prune or clearly mark superseded planning docs.
  - Outcome: one current source of truth for execution, fewer competing plans.

## Next

These items matter after the current execution plan is materially complete.

- [ ] Turnkey customer onboarding + subscriptions.
  - Scope: self-serve onboarding, provisioning, monthly subscription flow, entitlement sync.
- [ ] Organization/workspace model hardening.
  - Scope: org ownership, roles, room-to-org mapping, plan ownership boundaries.
- [ ] Capability gating completion.
  - Scope: feature entitlements enforced consistently in UI and backend with one source of truth.
- [ ] Usage metering + overage billing maturity.
  - Scope: per-org ledger, included quotas, overage handling, reconciliation against cloud/provider costs.
- [ ] Host auth hardening without breaking low-friction room launch.
  - Scope: role-aware sessions, safer host entry path, preserved fast-start UX.
- [ ] Public TV 10-foot UX pass.
  - Scope: readability, density, overlay collision, queue and activity clarity.

## Later

These items are intentionally deferred. They may be valuable, but they should not compete with core-night reliability or launch discipline right now.

- [ ] Realtime multiplayer launch gates and audience-all-play mode expansion.
- [ ] Additional source/provider integration refinement beyond current Apple/YouTube/local flows.
- [ ] Native Apple IAP backend completion and iOS ship track.
- [ ] Workspace customization pack and deeper branding controls.
- [ ] Admin billing portal expansion.
- [ ] Host mobile UX overhaul.
- [ ] Points/monetization UX polish.
- [ ] Chat moderation polish.
- [ ] Expanded VIP cosmetics and other broad UI polish passes.

## Done

Recently completed items that materially changed the operating baseline:

- [x] Production App Check enforcement path hardened.
  - Production web now uses the correct App Check provider strategy, and remote QA uses the debug-token path.
- [x] Hands-off production smoke stabilized.
  - Dedicated low-privilege QA host flow, App Check-aware production automation, current root-to-host login handoff, and clearer room-code parsing.
- [x] Pop Trivia operational recovery.
  - Generation moved to backend-owned automation with cache/AI/fallback behavior and pending-song recovery.
- [x] Lyrics AI entitlement regression fixed.
  - AI access is no longer implicitly granted by the presence of `GEMINI_API_KEY`.
- [x] Root marketing overview promoted live.
  - Root experience and related marketing routing/content changes are deployed.
- [x] P0 verification baseline established.
  - Production deploy, App Check enforcement, and auth/upload smoke documented in `docs/qa/P0_VERIFICATION_2026-02-12.md`.
- [x] Host create/join reliability smoke established.
  - Production host-room validation exists and is runnable from `scripts/qa/`.
- [x] Security and entitlement foundations improved.
  - Central capability gating, metering foundations, and host-access guardrails are in place.

Older shipped items remain discoverable in git history and supporting docs; this file is intentionally biased toward current operating priorities.
