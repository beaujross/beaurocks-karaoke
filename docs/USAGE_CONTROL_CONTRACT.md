# Usage Control Contract

Last updated: 2026-07-22
Status: Slice 06.4 simplified Host capacity home; checkout and auto-refill disabled

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

### Slice 05.4 provider coverage and graceful degradation

All identified YouTube Data API, Apple Music API, and Gemini attempts now use the same operation lifecycle. Each callable receives a client operation ID when the current client controls the request; background lyrics and trivia work derives its identity from the trigger or lease. Multi-call flows use stable per-attempt suffixes. A reservation is created before provider work, released when a prerequisite fails before provider work, and settled after an attempted request even when the provider returns an error.

Capability circuits are `youtube_live_search`, `youtube_metadata_lookup`, `apple_music_lookup`, and `ai_generation`. Workspace and Room meter ceilings continue to apply independently of those capability circuits.

| Surface | When fresh provider work is paused | Protected recovery path |
| --- | --- | --- |
| Host Dashboard | Shows the stable budget/circuit explanation instead of a generic provider failure. | Continue with the song catalog, indexed tracks, cached lyrics/content, local media, and manual Host controls. |
| Audience App | Keeps curated and indexed choices visible and explains that fresh lookup is paused. | Request from the available catalog/index; the queue and Room interactions continue. |
| Public TV | Receives no new variable-cost provider dependency and therefore does not enter an error state when a provider circuit opens. | Continue current resolved playback, queue presentation, scoring, and Room visuals. Existing media playback fallback remains authoritative. |
| Background enrichment | Treats a control denial as a provider miss, not a trigger failure. | Trivia uses its fallback question set; lyrics continue through cached/canonical/manual resolution and record a bounded status. |

Recovery is automatic for new operation IDs after capacity is restored or a circuit is closed. Replaying an already-used operation ID stays rejected so recovery cannot double-consume provider capacity.

### Slice 06.1 Additional usage foundation

The monthly maximum can now be the entitled Host plan hard limit plus server-owned prepaid capacity. The same combined maximum is used by the Host summary, owner/admin controls, and atomic reservation. A lower Workspace ceiling remains authoritative, so adding capacity cannot silently relax a Host's safety control.

The server-owned aggregate is `organizations/{orgId}/usage_capacity/{YYYYMM}`. Signed Stripe fulfillment writes an append-only entry at `organizations/{orgId}/additional_usage_ledger/{stripeCheckoutSessionId}` and increments the aggregate in one transaction. Grant validation requires an enabled commercial policy and pack, a paid checkout, exact amount and currency, a valid Workspace and UTC period, and capacity only for known meters. Checkout Session identity prevents duplicate grant on webhook replay.

The production catalog is intentionally empty. `checkoutEnabled` and `autoRefillEnabled` are false, no client checkout function or purchase button exists, and no unvalidated price is public. Capacity is ignored unless the Workspace has an entitled Host plan. Pre-event estimate, first-pack economics, expiration, and capped auto-refill work remain required before Gate C3.

### Slice 06.2 reversible accounting and receipts

Signed Stripe `charge.refunded` and `charge.dispute.created` events can now append immutable adjustment entries and revoke only capacity that remains from the mapped purchase. A server-only grant-state projection prevents retries or overlapping refund and chargeback events from revoking the same capacity twice. It also converts Stripe's cumulative refunded amount into the incremental amount recorded by each partial-refund entry. The original purchase ledger entry is never edited. Unmapped refunds are ignored as another Stripe product.

The conservative pre-launch policy revokes all remaining capacity after any refund, including a partial refund. Money > Billing & Usage states this rule and exposes a sanitized, period-scoped `Receipts & adjustments` history to Workspace owners and admins through a callable. Direct client access to the ledger, grant state, capacity aggregate, and Payment Intent mapping remains denied.

This sub-slice does not enable a pack, price, checkout action, purchase button, auto-refill, postpaid use, or new client Firestore permission. Gate C3 remains open until the customer-facing unit, economics, expiration, pre-event estimate, auto-refill cap, and cohort are approved.

### Slice 06.3 Plan a Room

Workspace owners and admins can preview a Home party, Private event, or Large event for a future date and one-to-twelve-hour duration. The server scales the existing provisional scenario demand into expected and high-use ranges for AI generations, Workspace YouTube request allowance, and Apple Music requests, then compares the high-use range with the selected month’s effective metered Workspace request ceiling minus current exposure. The timestamped result explicitly does not claim to predict every database read/write or media transfer.

The callable is read-only and returns no cloud cost, provisional margin, overage rate, price, or charge estimate. It does not reserve capacity or create a billing record. The Host Dashboard labels it `Early planning range` and states that it is not a price quote, bill, reservation, measured percentile, or guarantee. Recovery points to cached/indexed tracks, local media, reduced fresh provider use, a smaller plan, or prepaid capacity only after purchases open.

The 2026-07-22 90-day observation report still has only one Host Room-day, no sampled Audience observation, and no Private event or Large event coverage. The model is therefore useful as conservative planning guidance but not sufficient evidence for pack economics or Gate C3 approval.

### Slice 06.4 Host capacity home

Money > Billing & Usage now leads with one server-grounded Workspace capacity answer and one next action. A hard limit or paused live-search circuit says `Action needed`; an allowance at or above 80% says `Keep an eye on it`; lower current exposure says `On track`; missing finite Host plan limits and refresh failures cannot render a healthy state. `On track` describes current exposure only and sends the Host to Plan a Room for an event-specific check.

Plan a Room remains direct. Purchase readiness, receipts, manual Safety limits, technical meters/rates/attribution, live diagnostics, and invoice tools remain available behind named secondary disclosures. The default view no longer leads with an overage-dollar estimate, and the technical view states that its legacy meter rates are not an Additional usage quote or an open purchase offer.

This is a presentation-only simplification. No Function, rule, entitlement, meter, hard limit, pack, price, checkout, auto-refill, postpaid behavior, or protected live-room fallback changed.

## Host warnings

Money > Billing & Usage receives application-calculated capacity state at 50%, 80%, and 100% of the configured hard limit. Outstanding reservations are included in exposure so concurrent work cannot hide above the cap. Prices and included amounts remain marked `existing_unvalidated_do_not_publish` until Gate C1 evidence and owner approval are complete.

## Protected live-room floor

Variable-cost degradation must not disable queue management, Host override, existing local media, Room shutdown, or Room export. Premium AI and live provider search may be denied at a hard limit while cached/indexed results and local media remain available.

## Remaining Slice 05 work

1. Complete the owner production pass across fresh YouTube lookup, Apple/lyrics fallback, AI assist, Audience fallback, and uninterrupted Public TV playback.
2. Keep `billable` and `invoiced` disabled until prepaid or vetted-credit policy is approved.
3. Accept Gate C2 only after production evidence confirms denial-before-provider behavior and protected Room continuity.

## Controlled production state

- `youtubeSearch` revision `youtubesearch-00146-puy` owns the first operation-level reserve/settle/replay boundary.
- `getMyUsageSummary` revision `getmyusagesummary-00135-tuf` calculates lifecycle-compatible exposure and controlled-cohort caps while suppressing rates and estimated charges unless the Workspace has an entitled paid Host plan.
- Hosting release `1784706338199000`, version `28633fc799ada798`, supplies current clients with operation IDs after cache misses.
- `youtubeSearch` revision `youtubesearch-00147-kem` applies operation-level Workspace, Room, capability, and platform controls to both live-search provider calls.
- `getMyUsageSummary` revision `getmyusagesummary-00136-jix` reports the effective Workspace ceiling.
- `manageMyUsageControls` revision `managemyusagecontrols-00001-vok` is the owner/admin mutation boundary.
- Hosting release `1784707991819000`, version `4f4d0d07cb82d1ce`, serves the Cost Guardrails UI in Money > Billing & Usage.
- Slice 05.4 YouTube revisions are `youtubeplaylist-00146-ner`, `youtubestatus-00147-nus`, `youtuberefreshindexentries-00044-cil`, and `youtubedetails-00146-lot`.
- AI and Apple/lyrics revisions are `geminigenerate-00145-pal`, `applemusiclyrics-00150-les`, `resolvequeuesonglyrics-00108-tiv`, and `autoapplelyrics-00146-hav`.
- Background trivia revisions are `autopoptrivia-00092-qes`, `backfillpoptriviaonroomenable-00092-vez`, and `recoverpendingpoptrivia-00092-zug`.
- Usage-control revisions are `getmyusagesummary-00137-wuy` and `managemyusagecontrols-00002-xol`.
- Hosting release `1784709581207000`, version `ede23a7706418e50`, serves the operation IDs and shared Host/Audience recovery guidance. Production asset smoke returned HTTP 200 and contained the stable Room-limit reason and recovery copy.
- No public plan, price, payment behavior, postpaid eligibility, or billing claim changed in this sub-slice.
- Slice 06.1 usage and fulfillment revisions are `getmyusagesummary-00138-waz`, `managemyusagecontrols-00003-sov`, and `stripewebhook-00147-xes`.
- Slice 06.1 provider revisions are `youtubesearch-00148-lif`, `youtubeplaylist-00147-cep`, `youtubestatus-00148-dah`, `youtuberefreshindexentries-00045-tex`, `youtubedetails-00147-vav`, `geminigenerate-00146-nev`, `applemusiclyrics-00151-bec`, `resolvequeuesonglyrics-00109-kam`, `autoapplelyrics-00147-vav`, `autopoptrivia-00093-xaf`, `backfillpoptriviaonroomenable-00093-yiy`, and `recoverpendingpoptrivia-00093-ced`.
- Hosting release `1784711753917000`, version `23346e2878422268`, serves `HostApp-C2KTSASp.js`. Live smoke returned HTTP 200 across index, entry, main, and Host assets and found the Additional usage readiness, disabled-purchase, and no-uncapped-overage copy.
- Slice 06.1 did not enable a pack, price, checkout function, purchase button, auto-refill, postpaid usage, Firestore rule, or payment configuration. Gate C3 remains open.
- Slice 06.2 revisions are `stripewebhook-00148-vid` and `listmyadditionalusagetransactions-00001-vin`, both Ready at 100% traffic.
- Hosting release `1784731848817000`, version `58186aa686fa2c10`, serves `HostApp-CMn_LT5b.js`. Live smoke returned HTTP 200 for the index, entry, and Host assets and found the receipt, refresh, conservative-revocation, and empty-state copy.
- Slice 06.2 did not enable a pack, price, checkout function, purchase button, auto-refill, postpaid usage, client Firestore permission, or payment configuration. Gate C3 remains open.
- Slice 06.3 `previewMyRoomCapacity` revision `previewmyroomcapacity-00001-vex` is Ready at 100% traffic.
- Hosting release `1784733914438000`, version `3b084952d2cafe56`, serves `HostApp-Dp_25wcS.js`. Live smoke returned HTTP 200 for the entry and Host assets and found all six required planning, fit-state, meter-boundary, and disabled-purchase strings.
- Slice 06.3 did not enable a pack, price, checkout function, purchase button, auto-refill, postpaid usage, client Firestore permission, or payment configuration. Gate C3 remains open.
- Hosting release `1784735015265000`, version `917824ee335a5bea`, serves the Slice 06.4 capacity home in `HostApp-WsJX8lUe.js`. Live smoke found eight required summary, planning, disclosure, and pricing-boundary strings and confirmed the former top-level `Overage Estimate` copy is absent.
- Slice 06.4 is Hosting-only and changes no Function, rule, entitlement, limit, price, pack, checkout, auto-refill, or postpaid behavior. Gate C3 remains open.
