# BeauRocks Host Commercial Implementation Slices

Date: 2026-07-21

Status: Active implementation queue

Sources:

- `docs/reviews/2026-07-21-private-host-monetization-roadmap.md`
- `docs/reviews/2026-07-21-cost-safety-and-offline-roadmap-amendment.md`

This is the authoritative execution order. The source roadmaps retain strategy, rationale, and detailed acceptance criteria. This file assigns one sequential slice number and working status to every delivery unit.

## Working rules

- Only one slice is `in progress` unless the owner explicitly approves parallel work.
- A slice must satisfy its tests, evidence, rollback path, and owner gate before it becomes `accepted`.
- Production charging, broader Host access, and public offline claims remain disabled until their named gates pass.
- Existing customer-facing vocabulary is used: Host Dashboard, Audience App, Public TV, Room, Workspace, Room Recap, Charts, Points, BeauBucks, Host Tip, Support, Host-Led, Assisted Host, and Crowd-Driven.

## Numbered slices

| Slice | Status | Delivery outcome | Depends on | Review gate |
| --- | --- | --- | --- | --- |
| 01 | accepted | Commercial contract and vocabulary source of truth | None | A |
| 02 | accepted | Host plan checkout and room-creation entitlement | 01 | B1 |
| 03 | production canary | First Room and Tonight Setup | 02 | B2 |
| 04 | planned | Room cost envelope and database fan-out containment | 01-03 | C1 |
| 05 | planned | Usage states, Host budgets, and graceful degradation | 04 | C2 |
| 06 | planned | Prepaid usage packs and capped auto-refill | 05 | C3 |
| 07 | later | Vetted postpaid usage accounts | 06 plus production evidence | C4 |
| 08 | planned | Host Tip outbound destination | 03 | D1 |
| 09 | planned | Money-action clarity and checkout ownership | 01, 08 | D2 |
| 10 | planned | BeauBucks purchase and balance authority | 06, 09 | D3 |
| 11 | planned | Room Boosts and Host-controlled consumption | 10 | D4 |
| 12 | planned | Assisted Host and Crowd-Driven reliability | 03 | E1 |
| 13 | planned | Content-agnostic private-party media path | 05, 12 | E2 |
| 14 | planned | Offline capability and financial safety contract | 01, 13 | F1 |
| 15 | planned | Resilient-online app shell and local-media readiness | 14 | F2 |
| 16 | planned | Cloud-independent Room runtime boundary | 14 | F3 |
| 17 | planned | Single-device Offline Host proof | 15, 16 | F4 |
| 18 | research prototype | Multi-device LAN Room proof | 16, 17 | F5 |
| 19 | later | Managed movie-theater and venue offline package | 18 | F6 |
| 20 | planned | Private-party marketing and organic acquisition | Truthful availability from accepted slices | G1 |
| 21 | planned | Charts, Room Recaps, Discover, and activity growth loop | Room reliability and privacy gates | G2 |
| 22 | planned | Commercial operations and staged release | Selected launch slices | H |

## Slice 01 - Commercial contract and vocabulary source of truth

### Outcome

Client, Functions, tests, analytics, and planning share one versioned contract for Host plans, subscription states, capabilities, usage meters, money rails, and customer-facing terminology.

### Work units

1. Add a machine-readable commercial contract with a schema version.
2. Record current Host plan IDs, prices, intervals, capabilities, and meter allowances without changing production behavior.
3. Mark VIP as a legacy compatibility plan rather than a current Host offer.
4. Record the approved subscription-state vocabulary and whether each state grants capabilities or new-Room creation.
5. Record Host plan, usage, Host Tip, BeauBucks purchase, and fundraiser Support as separate money rails.
6. Record internal-to-public vocabulary mappings.
7. Add parity tests against client and Functions definitions so drift fails CI.
8. In a follow-up change within this slice, make client and Functions derive their public definitions from the shared contract after the parity baseline is green.
9. Produce a drift inventory for remaining VIP, BROSS, organization, points-pack, and ambiguous tip language; do not perform an uncontrolled global rename.

### Acceptance

- One schema-versioned contract describes the current commercial truth.
- Client and Functions parity tests pass.
- Legacy compatibility is distinguishable from public availability.
- Each money rail names recipient, value, merchant, and offline behavior.
- No production price, entitlement, checkout, or billing behavior changes in this slice.

### Rollback

The shared contract and parity test can be removed without changing runtime behavior until consumers are deliberately migrated.

## Slice 02 - Host plan checkout and room-creation entitlement

Make paid Host access the normal self-service route, retain approved Host access as an audited rollout exception, centralize `rooms.create`, and prove webhook reconciliation and downgrade behavior.

## Slice 03 - First Room and Tonight Setup

Route a newly paid Host through Room Readiness and a minimal private-party setup using Host-Led, Assisted Host, or Crowd-Driven, then launch Public TV and copy the Audience App join link.

### Gate B2 production pass

An owner production pass is required before Slice 03 is accepted.

1. Deploy Hosting only from a source-traceable release.
2. Do not deploy Functions, Firestore rules, indexes, or payment configuration as part of this pass.
3. Keep Host access limited to the existing approved production cohort.
4. In production, create a Private Room, exercise each Room-control choice, review guest access and the backing-media plan, continue through Room Readiness, and select Launch Room.
5. Confirm Public TV opens, the Audience App link copies, and Host Dashboard recovery works when either browser handoff is blocked.
6. Reopen the Room from Host Dashboard and confirm existing-Room continuity.
7. Record the Hosting release, live asset IDs, owner findings, and rollback target in the Slice 03 review.

Slices 04 and 05 remain required before broader self-service Host access. They do not block this bounded owner canary.

## Slice 04 - Room cost envelope and database fan-out containment

Attribute reads, writes, Functions, egress, AI, and provider use to Rooms; bound listeners and writes; model expected, 95th-percentile, and 99th-percentile cost; and set a margin floor before broader access.

## Slice 05 - Usage states, Host budgets, and graceful degradation

Implement reserved, settled, released, billable, and invoiced states; Workspace and Room controls; warning thresholds; platform circuit breakers; and a protected live-room floor.

## Slice 06 - Prepaid usage packs and capped auto-refill

Sell understandable additional Room capacity only after verified payment, prevent concurrent overspend, and allow optional auto-refill within a Host-selected monthly ceiling.

Recommended presentation: included private karaoke nights with stated duration and active-guest bands. Internally meter active guest-hours and infrastructure consumption. Offer extra-night and large-party packs before granular usage billing.

## Slice 07 - Vetted postpaid usage accounts

Add idempotent invoicing only for approved commercial Workspaces with credit limits, payment history, a maximum unbilled-liability ceiling, and suspension rules.

## Slice 08 - Host Tip outbound destination

Let a Host configure a safe Host-owned link and QR. Do not route the money through BeauRocks or promise verified fulfillment in the first version.

## Slice 09 - Money-action clarity and checkout ownership

Make every payment action identify what is purchased, who receives the money, who fulfills it, and who handles refunds or support. Remove ambiguous `tip` presentation from BeauRocks-collected products.

## Slice 10 - BeauBucks purchase and balance authority

Complete the server-authoritative BeauBucks ledger and canary gate, separate purchased value from Points, and define scope, refunds, chargebacks, and expiration.

## Slice 11 - Room Boosts and Host-controlled consumption

Offer a small set of understandable BeauBucks actions selected by the Host without allowing money to silently determine winners or queue priority.

## Slice 12 - Assisted Host and Crowd-Driven reliability

Harden stage ownership, queue-empty recovery, singer-not-ready recovery, backing failure, low participation, Host override, and multi-hour private-party operation.

## Slice 13 - Content-agnostic private-party media path

Keep requests song-centered, rank trusted backing versions, make Host uploads and local media first-class fallbacks, and communicate provider capabilities without implying a licensed BeauRocks catalog.

## Slice 14 - Offline capability and financial safety contract

Classify every capability as cloud-required, resilient, single-device offline, or LAN-capable. Forbid queued offline financial execution and limit local media to Host-authorized sources.

## Slice 15 - Resilient-online app shell and local-media readiness

Implement a versioned app-shell cache, deliberate safe local state, an idempotent non-financial outbox, local-media integrity checks, and visible connection state.

## Slice 16 - Cloud-independent Room runtime boundary

Introduce shared Room commands, events, sequence numbers, idempotency, capability discovery, and a `CloudRoomRuntime` so live-room behavior no longer assumes Firebase is the only possible authority.

## Slice 17 - Single-device Offline Host proof

Use a `LocalRoomRuntime` to run Host Dashboard and Public TV on one prepared device with Host-provided media in airplane mode, including restart recovery and Room Recap export.

## Slice 18 - Multi-device LAN Room proof

Prototype a local Room gateway serving Host Dashboard, Audience App, Public TV, and authorized media over the LAN. Pass a multi-hour test with the WAN physically disconnected and zero live-room cloud operations.

## Slice 19 - Managed movie-theater and venue offline package

Package the proven LAN runtime with a signed offline license lease, diagnostics, updates, backup, support, device/site policy, and unit economics.

## Slice 20 - Private-party marketing and organic acquisition

Lead with at-home and private-event karaoke, explain the shipped product surfaces and room-control choices, create useful intent pages, and keep plans and offline claims synchronized with accepted capabilities.

## Slice 21 - Charts, Room Recaps, Discover, and activity growth loop

Publish qualified performance stories, song crowns, activity views for Hosts and Venues, and substantive first-party pages while preserving private-Room boundaries and separating opening scores from real performances.

## Slice 22 - Commercial operations and staged release

Prove support, reconciliation, refunds, incidents, observability, privacy, accessibility, legal review, cohort controls, rollback, and truthful commercial claims before unrestricted release.

## Review gates

| Gate | Decision |
| --- | --- |
| A | Commercial contract, vocabulary, access rules, money rails, and trial posture |
| B1 | Paid checkout, entitlement, cancellation, and webhook behavior |
| B2 | First-Room setup and private defaults |
| C1 | Cost drivers, guest bands, margin floor, and maximum subsidized exposure |
| C2 | Liability limits, warnings, degradation, and protected live-room floor |
| C3 | Included use, prepaid packs, auto-refill cap, and safe cohort size |
| C4 | Postpaid eligibility, credit limits, reconciliation, and collection policy |
| D1-D4 | Host Tip, payment clarity, BeauBucks authority, and Room Boost integrity |
| E1-E2 | Self-hosted reliability and content-agnostic media promise |
| F1-F6 | Offline contract, resilience, runtime portability, offline proofs, and venue package |
| G1-G2 | Public acquisition, Charts, Discover, and privacy-safe growth story |
| H | Commercial release readiness |

## Current checkpoint

Slices 01, 02, and 03 are accepted. The owner completed the Slice 03 core-karaoke production pass, and the resulting Room-selection, transition-control, VIP reward, and microphone-vote fixes are released.

Slice 04 is deployed to the controlled production cohort. The provisional Room cost envelope is documented, the inventoried live listeners are bounded, Room songs use bounded active and recent-performance windows, and sampled Room cost observations are live with enforced 90-day retention and a read-only evidence report. Gate C1 remains open until representative Room-day coverage replaces the provisional stress multipliers, product-attributed usage reconciles to cloud/provider billing, and the owner approves the margin floor and maximum subsidized exposure.

Broader self-service Host access remains blocked by Gate C1 and Slice 05 usage-budget and graceful-degradation controls.

Slice 05.1 is active for the controlled cohort: the shared contract now names reserved, settled, released, billable, and invoiced states; hard-limit exposure includes outstanding reservations; Host Money > Billing & Usage shows application-calculated 50%, 80%, and 100% capacity state; and the protected live-room floor is explicit. True idempotent reservation operations, per-Room budgets, circuit breakers, and the degradation matrix remain open, so Gate C2 is not accepted.

Slice 05.2 begins with the live YouTube search boundary: Workspace capacity is reserved before provider work, settled after an attempted provider call, released before an unattempted call, and replay-protected by a client/server operation ID. Approved cohort access now resolves to finite internal meter caps without changing its public subscription record, and zero-cap meter configurations fail closed. Remaining provider boundaries, per-Room budgets, platform caps, and degradation controls keep Gate C2 open.
