# Overnight Execution Queue (2026-02-11 -> 2026-02-12)

Last updated: 2026-02-11

## Execution Status (Completed 2026-02-11)

- WS1 completed.
- WS2 completed.
- WS3 completed.
- WS4 completed.
- WS5 completed.
- WS6 completed.

Validation snapshot:
- `npm run build`: pass (2026-02-11).
- `npm run lint`: fails due pre-existing repository lint errors unrelated to this overnight batch.
- `npm run test:rules`: blocked in local environment (`java -version` unavailable).

## Objective
Ship MVP-complete versions of six priority improvements in one overnight delivery window, with explicit acceptance gates and rollback safety.

## Scope
Workstreams in this queue:
1. Fame XP UX ("next unlock" + progress clarity).
2. Shared user-meta UI component (VIP badge + fame display consistency).
3. Room-user public data consistency hardening.
4. Turnkey onboarding foundation (self-serve org/workspace bootstrap).
5. Entitlement gating and monetizable module boundaries.
6. Cloud cost pass-through/markup + QuickBooks Self-Employed invoice flow hardening.

## Delivery Rule
Each workstream must finish with:
1. Code merged locally.
2. Validation commands passing.
3. Backlog and docs updated.

## Dependency Order
1. WS3 first: data consistency underpins WS1 and WS2.
2. WS2 second: shared component avoids duplicate WS1 edits.
3. WS1 third: add UX on top of WS2 component.
4. WS5 fourth: gating layer required before WS4 commercial exposure.
5. WS4 fifth: onboarding flow wired to WS5 capabilities.
6. WS6 sixth: finalize monetization/reconciliation paths for launched orgs.

## Timeboxed Queue
Target window: 8.5 to 10 hours.

1. 22:00-22:30 Preflight and guardrails.
- Confirm clean baseline and capture current commit.
- Run baseline validation.

2. 22:30-00:00 WS3 Data consistency hardening.
- Create normalized room-user projection helper.
- Ensure projection writes on join, profile updates, VIP changes, and fame changes.
- Add backfill path for active room users missing `isVip`, `fameLevel`, or `totalFamePoints`.

3. 00:00-01:15 WS2 Shared user-meta component.
- Extract reusable component for avatar/name/VIP badge/fame level/progress.
- Replace duplicated mobile social surfaces with shared component.

4. 01:15-02:30 WS1 Fame XP UX.
- Add "next unlock" and "points to next level" blocks in profile and public profile surfaces.
- Add clear copy for max-level state.

5. 02:30-04:00 WS5 Entitlement gating and module boundary pass.
- Add central capability map and entitlement resolver hook.
- Add frontend `FeatureGate`.
- Add backend capability checks for callable operations with variable cost.

6. 04:00-05:45 WS4 Turnkey onboarding foundation.
- Add onboarding flow: account -> org -> plan -> branding baseline -> room launch.
- Add callable bootstrap endpoint to provision org/workspace defaults.

7. 05:45-07:00 WS6 Cost pass-through and QBSE flow hardening.
- Extend usage invoice generation with pass-through and markup visibility.
- Ensure QBSE CSV maps line items and income reconciliation cleanly.
- Persist invoice snapshots with usage-rate metadata for audit.

8. 07:00-07:30 Full validation, release notes, push.

## Workstream Plans

## WS1 Fame XP UX
Goal: users can instantly understand progress and what unlocks next.

Primary files:
- `src/apps/Mobile/SingerApp.jsx`
- `src/lib/fameConstants.js`
- `src/components/FameLevelBadge.jsx`

Implementation steps:
1. Add helper to resolve next unlock from `FAME_LEVELS`.
2. Add compact "Next Unlock" card in profile/public profile surfaces.
3. Show exact delta to next threshold.
4. Add max-level message path.

Acceptance criteria:
1. Every profile surface shows current level, progress, and next unlock state.
2. Copy uses `FAME_LEVELS.*.name` consistently.
3. No layout overflow on mobile.

Validation:
- `npm run build`
- Manual smoke: Social/Profile, Leaderboard profile tap, Lobby profile tap.

## WS2 Shared User-Meta Component
Goal: one rendering source for VIP badge + fame card across surfaces.

Primary files:
- `src/components/UserMetaCard.jsx` (new)
- `src/apps/Mobile/SingerApp.jsx`

Implementation steps:
1. Create `UserMetaCard` with variants (`compact`, `full`).
2. Migrate leaderboard rows, lobby rows, and public profile header/body to use component.
3. Keep fallback-safe behavior for partial user records.

Acceptance criteria:
1. VIP badge treatment is visually consistent.
2. Fame progress bar style and labels are consistent.
3. No duplicated VIP/fame render blocks remain in migrated surfaces.

Validation:
- `npm run build`
- Visual diff pass on Social tab surfaces.

## WS3 Room-User Data Consistency Hardening
Goal: room-facing user docs always include monetization and fame signals used by UI.

Primary files:
- `src/apps/Mobile/SingerApp.jsx`
- `src/apps/Host/HostApp.jsx` (if host writes room user docs)
- `functions/index.js` (optional repair callable)

Implementation steps:
1. Define normalized public projection fields:
- `isVip`
- `vipLevel`
- `fameLevel`
- `totalFamePoints`
2. Write projection on key transitions:
- join
- profile edit
- VIP upgrade/verification
- fame/profile updates
3. Add repair/backfill callable for active room users missing fields.

Acceptance criteria:
1. New and existing active users display stable VIP/fame metadata without inference-only fallbacks.
2. Public profile modal and social cards match source data after refresh.

Validation:
- `npm run build`
- Manual smoke across join/profile/VIP update cycle.

## WS4 Turnkey Onboarding Foundation
Goal: first production path for self-serve customer onboarding.

Primary files:
- `src/apps/Host/HostApp.jsx` or onboarding route components
- `src/lib/firebase.js`
- `functions/index.js`

Implementation steps:
1. Add onboarding wizard shell:
- account identity confirmation
- org/workspace creation
- plan selection handoff
- branding baseline
- first room creation
2. Add callable bootstrap function to create org defaults.
3. Persist owner role and org-room mapping.

Acceptance criteria:
1. New user can create org and first room in one guided flow.
2. Org ownership and room mapping are persisted.
3. Failure states are recoverable and do not create orphaned partial records.

Validation:
- `npm run build`
- Manual new-account onboarding run.

## WS5 Entitlement Gating + Modularity
Goal: enforce monetizable capabilities from one policy source in frontend and backend.

Primary files:
- `src/billing/capabilities.js` (new)
- `src/hooks/useEntitlements.js` (new)
- `src/components/FeatureGate.jsx` (new)
- `functions/index.js`

Implementation steps:
1. Add capability matrix by plan/add-on.
2. Add frontend gate wrapper for premium UI.
3. Add backend entitlement assertions for billable callables.
4. Return explicit capability errors to clients.

Acceptance criteria:
1. Disabled capabilities are hidden/blocked in UI.
2. Backend rejects unauthorized callable access even if client bypass is attempted.
3. Capability keys are centrally documented and reused.

Validation:
- `npm run build`
- `npm run test:rules` for related permission safety.
- Manual callable checks for allowed/blocked tiers.

## WS6 Cloud Cost Pass-Through + QBSE Invoice Hardening
Goal: protect margin and produce invoice artifacts that map cleanly to QBSE workflow.

Primary files:
- `functions/index.js`
- `src/apps/Host/HostApp.jsx`
- `docs/QUICKBOOKS_SELF_EMPLOYED_INVOICE_FLOW.md`

Implementation steps:
1. Add rate-card model with pass-through and markup factor.
2. Update invoice draft generation with explicit:
- included units
- overage units
- unit cost
- markup multiplier
- final line amount
3. Ensure QBSE export includes stable fields for manual invoice + reconciliation.
4. Persist invoice snapshots with rate-card metadata used at generation time.

Acceptance criteria:
1. No silent cost absorption for metered overages in generated invoice draft.
2. Host billing UI explains pass-through vs markup.
3. QBSE CSV exports remain importable and aligned with invoice totals.

Validation:
- `npm run build`
- Manual generation of invoice draft and CSV outputs for one org-period.

## Validation Gates (Global)
Run after each workstream and again at end:
1. `npm run build`
2. `npm run lint`
3. `npm run test:rules`

Hard stop rule:
If any gate fails, resolve before moving to next workstream.

## Commit Plan
Use one commit per workstream:
1. `feat: harden room user vip/fame projection`
2. `refactor: extract shared user meta card for social surfaces`
3. `feat: add fame next unlock UX across profile surfaces`
4. `feat: add entitlement capability map and backend enforcement`
5. `feat: add turnkey onboarding wizard foundation`
6. `feat: add pass-through markup invoicing and qbse mapping hardening`
7. `docs: update backlog and runbooks for overnight delivery`

## Rollback Plan
If late-stage regressions appear:
1. Revert latest workstream commit only.
2. Re-run build and smoke tests.
3. Continue with unaffected queued workstreams.

## Morning Deliverables
1. Updated code for all six workstreams.
2. Updated `BACKLOG.md` status for each.
3. Updated billing/onboarding docs.
4. Short delivery summary with:
- shipped scope
- known gaps
- follow-up tasks.
