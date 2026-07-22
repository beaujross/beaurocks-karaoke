# Slice 06.4 Review - Host capacity home

Date: 2026-07-22
Status: deployed and live-smoked; no pricing or payment behavior changed; Gate C3 open
Parent slice: Slice 06 - Prepaid usage packs and capped auto-refill

## Outcome

Money > Billing & Usage now answers the Host's first question before showing controls: whether current metered Workspace usage is on track, needs watching, needs action, or cannot yet be evaluated without finite Host plan limits.

The event-specific next step remains `Plan a Room`. When fresh provider requests are limited, the single top action opens and scrolls directly to `Safety limits`. When plan capacity is missing, it routes to the existing Host plan actions. A refresh failure offers one refresh action instead of presenting stale capacity as healthy.

## Simplified default hierarchy

1. One `Workspace capacity` answer for the selected month.
2. One recommended next action.
3. Direct Room planning by date, party size, and duration.
4. Optional purchase-readiness and receipt history.
5. Optional Safety limits.
6. Optional Technical usage details.
7. Optional Invoice tools.

The former default `Overage Estimate` card is removed from the top-level view. Raw meters, rates, attribution, live diagnostics, invoice exports, receipt refresh, Workspace ceilings, Room budgets, and live-search controls remain available in named disclosures. Technical rates are explicitly described as neither an Additional usage quote nor an open purchase offer.

## Presentation contract

`src/lib/hostUsageReadiness.js` owns the priority order and customer-facing response:

- loading and refresh failures cannot render a false healthy state;
- a Workspace without finite Host plan ceilings cannot render `On track`;
- a hard limit or paused live-search circuit renders `Action needed`;
- an 80% or higher meter renders `Keep an eye on it`;
- lower current exposure renders `On track` without promising that a future Room will fit;
- hard-limit recovery always names the protected karaoke floor: cached/indexed tracks, local media, queue controls, Host override, and Public TV.

Read-only users do not wait on owner-only Safety limit state. No new analytics write was added merely to measure disclosure clicks.

## Functionality preserved

- month selection;
- Plan a Room;
- Additional usage readiness;
- receipts and immutable adjustments;
- Workspace request ceiling;
- optional Room budget;
- live-search pause/resume;
- live diagnostics and provider status;
- raw usage, rate, and attribution tables;
- invoice customer, drafts, exports, snapshots, and history;
- Host plan checkout and billing portal actions.

No Function, Firestore rule, meter, entitlement, limit, checkout, pack, auto-refill, or postpaid policy changed.

## Verification

- Focused readiness and source-contract suite passed: 3 files, 10 tests.
- Full unit suite passed: 318 files, 1,147 tests.
- Focused lint passed with zero errors; 18 pre-existing Host hook warnings remain.
- Production build passed and generated 135 prerendered routes and 132 social cards.
- `git diff --check` passed.

## Adversarial review

- A high-level `On track` state does not claim that the next Room is guaranteed; the Host is directed to Plan a Room for that answer.
- `Review safety limits` opens the disclosure before scrolling, avoiding a second discovery action.
- Missing finite capacity, a paused circuit, a hard limit, and a failed refresh all fail away from a healthy state.
- Pricing remains absent from the default story and Additional usage remains closed.
- Advanced professional-host and operational tools remain reachable without competing with the private-party planning path.

## Remaining Gate C3 work

1. Gather representative Room and Audience evidence and reconcile it with cloud/provider billing.
2. Approve the first customer-facing Additional usage unit, expiration, pack economics, and maximum subsidized exposure.
3. Define capped auto-refill size, warning threshold, Host-selected monthly maximum, and immediate off switch.
4. Approve the controlled production cohort before any purchase action appears.

## Controlled production deployment

- Hosting release `1784735015265000`, version `917824ee335a5bea`, serves the simplified capacity home.
- Live smoke returned HTTP 200 for entry asset `index-BnT7vQbb.js` and Host asset `HostApp-WsJX8lUe.js`, found eight required hierarchy and pricing-boundary strings, and confirmed the former top-level `Overage Estimate` copy is absent.
- No Function or rules deployment is required.

## Rollback

Revert the Host hierarchy and `hostUsageReadiness` presentation helper. All underlying usage, guardrail, receipt, planning, and invoice behavior remains independently available and unchanged.
