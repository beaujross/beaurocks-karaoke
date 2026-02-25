# Overnight Execution Plan

## 1) Mission
- Objective: maximize live-room reliability and reduce repeat regressions with unattended-safe tasks.
- Success criteria by morning:
  - Firestore index requirements are codified in-repo and deploy-ready.
  - Critical snapshot listeners degrade safely instead of hard-failing UI.
  - Smoke automation covers recent breakpoints (audience load, TV overlay lifecycle, host dropdown usability).
  - At least one safe modularization extraction lands with no behavior change.

## 2) Guardrails
- Branch to use: `overnight/stability-hardening-pass-1`
- Commit cadence: `commit after each completed task`
- Required checks before each commit:
  - `npm run lint`
  - `npm run build`
  - `npm run test:unit`
- Additional checks:
  - Targeted smoke script(s) created in this run
- Deploy allowed overnight: `NO`
- Files/areas that must not be changed:
  - billing/paywall behavior
  - auth entitlement semantics
  - game scoring formulas unless required for bug fix

## 3) Priority Queue

### P1 - Must Finish
1. Task: Firestore index source-of-truth and query audit
   - Scope: add and wire index config, capture known query patterns that require composites, document ownership.
   - Files:
     - `firestore.indexes.json` (new)
     - `firebase.json`
     - `docs/firestore-indexes.md` (new)
   - Definition of done:
     - index file exists in repo and is referenced by firebase config.
     - required composites for current `roomCode + timestamp` and other multi-field queries are present.
     - docs explain how to deploy/update indexes.
   - Validation:
     - `npx firebase-tools firestore:indexes --project beaurocks-karaoke-v2` (if available) or static verification against query inventory.
     - `npm run lint && npm run build && npm run test:unit`
   - Rollback/toggle: remove new index file reference from `firebase.json` and revert docs/index file.
2. Task: Listener resilience wrapper for high-risk screens
   - Scope: create a shared helper for snapshot subscriptions with consistent error handling; apply to highest-risk listeners first.
   - Files:
     - `src/lib/firestoreWatch.js` (new)
     - `src/apps/Mobile/SingerApp.jsx`
     - `src/apps/TV/PublicTV.jsx`
     - `src/apps/Host/hooks/useHostChat.js`
   - Definition of done:
     - listeners in scope use centralized error callback path.
     - `failed-precondition` and permission errors set safe fallback state and log once.
     - no crash loops and no silent empty UI from uncaught listener errors.
   - Validation:
     - `npm run lint && npm run build && npm run test:unit`
     - manual simulation by forcing listener error path in dev.
   - Rollback/toggle: switch touched listeners back to direct `onSnapshot` calls.

### P2 - High Value If Time
1. Task: Smoke coverage for recent regressions
   - Scope: add lightweight Playwright smoke scripts for audience boot, TV overlay exit, host top dropdown.
   - Files:
     - `scripts/qa/overnight-audience-tv-host-smoke.mjs` (new)
     - optional updates in `package.json` scripts
   - Definition of done:
     - script fails on console `failed-precondition`/uncaught errors.
     - script verifies WYR/preview overlay clears correctly.
     - script validates host top dropdown opens cleanly and remains readable.
   - Validation:
     - run script locally against staging/prod URL.
   - Rollback/toggle: remove new script and script entry.
2. Task: Safe modularization extraction (behavior-preserving)
   - Scope: extract one contained slice from monolith into pure/helper module or hook without behavior change.
   - Files:
     - `src/apps/Host/HostApp.jsx`
     - `src/apps/Host/hooks/<new-hook>.js` and/or `src/apps/Host/components/<new-component>.jsx`
   - Definition of done:
     - at least 250-500 lines moved out of `HostApp.jsx`.
     - no functional diff; call sites updated and tested.
   - Validation:
     - `npm run lint && npm run build && npm run test:unit`
   - Rollback/toggle: revert extraction commit only.

### P3 - Nice to Have
1. Task: Build budget visibility
   - Scope: add simple chunk-size monitoring note and warning thresholds to docs/build workflow.
   - Files:
     - `docs/performance-budget.md` (new)
     - optional `package.json` helper script
   - Definition of done:
     - clear budget targets for `HostApp`, `PublicTV`, firebase vendor chunk.
     - checklist for next modularization/code-split pass is documented.
   - Validation:
     - `npm run build`
   - Rollback/toggle: remove docs/script changes.

## 4) Out of Scope
- Full architecture rewrite across all apps
- Design-heavy visual restyling passes
- Production deploys
- Rules/callable semantic changes unless required to unblock a reliability fix

## 5) Blocker Policy
- If blocked more than `20 minutes`, skip to next task.
- Log blocker in `OVERNIGHT_LOG.md` with:
  - failure point
  - attempted fixes
  - exact next step

## 6) Morning Handoff Format
- Completed:
- Partially completed:
- Not started:
- Blockers:
- Recommended next 3 actions:

## 7) Kickoff Prompt (Copy/Paste)
`Execute OVERNIGHT_PLAN.md top-to-bottom on branch overnight/stability-hardening-pass-1. Commit after each completed task. Run npm run lint, npm run build, and npm run test:unit before each commit. Do not deploy. If blocked for more than 20 minutes, move to the next task and log details in OVERNIGHT_LOG.md. End with a concise morning handoff summary.`
