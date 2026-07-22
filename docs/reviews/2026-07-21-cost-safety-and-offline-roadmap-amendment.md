# Cost Safety and Offline/LAN Roadmap Amendment

Date: 2026-07-21

Status: Proposed for owner review

Amends: `docs/reviews/2026-07-21-private-host-monetization-roadmap.md`

This amendment is part of the full roadmap. Where it conflicts with the base roadmap's Slices 3, 4, 10, 13, review gates, metrics, or proposed starting point, this amendment takes precedence.

## Executive decision

BeauRocks should not open room creation to additional paid Hosts until every Room has a measurable cost envelope and a bounded maximum exposure.

The default commercial model should be subscription plus included use, followed by prepaid usage packs or explicitly capped auto-refill. BeauRocks should not extend an uncapped postpaid credit line to an unknown Host. Postpaid usage can be introduced later for vetted Workspaces with a credit limit and a maximum unbilled-liability ceiling.

Offline operation should be developed as a separate runtime path, not described as a property of the current PWA. The target is a local Room that can serve the Host Dashboard, Audience App, and Public TV over a local network without Firestore, Cloud Functions, cloud media egress, or access to the public internet during the event. It must use Host-provided local media and must not queue financial transactions for later execution.

These decisions support the primary product promise: a person can run karaoke at home or at a private event, choose how hands-on to be, and keep control of both the night and its cost.

## Repository findings that change the plan

### Cloud usage and margin

- Workspace usage is already reserved transactionally and can enforce hard limits.
- Existing meters cover AI generation, YouTube Data requests, and Apple Music requests, with included allowances, hard limits, and overage rates.
- Existing usage invoice output is a draft and reconciliation foundation. It is not yet automatic, liability-safe overage collection.
- The current cost model estimates approximately `$0.42` of infrastructure cost for a casual Room, `$1.38` for a busy Room, and `$3.89` for a tournament-style Room before the older internal reserve model is added.
- With the older reserve assumptions included, the same modeled Rooms rise to approximately `$2.92`, `$13.78`, and `$41.89`. Twelve modeled busy nights would therefore consume roughly `$165` in reserve against a `$15` monthly subscription.
- A newer direct-provider event estimate places a 150-person, five-hour, YouTube-first event at roughly `$4` to `$11`, depending on use. YouTube quota can become a product limit before direct dollar cost does.
- The application contains many real-time Firestore listeners across Host Dashboard, Audience App, and Public TV. A single changing collection can fan out reads to every connected guest and surface.

The implication is not that every Firestore interaction should be billed to the Host. It is that the platform needs internal cost-of-service meters and bounded listener behavior before pricing can be trusted.

### Existing offline support

- The web app has a manifest, but there is no complete service-worker/app-shell installation path that makes the product an offline application.
- Host Dashboard has an IndexedDB local-media store named `bross_local_media`. This is useful fallback media on the Host device, not synchronized Room state for Audience App and Public TV.
- Firebase Auth, Firestore, Realtime Database, Storage, and Functions are direct application dependencies.
- Shared Room behavior currently relies on cloud subscriptions for Room, queue, users, activities, messages, reactions, votes, and related state.
- Current operations guidance correctly treats legal local uploads as fallback media. Provider downloads must not be repackaged as an offline BeauRocks catalog.

The implication is that true local-network operation requires a Room runtime boundary and a local authority. Enabling browser persistence alone would improve resilience but would not produce a multi-device, no-internet Room.

## Commercial risk policy

### BeauRocks does not play bank by default

1. A Host plan grants Room creation and an understandable included allowance.
2. Additional variable use is prepaid before BeauRocks authorizes the corresponding exposure.
3. Auto-refill is opt-in and always has a Host-selected monthly maximum.
4. Postpaid overage is limited to vetted Workspaces with a saved payment method, payment history, credit limit, and suspend policy.
5. No Host can create an unbounded balance while payment settlement or webhook processing is delayed.
6. An account-level spend control cannot be overridden from an individual Room.
7. Core live-room recovery remains available when a premium capability reaches its limit.

### Internal cost units and customer-facing units

Keep two related views:

| View | Units | Purpose |
| --- | --- | --- |
| Internal cost-of-service | Firestore reads/writes, Functions invocations and duration, Hosting/Storage bytes, provider calls, AI tokens or jobs, media processing | Margin protection, anomaly detection, and capacity planning |
| Host plan usage | Room-hours, included active-guest capacity, premium feature allowances, and clearly defined add-ons | A bill a private-party Host can understand and control |

Do not expose a line-item database tax to a consumer Host. Price understandable capacity from a validated cost envelope, then use granular internal meters to make sure the envelope remains profitable.

### Proposed sliding scale

The names and quantities below are packaging structures, not approved public plan names or rates.

| Layer | Host experience | BeauRocks protection |
| --- | --- | --- |
| Base Host plan | Create Rooms; enough included use for a defined private-party profile | Subscription entitlement plus a finite allowance |
| Prepaid usage pack | Add more Room capacity or premium use before the event | Payment settles before additional exposure is granted |
| Capped auto-refill | Continue without interruption up to a chosen monthly ceiling | Refill amount, monthly maximum, receipts, and an off switch |
| Higher Host plan | More included use and lower effective unit rate | Same hard technical limits and minimum margin floor |
| Approved commercial account | Postpaid usage within an assigned credit line | Vetted account, liability cap, collection policy, and suspension rules |
| Offline/LAN package | Operate locally for a licensed site or device | No per-guest cloud fan-out; periodic license validation and support boundary |

The first pricing experiment should compare room-hours plus active-guest bands against a simpler included-nights model. Premium provider and AI features can retain separate allowances where their cost or quota behavior is materially different.

### Mandatory platform circuit breakers

- Per-Workspace monthly exposure limit.
- Per-Room total and hourly exposure limits.
- Per-capability and per-provider limits.
- Per-actor rate limits for abuse-prone writes.
- Platform-wide daily and monthly exposure limits.
- Maximum unbilled liability that includes provider use during payment and webhook lag.
- Warnings at 50%, 80%, and 100% of relevant limits.
- Kill switches for individual providers and premium features.
- A protected live-room floor so queue, Host intervention, and local playback recovery still work.
- A staff-visible reason code for every denial or degradation.

Cloud budget alerts must be used as alarms, not as the enforcement mechanism. Product-side reservations, hard limits, and provider kill switches must enforce the boundary.

## Revised financial slices

## Slice 3A - Room cost envelope and fan-out containment

Status: planned

Depends on: Base roadmap Slices 0-2

Blocks: additional self-serve Host access beyond a deliberately small controlled cohort

### Outcome

Every Room has a measurable expected cost, a safe maximum exposure, and bounded real-time fan-out before it is allowed to scale.

### Work

- Inventory every Firestore listener and write path by Host Dashboard, Audience App, Public TV, and public web surface.
- Record Room-attributed reads, writes, Functions use, Hosting and Storage egress, AI use, and provider requests in an internal cost-of-service stream.
- Identify broad or dormant listeners and mount them only when the relevant surface is active.
- Replace repeated full-collection fan-out with bounded queries, projection documents, aggregation, pagination, and throttled updates where appropriate.
- Set retention and cleanup policies for ephemeral reactions, messages, presence, activities, and generated artifacts.
- Model casual, busy, and large-event Rooms at expected, 95th-percentile, and 99th-percentile use.
- Establish a target gross-margin floor and maximum platform-funded cost per Room.
- Reconcile modeled usage to Google Cloud billing export and provider invoices.
- Load-test Host Dashboard, Public TV, and representative guest counts together.

### Acceptance

- The team can explain the top five marginal cost drivers of a Room with observed data.
- A documented cost envelope exists for each supported guest band and Room duration.
- No unbounded collection listener is mounted across every guest without an approved cost justification.
- A synthetic abusive guest cannot generate unlimited writes or Functions calls.
- Observed cloud cost and product-attributed cost reconcile within an approved tolerance.
- The 99th-percentile modeled Room remains inside either the included margin envelope or an enforced prepaid limit.

### Owner review

- Approve the minimum gross-margin floor.
- Approve initial Room duration and active-guest bands.
- Approve the maximum subsidized first-Room exposure, if a trial remains under consideration.

## Slice 3B - Usage states, budgets, and graceful degradation

Status: planned

Depends on: Slice 3A

### Outcome

A Host can see and control usage before it becomes a charge, and the backend can stop cost without destroying the night.

### Work

- Evolve usage accounting from one mutable count into `reserved`, `settled`, `released`, `billable`, and `invoiced` states.
- Track attempted provider calls separately where an attempt consumes quota but does not create customer value.
- Add Money > Usage with included use, current use, projected use, prepaid balance, and hard limits.
- Add Workspace monthly controls and optional per-Room controls.
- Add warnings at 50%, 80%, and 100% through Host Dashboard and an optional account notification.
- Define an explicit degradation matrix for each premium capability.
- Keep queue management, Host override, existing local media, and Room shutdown/export below the protected live-room floor.
- Provide stable internal reason codes and plain Host-facing explanations.

### Acceptance

- Usage reservation is atomic and cannot exceed the Workspace, Room, capability, or platform limit.
- Failed work releases reserved value when appropriate without erasing consumed provider quota.
- Host Dashboard and backend calculate the same remaining allowance.
- Every hard limit has a tested fallback and recovery action.
- A Room cannot bypass the Workspace monthly maximum.

## Slice 4A - Prepaid packs and capped auto-refill

Status: planned

Depends on: Slice 3B

Precedes: unrestricted postpaid overage

### Outcome

A Host who needs more capacity can fund it without BeauRocks extending an uncontrolled loan.

### Work

- Define one first prepaid unit using evidence from Slice 3A.
- Create a payment-backed, append-only allowance ledger.
- Grant purchased allowance only after verified Stripe webhook fulfillment.
- Add idempotent purchase, grant, reserve, settle, release, refund, expiration, and chargeback entries.
- Offer optional auto-refill with refill size, monthly maximum, warning threshold, and immediate disable control.
- Prevent retries, delayed webhooks, or concurrent Rooms from spending the same allowance twice.
- Give the Host a pre-event estimate based on planned duration, guest band, room control, and premium capabilities.
- Add receipts that separate the Host subscription from prepaid usage.

### Acceptance

- BeauRocks never authorizes pack-funded use before verified funds or an approved credit line exists.
- Concurrent Rooms cannot overspend a Workspace allowance.
- Auto-refill stops exactly at the Host-selected monthly maximum.
- Refunds and chargebacks adjust future entitlement without rewriting history.
- The Host can see the price and additional capacity before purchase.

## Slice 4B - Vetted postpaid accounts

Status: later

Depends on: accepted Slices 3A, 3B, and 4A plus production reconciliation evidence

### Outcome

Approved recurring or commercial Hosts can receive a legible usage invoice within a bounded credit policy.

### Work

- Define eligibility, credit limit, maximum unbilled liability, billing cadence, and suspension rules.
- Seal billing periods and create idempotent Stripe invoice items.
- Preserve rate snapshots and usage evidence for every line.
- Reconcile reserved, settled, billable, invoiced, paid, credited, and disputed amounts.
- Shorten the billing window or suspend additional variable use as exposure approaches the credit limit.
- Add anomaly review before unusually large invoices are finalized.

### Acceptance

- Replaying period close cannot duplicate a charge.
- Payment or webhook lag cannot exceed the assigned liability ceiling.
- Every invoice line traces to a settled meter, period, and rate snapshot.
- A correction creates an auditable credit or adjustment.
- Consumer Hosts remain prepaid unless explicitly approved for postpaid terms.

## Offline and LAN capability ladder

`Offline` must not be one ambiguous checkbox. The roadmap uses four explicit capability levels.

| Level | Public meaning | Internet dependency | Multi-device Room |
| --- | --- | --- | --- |
| Resilient online | A short connection loss does not immediately destroy the Host experience | Required before and after disruption | Limited by cloud synchronization |
| Single-device Offline Host | Host Dashboard and Public TV can run on one prepared device with local media | Not required during the prepared event | No guest-phone promise |
| LAN Room | Host Dashboard, Audience App, and Public TV communicate through a local Room runtime | Not required during the event | Yes, on the local network |
| Managed offline venue | Packaged, supportable LAN operation for a site such as a movie theater | Periodic license/sync connection only | Yes, within licensed limits |

Only the third and fourth levels meet the user's no-World-Wide-Web movie-theater scenario.

## Offline Track O0 - Contract and safety boundary

Status: planned

Can begin after: Slice 0

### Outcome

The team has a precise definition of what works offline, what requires internet, and what data may synchronize later.

### Work

- Define offline behavior for Host Dashboard, Audience App, Public TV, queue, room control, reactions, votes, games, Room Recap, and Charts.
- Restrict offline media to Host-provided files and other sources the Host is authorized to use locally.
- State that YouTube, Apple Music, Spotify, cloud search, cloud AI, Discover, public Charts, checkout, and verified payment fulfillment require internet unless a provider explicitly supports another lawful mode.
- Forbid offline BeauBucks purchases, Host Tip verification, fundraiser payment verification, and delayed financial execution.
- Permit a Host-owned static Tip QR or link to be displayed, while making clear it cannot be opened or verified without connectivity.
- Define which non-financial Room events may sync later and how duplicate or conflicting events resolve.
- Define privacy, retention, export, and deletion behavior for a locally stored Room.

### Acceptance

- Every customer-facing capability has a cloud-required, resilient, single-device, or LAN support classification.
- No financial transaction can be forged by replaying a locally queued event.
- No provider media is copied into a BeauRocks offline catalog without explicit rights and provider support.
- The Host sees Room Readiness before disconnecting.

## Offline Track O1 - Resilient online foundation

Status: planned

Depends on: O0

### Outcome

A prepared Host can survive a brief internet interruption and still recover the Room safely.

### Work

- Add a real installable app-shell cache and versioned update strategy.
- Add deliberate Firebase local-cache behavior for safe read models and an explicit reconnect experience.
- Create a local outbox only for approved, idempotent, non-financial commands.
- Expand the existing IndexedDB local-media path with quota checks, integrity checks, and Room Readiness.
- Make online, reconnecting, degraded, and offline state visible in Host Dashboard and Public TV.
- Test stale-room, duplicate-command, device-reload, and conflict recovery.

### Acceptance

- The Host knows before launch which media and capabilities will survive a connection loss.
- A browser reload can recover the prepared local media and safe Host state.
- Reconnect cannot duplicate queue commands or financial outcomes.
- Marketing calls this resilient operation, not full offline multi-device hosting.

## Offline Track O2 - Room runtime boundary

Status: planned

Depends on: O0

Required before: O3

### Outcome

Room behavior no longer assumes Firebase is the only authority.

### Work

- Define a `RoomRuntime` contract for Room state, queue, users, messages, reactions, votes, games, media resolution, and Room Recap events.
- Move cloud access behind a `CloudRoomRuntime` implementation without changing customer behavior.
- Use shared commands and events with stable IDs, idempotency keys, schema versions, and monotonic Room sequence numbers.
- Separate cloud identity and billing from live Room authority.
- Define a capability registry so each runtime can truthfully report what is available.
- Add contract tests that can run against cloud and local implementations.

### Acceptance

- Host Dashboard, Audience App, and Public TV can consume the runtime contract without importing Firebase for live Room behavior.
- The cloud implementation passes existing golden-path behavior and the shared contract suite.
- Runtime events can be replayed deterministically into an equivalent Room state.
- Financial and public-growth operations remain outside the local runtime authority.

## Offline Track O3 - Single-device Offline Host proof

Status: planned

Depends on: O1 and O2

### Outcome

One prepared computer can run Host Dashboard and Public TV using local state and Host-provided media without internet.

### Work

- Implement `LocalRoomRuntime` with local persistence.
- Run Host Dashboard and Public TV on the same device or trusted display connection.
- Support queue edits, singer calls, playback handoff, Host-Led control, Room Recap, and clean shutdown/export.
- Disable unsupported cloud and money features with explicit explanations.
- Validate multi-hour operation, browser/device restart, storage pressure, and corrupted-media recovery.

### Acceptance

- A prepared device completes a representative private karaoke night in airplane mode.
- No Room-state request reaches Firebase or another cloud service during the offline test.
- Unsupported features fail closed and do not create ambiguous pending payments.
- Local Room state can be exported and deleted by the Host.

## Offline Track O4 - LAN Room proof

Status: planned research and prototype

Depends on: O2 and evidence from O3

### Outcome

Host Dashboard, Audience App, and Public TV run across a private local network with no public-internet dependency during the event.

### Reference architecture

- A local Room gateway is the live authority.
- It serves the versioned web app shell and authorized local media over the LAN.
- It distributes Room events over WebSocket or an equivalent local real-time channel.
- It persists an append-only event log and projections in a local database such as SQLite.
- Guests pair with a short Room code or QR that resolves to the gateway's local address.
- Short-lived Room tokens and device pairing replace a cloud-auth dependency for local participation.
- Optional post-event synchronization sends only approved summaries through an idempotent, signed import path.

Do not ship Firebase emulators as the customer-facing offline product. They are development tools and would preserve the wrong application boundary.

### Work

- Prototype local discovery using QR plus local IP first; evaluate mDNS only as a convenience.
- Test iOS, Android, Windows, macOS, browser security requirements, captive networks, and local TLS constraints.
- Implement guest isolation so a participant cannot inspect another guest or administer the local gateway.
- Add LAN health, connected-device count, latency, storage, and gateway-restart recovery to Host Dashboard.
- Define summary synchronization for Room Recap and eligible performance evidence without making private Room details public.
- Prevent local data from entering public Charts until cloud validation, privacy, and anti-cheat checks pass.
- Load-test the gateway at the selected guest bands and multi-hour duration.

### Acceptance

- A representative Host, TV, and guest-device cohort completes a multi-hour Room with the WAN physically disconnected.
- No live Room read, write, Function invocation, or cloud media egress occurs during the test.
- Gateway restart restores an internally consistent Room.
- A guest cannot obtain Host authority through local-network inspection or replay.
- Reconnection and optional summary import are idempotent and do not publish private Room data.
- Supported local-network and browser combinations are documented before any public promise.

## Offline Track O5 - Managed movie-theater or venue package

Status: later, conditional on O4 evidence

### Outcome

A movie theater or other controlled site can operate BeauRocks locally under a supportable commercial license.

### Work

- Package the gateway as a managed desktop runtime or small appliance after prototype evidence selects the form factor.
- Add a signed, time-limited license lease that can be validated periodically without requiring internet during a Room.
- Define device/site transfer, replacement, backup, update, and support policies.
- Provide preflight diagnostics for Wi-Fi capacity, display/audio, local storage, media, and clock accuracy.
- Design signed offline update bundles for sites that cannot connect the gateway directly.
- Price the package as a site/device or capacity license with support, not as free unlimited use attached to the consumer plan.
- Complete security, privacy, music-rights, and operational review for commercial sites.

### Acceptance

- A licensed site can run within its offline lease and selected capacity without cloud Room fan-out.
- An expired or invalid license does not terminate an already-live Room; it blocks a later launch according to policy.
- Updates are signed, reversible, and recoverable.
- Support can diagnose the gateway without collecting unrelated local guest data.
- Unit economics include hardware, support, replacement, and update costs.

## Sequencing into the base roadmap

The revised order is:

1. Base Slice 0: approve product, access, and money contract.
2. Base Slices 1-2: prove paid Host activation and the first private Room for a controlled cohort.
3. Slice 3A: establish Room cost envelopes and contain database fan-out.
4. Slice 3B: expose usage controls and enforce graceful degradation.
5. Slice 4A: launch prepaid usage and optional capped auto-refill.
6. Only then widen self-serve Host access.
7. Slice 4B: add postpaid overage only for vetted accounts after reconciliation evidence.
8. Continue base Slices 5-10 for Host Tip, money clarity, BeauBucks, room control, and content-agnostic media.
9. Run O0 and O1 when their shared foundations are ready; begin O2 before adding more direct Firebase dependencies.
10. Prove O3 before committing to multi-device LAN scope.
11. Prove O4 before marketing no-internet Rooms.
12. Treat O5 as a separate managed commercial package, not an automatic consumer-plan entitlement.
13. Continue public marketing, Charts, Room Recaps, Discover, and staged commercial release only with truthful capability labels.

Offline work should not delay basic paid Host validation, but the Room runtime boundary should begin before the Firebase surface expands substantially. This preserves the option without pretending the full local-network product is cheap.

## Revised review gates

### Gate C1 - Cost observability

After Slice 3A.

Approve observed cost drivers, guest bands, Room-duration assumptions, target gross margin, maximum subsidized exposure, and listener/write containment.

### Gate C2 - Liability containment

After Slice 3B.

Approve Workspace, Room, capability, and platform limits; warning behavior; protected live-room floor; and every degradation path.

### Gate C3 - Prepaid commercial scale

After Slice 4A.

Approve customer-facing units, included allowance, usage packs, capped auto-refill, receipts, and the cohort size that can safely open.

### Gate C4 - Postpaid credit

After Slice 4B.

Approve eligibility, credit limits, maximum unbilled liability, collection and suspension policy, and production reconciliation evidence.

### Gate E1 - Resilient operation

After O1.

Approve the exact connection-loss promise and Room Readiness presentation.

### Gate E2 - Runtime portability

After O2 and O3.

Approve the local capability set, runtime contract, recovery behavior, and whether a LAN prototype remains commercially justified.

### Gate E3 - No-internet LAN Room

After O4.

Approve supported devices and networks, security evidence, local-media boundary, sync policy, and the exact public claim.

### Gate E4 - Managed venue package

After O5.

Approve form factor, site license, support model, offline lease, unit economics, and movie-theater readiness.

## Added metrics

### Cost and exposure

- Infrastructure cost per Room and per active guest-hour
- Firestore reads and writes per Room, surface, active guest, and minute
- Hosting and Storage egress per Room
- Functions and provider cost per completed performance
- Expected, 95th-percentile, and 99th-percentile Room cost
- Gross margin by Host plan, Room duration, and guest band
- Maximum and average unbilled liability
- Usage denied or degraded by capability and reason
- Prepaid balance, refill frequency, auto-refill cap hits, and unused allowance
- Product-meter-to-cloud-bill reconciliation variance

### Offline and LAN

- Prepared local-media success rate
- Connection-loss recoveries and duplicate-command rate
- Offline Room duration and successful completion
- Local gateway connected devices, event latency, and restart recovery time
- Cloud reads, writes, Functions, and egress during a WAN-disconnected test; target is zero for live Room operation
- Optional sync success, duplicates rejected, and conflicts requiring Host action
- Local storage growth and cleanup success
- Support incidents per licensed offline site

## Adversarial review

### CEO lens

An inexpensive subscription with uncapped consumption can create negative gross margin precisely when adoption succeeds. The plan now makes exposure a product invariant, not a month-end finance discovery. Offline/LAN can improve margins and unlock controlled venues, but it is a separate product and support obligation, not a free checkbox.

### CTO lens

Browser caching does not remove the Firebase authority or synchronize multiple devices. The plan introduces a runtime contract before building the LAN gateway, proves one-device operation first, and prevents local code from becoming an authority for money or public rankings. It also treats listener fan-out, egress, idempotency, recovery, and security as release gates.

### Chief Product Officer lens

A private-party Host should buy a predictable night, not database operations. Customer-facing allowances therefore use room capacity and understandable premium capabilities, while internal granular meters protect margin. Limits degrade optional cost centers before core Host control. Offline levels have explicit names so the product does not overpromise.

### Chief Marketing Officer lens

`Works without internet` is a valuable promise only after a WAN-disconnected, multi-device acceptance test. Until then, public language should say local media backup or connection-loss resilience where accurate. A future managed offline package creates a credible movie-theater story without confusing the primary at-home and private-party message.

### Finance and abuse lens

Postpaid usage for unknown accounts makes BeauRocks the lender and creates fraud, chargeback, and billing-lag exposure. Prepaid packs and capped auto-refill contain that risk. Platform-wide circuit breakers are still required because compromised payment accounts, retry storms, listener fan-out, and provider errors can exceed individual Host limits.

## Decisions required at the next owner review

1. Approve the default rule that consumer Hosts are prepaid for variable usage and cannot silently incur postpaid overage.
2. Choose the first pricing experiment: included nights or room-hours plus active-guest bands.
3. Set a provisional gross-margin floor and maximum BeauRocks-funded cost for a trial Room.
4. Approve the four-level offline vocabulary and confirm that only LAN Room and Managed offline venue may claim no-internet multi-device operation.
5. Approve O2, the Room runtime boundary, as an architectural requirement before the product adds substantial new direct Firebase coupling.

No production billing behavior, public price, or offline claim should change until the applicable review gate is accepted.
