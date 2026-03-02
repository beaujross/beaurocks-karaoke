# Security Hardening Queue

Last updated: 2026-03-02

## Objective

Close high-risk privacy/integrity gaps without breaking core Host, Audience, TV, or callable workflows.

## Compatibility Guardrails

1. No change should block room join, chat, voting, reactions, or host controls.
2. Callable behavior remains source-of-truth for privileged operations.
3. Every rules hardening change must be paired with rules tests.

## Phase 1 (In Progress): Privacy Leak Containment

Status: completed

1. Remove phone propagation into public room projection (`room_users`).
2. Restrict `/users/{uid}` reads to owner + moderators/admin only.
3. Remove cross-user `/users` reads in clients; use room-projected data for public profile/tight15 views.
4. Keep Tight 15 host UX intact by mirroring account Tight 15 into per-room projection.

## Phase 2 (Queued): Room User Integrity Controls

Status: in_progress

1. Add strict field allowlist for self `room_users` update/create operations.
2. Block client-controlled privilege fields (`isVip`, `vipLevel`, `fameLevel`, `totalFamePoints`) unless validated against server-managed user state.
3. Add deny tests for point/VIP tampering and unauthorized field writes.
4. Lock `/users/{uid}` privilege keys (`vipLevel`, `isVip`, fame fields, `phone`) from client writes; update via callables/Admin SDK only.

## Phase 3 (Queued): Room State Write Surface Reduction

Status: queued

1. Revisit non-host writable room keys (`activeMode`, `activeScreen`, `gameData`, etc.).
2. Move any remaining non-host room control writes behind validated callables.
3. Add regression tests for game UX paths to ensure no host/audience flow regressions.

## Phase 4 (Queued): Activity/Reaction Schema Tightening

Status: in_progress

1. Require sender identity + payload bounds in `activities` and `reactions`.
2. Validate room existence and ownership semantics where applicable.
3. Add negative-path tests for spoofed/system-shaped payloads.

## Phase 5 (Queued): Monetization Completion

Status: queued

1. Implement Apple IAP server verification (`verifyAppleReceipt`).
2. Replace client "not wired yet" paths with fully supported iOS purchase flows.
3. Add idempotency and entitlement-grant tests.

## Phase 6 (Queued): Maintainability Refactor

Status: queued

1. Slice `SingerApp.jsx`, `HostApp.jsx`, and `functions/index.js` into bounded modules.
2. Preserve behavior with snapshot/unit/integration coverage before and after extraction.
3. Keep app-check enforcement and billing/security logic centralized and testable.
