# Usage Control Contract

Last updated: 2026-07-21  
Status: Slice 05.1 compatibility boundary; internal guardrail, not public pricing

## Decision

BeauRocks must not offer uncapped postpaid variable usage. The supported liability model is included use protected by hard limits, followed later by prepaid capacity or Host-capped auto-refill. Cloud budget alerts are alarms; the application transaction is the enforcement boundary.

The machine-readable policy lives in `functions/lib/hostCommercialContract.json` under `usageControlPolicy`. Existing public product vocabulary remains Host plan, Additional usage, Workspace, Room, and Money > Billing & Usage.

## Lifecycle

- `reserved`: capacity authorized but not yet consumed; it counts toward the hard-limit exposure.
- `settled`: provider work or a quota-consuming provider attempt occurred. This remains mirrored to the legacy `used` field during migration.
- `released`: a reservation was canceled before consumption.
- `billable`: settled use was sealed for collection under an approved pricing policy.
- `invoiced`: a billable amount was exported exactly once to a payment or invoice rail.

Current synchronous provider boundaries settle the attempt atomically because a failed provider response can still consume quota. This first compatibility step does not fabricate `reserved`, `released`, `billable`, or `invoiced` values for historical activity.

## Host warnings

Money > Billing & Usage receives application-calculated capacity state at 50%, 80%, and 100% of the configured hard limit. Outstanding reservations are included in exposure so concurrent work cannot hide above the cap. Prices and included amounts remain marked `existing_unvalidated_do_not_publish` until Gate C1 evidence and owner approval are complete.

## Protected live-room floor

Variable-cost degradation must not disable queue management, Host override, existing local media, Room shutdown, or Room export. Premium AI and live provider search may be denied at a hard limit while cached/indexed results and local media remain available.

## Remaining Slice 05 work

1. Add idempotent operation documents for true reserve, settle, and release transitions.
2. Add Workspace and optional per-Room budget controls with server-authoritative maximums.
3. Add per-capability and platform circuit breakers with stable reason codes.
4. Implement the tested degradation matrix and recovery guidance.
5. Keep `billable` and `invoiced` disabled until prepaid or vetted-credit policy is approved.

## Controlled production state

- `getMyUsageSummary` revision `getmyusagesummary-00133-rag` calculates lifecycle-compatible exposure and 50% / 80% / 100% warning state.
- Hosting release `1784705152537000`, version `e0fe9eb9e7329ddb`, displays Capacity Status in Money > Billing & Usage and labels zero-cap meters as unavailable.
- Provider callables remain on their prior revisions. They continue writing the legacy `used` count, which the new summary reads as settled use; they will move only when idempotent operation documents are ready.
- No plan limit, entitlement, price, payment behavior, or public pricing claim changed in this sub-slice.
