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

### Slice 05.2 operation canary

Live YouTube `search.list` is the first true operation-level boundary:

- the client creates a bounded operation ID only after client-cache misses;
- the server reserves Workspace capacity and creates one server-only `usage_operations` document before provider work;
- a failure before the provider boundary releases the reservation;
- a provider attempt settles the reservation even when the provider returns an error, because quota may have been consumed;
- a replayed or concurrent operation ID is rejected before another provider call;
- settlement uses the reservation's original UTC usage period, including across a month boundary;
- cached/indexed YouTube results and local media remain outside this variable-cost boundary.

Older cached clients receive a server-generated operation ID for compatibility. They remain hard-capped but do not gain replay identity until they load the current client bundle.

Approved canary Hosts retain their public `free` / `inactive` subscription record but receive the finite internal `host_monthly` metering profile. A zero configured hard limit now fails closed instead of meaning unlimited usage.

## Host warnings

Money > Billing & Usage receives application-calculated capacity state at 50%, 80%, and 100% of the configured hard limit. Outstanding reservations are included in exposure so concurrent work cannot hide above the cap. Prices and included amounts remain marked `existing_unvalidated_do_not_publish` until Gate C1 evidence and owner approval are complete.

## Protected live-room floor

Variable-cost degradation must not disable queue management, Host override, existing local media, Room shutdown, or Room export. Premium AI and live provider search may be denied at a hard limit while cached/indexed results and local media remain available.

## Remaining Slice 05 work

1. Migrate the remaining YouTube, Apple Music, and AI provider attempts to operation documents.
2. Add Workspace and optional per-Room budget controls with server-authoritative maximums.
3. Add per-capability and platform circuit breakers with stable reason codes.
4. Implement the tested degradation matrix and recovery guidance.
5. Keep `billable` and `invoiced` disabled until prepaid or vetted-credit policy is approved.

## Controlled production state

- `youtubeSearch` revision `youtubesearch-00146-puy` owns the first operation-level reserve/settle/replay boundary.
- `getMyUsageSummary` revision `getmyusagesummary-00135-tuf` calculates lifecycle-compatible exposure and controlled-cohort caps while suppressing rates and estimated charges unless the Workspace has an entitled paid Host plan.
- Hosting release `1784706338199000`, version `28633fc799ada798`, supplies current clients with operation IDs after cache misses.
- Other provider callables remain on their prior revisions and continue writing the legacy `used` count, which the summary reads as settled use until each boundary migrates.
- No public plan, price, payment behavior, postpaid eligibility, or billing claim changed in this sub-slice.
