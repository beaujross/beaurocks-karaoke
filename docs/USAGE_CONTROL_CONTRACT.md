# Usage Control Contract

Last updated: 2026-07-22
Status: Slice 05.3 controlled production boundary; internal guardrail, not public pricing

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

### Slice 05.3 budgets and circuit breakers

Live YouTube search now reads its controls inside the same Firestore transaction that creates the reservation:

- the plan hard limit remains the maximum liability ceiling;
- a Workspace owner/admin may lower, but never raise, that ceiling in Money > Billing & Usage;
- an open Room may receive a smaller optional request budget, with settled and outstanding reserved units both included in its exposure;
- removing a Room budget returns that Room to the Workspace ceiling;
- the Workspace may pause `youtube_live_search`, while BeauRocks operations retain a server-only platform breaker;
- a concurrent control update conflicts with an in-flight reservation transaction, which must retry against the new control before provider work;
- rejected work creates no usage operation and does not call the provider;
- control documents are default-denied to clients and mutate through the owner/admin callable or server operations only.

Stable denial reason codes are `usage_platform_circuit_open`, `usage_capability_circuit_open`, `usage_workspace_unavailable`, `usage_workspace_hard_limit_reached`, and `usage_room_hard_limit_reached`. Every denial confirms that protected Room capabilities remain available.

## Host warnings

Money > Billing & Usage receives application-calculated capacity state at 50%, 80%, and 100% of the configured hard limit. Outstanding reservations are included in exposure so concurrent work cannot hide above the cap. Prices and included amounts remain marked `existing_unvalidated_do_not_publish` until Gate C1 evidence and owner approval are complete.

## Protected live-room floor

Variable-cost degradation must not disable queue management, Host override, existing local media, Room shutdown, or Room export. Premium AI and live provider search may be denied at a hard limit while cached/indexed results and local media remain available.

## Remaining Slice 05 work

1. Migrate the remaining YouTube, Apple Music, and AI provider attempts to operation documents.
2. Extend operation-level budgets and stable circuit reasons to the remaining migrated provider capabilities.
3. Implement the tested degradation matrix and recovery guidance across Host Dashboard, Audience App, and Public TV.
4. Keep `billable` and `invoiced` disabled until prepaid or vetted-credit policy is approved.

## Controlled production state

- `youtubeSearch` revision `youtubesearch-00146-puy` owns the first operation-level reserve/settle/replay boundary.
- `getMyUsageSummary` revision `getmyusagesummary-00135-tuf` calculates lifecycle-compatible exposure and controlled-cohort caps while suppressing rates and estimated charges unless the Workspace has an entitled paid Host plan.
- Hosting release `1784706338199000`, version `28633fc799ada798`, supplies current clients with operation IDs after cache misses.
- `youtubeSearch` revision `youtubesearch-00147-kem` applies operation-level Workspace, Room, capability, and platform controls to both live-search provider calls.
- `getMyUsageSummary` revision `getmyusagesummary-00136-jix` reports the effective Workspace ceiling.
- `manageMyUsageControls` revision `managemyusagecontrols-00001-vok` is the owner/admin mutation boundary.
- Hosting release `1784707991819000`, version `4f4d0d07cb82d1ce`, serves the Cost Guardrails UI in Money > Billing & Usage.
- Other provider callables remain on their prior revisions and continue writing the legacy `used` count, which the summary reads as settled use until each boundary migrates.
- No public plan, price, payment behavior, postpaid eligibility, or billing claim changed in this sub-slice.
