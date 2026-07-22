# BeauRocks Private Host and Monetization Roadmap

Date: 2026-07-21

Status: Proposed for owner review

Primary product lens: a person running karaoke at home or at a private party

Secondary product lenses: private-event organizer, fundraiser organizer, recurring host, and venue

## Executive decision

BeauRocks turns karaoke night into a room-wide party game. A paid Host account creates and runs rooms through the Host Dashboard. Public TV leads the shared moment, and the Audience App lets guests join, request songs, follow the queue, react, vote, play games, and support the room.

The primary customer is not assumed to be a professional karaoke host. It is a person who wants to run their own karaoke night, choose how hands-on to be, and use their own tracks and connected sources.

The commercial foundation is:

1. A Host plan grants the ability to create and launch rooms.
2. A Host plan includes understandable usage allowances.
3. BeauRocks meters variable-cost features and gives the Host budget controls before charging overages.
4. A Host can add a Host Tip screen whose money goes to the Host.
5. BeauRocks can separately sell BeauBucks for in-app use.
6. Fundraiser Support remains a separate, clearly attributed money flow.

The product remains content-agnostic by design. Hosts bring their own tracks and connected sources. BeauRocks organizes the room, not the rights to the music.

## Canonical vocabulary

Use these terms throughout implementation, review, analytics, and public copy.

| Internal contract | Host or public language |
| --- | --- |
| `HostApp` | Host Dashboard |
| `SingerApp` | Audience App |
| `PublicTV` | Public TV |
| `RecapView` | Room Recap |
| `organization` | Workspace |
| `room` | Room or BeauRocks room |
| `room_session` | Live room when customer-facing |
| `canonicalSongId` | Song |
| backing candidate or rendition | Backing version |
| `public_chart_*` | Charts |
| `publicVibeIndex` | BeauRocks Vibe Index |
| earned non-cash value | Points or Participation points |
| purchased or prepaid in-app value | BeauBucks |
| money sent to the room's Host | Host Tip |
| BeauRocks purchase that benefits play | BeauBucks purchase or Room Boost, depending on the product |
| external fundraiser payment | Support |

Do not introduce `operating system`, `Crown Circuit`, `House Score`, `Party Pass`, or similar language as shipped product names without a separate naming decision. `Karaoke night operating system` may be used as an internal strategy shorthand only.

## Product boundaries

### Host account

- A full, non-anonymous account is required to become a Host.
- An active Host plan is the normal commercial requirement for creating a room.
- Approved Host access remains a controlled beta, support, and migration mechanism rather than the public business model.
- Guests do not need a paid account to join or participate.
- Account creation may be encouraged for cross-room history and Charts, but it must not slow the basic room join.

### Room control

Use the room-control language that already exists:

- `Host-Led`: full songs and Host-paced decisions.
- `Assisted Host`: full songs with Auto-DJ helping between performances.
- `Crowd-Driven`: One-Minute Mic, audience continuation votes, and Auto-DJ for a more self-hosted night.

The Host can step in at any time. Do not promise a fully unattended room until recovery, media, queue, and safety behavior meet an explicit unattended-operation acceptance gate.

### Content

- Audience intent is a song request, not a provider selection.
- Host and automation resolve a playable backing version.
- YouTube, Apple Music, uploads, local files, and later providers remain capability-specific sources.
- Public copy must not imply that BeauRocks sells or supplies a licensed karaoke catalog.

## Money-flow contract

Every paid action must identify the recipient, purchased value, and refund/support owner before checkout.

| Rail | Recipient | Guest receives | Host controls | BeauRocks role |
| --- | --- | --- | --- | --- |
| Host plan | BeauRocks | Host Dashboard access and plan capabilities | Plan choice and cancellation | Merchant and service provider |
| Usage overage | BeauRocks | Continued metered capability use | Budgets, warnings, and hard limits | Meter owner and merchant |
| Host Tip | Host or Host's payment provider | No required in-app value | Link, QR, label, visibility | Presentation and outbound handoff in v1 |
| BeauBucks purchase | BeauRocks | Defined BeauBucks amount | Whether purchases are enabled and which allowed room actions are visible | Merchant, ledger owner, and fulfillment owner |
| Fundraiser Support | Named fundraiser/provider | Provider-defined contribution plus any disclosed room celebration | Provider, campaign, label, and optional reward policy | Presentation, verified webhook integration where supported |

### Required separation

- A Host Tip must never be labeled as a BeauBucks purchase.
- A BeauBucks purchase must never be described as a tip to the Host.
- Fundraiser Support must name the fundraiser or recipient.
- Points remain non-cash participation feedback and must not be sold as though they were BeauBucks.
- Any room celebration or bonus attached to external Support must be described separately from the payment itself.

## Delivery and review protocol

Only one slice is `in progress` at a time unless the owner explicitly authorizes parallel work.

Each slice ends with a review packet containing:

1. Outcome in customer language.
2. Changed contracts and files.
3. Before/after screenshots for affected surfaces.
4. Automated test and build results.
5. Data migration or rollout status.
6. Analytics added and expected signals.
7. Known gaps and risks.
8. One to three owner decisions, only when a decision materially changes later work.
9. Rollback or disable path.

Slice status vocabulary:

- `planned`
- `in progress`
- `ready for review`
- `accepted`
- `blocked`

A slice is not `accepted` because its code is written. It is accepted only after its contract, product behavior, and evidence are reviewed.

## Slice 0 — Product, access, and money contract

Status: in progress; isolated backend authority vertical complete, production checkout disabled

### Outcome

One approved source of truth explains who pays, who can create rooms, what each money rail means, and which vocabulary appears on each surface.

### Work

- Approve this roadmap's product and money-flow boundaries.
- Create one machine-readable or imported plan catalog used by client and Functions.
- Remove `BROSS`, `organization subscription`, and legacy VIP language from new customer-facing checkout copy.
- Document subscription states: trialing, active, past due, canceled at period end, canceled, and support override.
- Document room behavior for each subscription state.
- Decide whether a first-room trial is part of the Host plan funnel.
- Treat approved Host access as a rollout override with audit evidence.

### Acceptance

- The Host Dashboard, Functions, Marketing, and support documentation describe the same Host access rule.
- All five money rails have an explicit recipient and value contract.
- No public copy conflates Points, BeauBucks, Host Tips, or Support.
- No later slice depends on an unresolved meaning of `Host`, `Workspace`, `Room`, or `BeauBucks`.

### Owner review

- Confirm whether any trial is allowed before the first payment.
- Confirm the desired grace behavior for a Host already running a room when a subscription becomes past due or canceled.
- Confirm whether annual and monthly remain the initial plan choices.

## Slice 1 — Host plan as the room-creation gate

Status: planned

Depends on: Slice 0

### Outcome

A person can create a full account, choose a Host plan, pay, and receive room-creation access without manual approval.

### Current foundation

- Stripe subscription checkout and Billing Portal exist.
- Webhooks project subscription state into Workspace entitlements.
- `provisionHostRoom` already requires subscription entitlement or approved Host access.
- Host Monthly and Host Annual exist at `$15/month` and `$150/year`.

### Work

- Make Host plan checkout the normal public access path.
- Retain approved Host access behind an explicit rollout/support flag.
- Centralize the room-creation entitlement, for example `rooms.create`.
- Enforce it in both Host Dashboard presentation and Functions.
- Make subscription webhook reconciliation idempotent and observable.
- Add a clear canceled/downgraded state to the Host Dashboard.
- Preserve access to Billing, previous Room Recaps, and account data after downgrade while blocking new room creation when required by policy.
- Add recovery for delayed or failed webhook fulfillment.

### Acceptance

- A new customer can go from account to active Host plan to room-creation access without staff action.
- A guest or unpaid account cannot invoke room provisioning.
- A duplicated checkout or webhook does not create duplicate entitlements.
- Cancellation and renewal update access according to the approved state table.
- The Host sees one plain-language action when access is missing.

### Review packet focus

- Checkout copy and plan presentation.
- Subscription-state matrix.
- Paid, canceled, past-due, and webhook-retry demonstrations.

## Slice 2 — First room and Tonight Setup

Status: planned

Depends on: Slice 1

### Outcome

A newly paid Host can set up tonight and launch a private room without learning the Admin structure.

### Work

- Route a first-time Host into Room Readiness and Tonight Setup.
- Ask only for room name, privacy/join choice, room control, and media readiness before launch.
- Use the existing room-control choices: Host-Led, Assisted Host, and Crowd-Driven.
- Default new consumer rooms to private and off Discover.
- Make `Launch Room` open Public TV and copy the guest link.
- Confirm that private room code and guest passcode behavior is understandable.
- Put advanced Points, BeauBucks, Support, branding, and public listing decisions after the basic room can launch.
- Capture time-to-first-room and setup abandonment.

### Acceptance

- A first-time Host launches a private golden-path room without entering Advanced.
- The TV, Host Dashboard, and Audience App resolve the same room and join policy.
- The Host can explain which room-control choice is active.
- The Host can recover from a closed TV window or copied-link failure.

### Owner review

- Review the exact first-room questions and defaults.
- Review whether Crowd-Driven should be offered during first-run setup or after the first successful room.

## Slice 3 — Usage visibility and Host cost controls

Status: planned

Depends on: Slices 0–2

### Outcome

The Host can see and control variable usage before it becomes an unexpected charge.

### Current foundation

- Workspace usage documents already reserve units transactionally.
- AI generation, YouTube Data requests, and Apple Music API requests have included allowances, hard limits, and overage rates.
- Usage summaries and invoice drafts already exist.

### Work

- Validate every meter against actual provider cost and quota behavior.
- Separate provider cost, internal reserve, and customer rate.
- Define billable meters only for capabilities a customer can understand.
- Add Money > Usage with current use, included allowance, estimated overage, and hard limit.
- Add Host-controlled monthly budget and per-room budget where technically enforceable.
- Add warning thresholds such as 50%, 80%, and 100%.
- Add per-capability choices: allow overage, stop at allowance, or require confirmation.
- Define graceful degradation for each meter.
- Attribute usage by room, source, surface, and actor without exposing private guest data.

### Acceptance

- Usage reservation is atomic and cannot exceed the configured hard limit.
- Host and backend calculate the same allowance and estimated overage.
- A stopped meter produces a useful fallback rather than a broken room.
- A Host can identify which room and capability produced meaningful usage.
- No raw cloud-provider jargon is required to understand the bill.

### Owner review

- Approve the customer-facing rate card and markup policy.
- Approve default overage behavior: allowed, confirmation required, or disabled.
- Approve which meters remain internal-only.

## Slice 4 — Usage overage collection and reconciliation

Status: planned

Depends on: Slice 3

### Outcome

Validated overages can be charged to the Host and reconciled without manual spreadsheet work.

### Work

- Create an append-only usage billing ledger separate from the mutable live summary.
- Seal a billing period before creating charges.
- Generate idempotent Stripe invoice items or the chosen equivalent.
- Store rate-card snapshots with each billed line.
- Support credits, corrections, refunds, and disputed usage.
- Reconcile reserved units, settled units, invoiced units, and paid units.
- Keep base subscription and usage charges legible as separate lines.
- Add internal anomaly and margin reporting.

### Acceptance

- Replaying a period close cannot duplicate a charge.
- Every overage line traces to a meter, period, rate snapshot, and settled unit count.
- A corrected meter produces a credit or adjustment rather than rewriting history.
- The Host can view the amount before or at invoice issuance according to approved policy.
- Test-mode Stripe reconciliation is exact before production activation.

### Review packet focus

- One zero-overage invoice.
- One valid-overage invoice.
- One correction or credit.
- One duplicate-close attempt.

## Slice 5 — Host Tip screen

Status: planned

Depends on: Slice 2

Can precede Slice 4 because v1 uses an outbound Host-owned payment destination.

### Outcome

A Host can optionally add a clearly labeled Tip the Host action to their room and receive tips through their chosen payment destination.

### Work

- Add a simple Host Tip configuration inside Money > Tips + Boosts.
- Support a Host-owned URL and QR presentation first.
- Let the Host choose label, short explanation, and visibility locations.
- Show the recipient before the guest leaves BeauRocks.
- Do not promise a receipt, refund, or in-app reward when BeauRocks does not process the payment.
- Remove the current BeauRocks fallback Venmo link from rooms that have no Host destination.
- Keep optional on-screen thank-you moments separate from verified payment unless an integrated provider confirms payment.
- Evaluate Stripe Connect only as a later native payout option with identity, tax, dispute, and fee requirements.

### Acceptance

- A Host Tip goes to the Host's configured destination, not BeauRocks.
- Rooms without a configured destination show no Host Tip CTA.
- Guests can distinguish Host Tip from BeauBucks purchase and fundraiser Support.
- Invalid or unsafe URLs are rejected.
- Private Host payment data is not exposed beyond the intended link or QR.

### Owner review

- Review where Host Tip appears in Party, Public TV, and Room Recap.
- Decide whether Host Tips may trigger an unverified thank-you animation or only a neutral outbound handoff.

## Slice 6 — Money-action clarity and checkout ownership

Status: planned

Depends on: Slices 0 and 5

### Outcome

Every money-related action tells the guest what it is, who receives the money, and what happens next.

### Work

- Inventory every checkout and outbound payment action.
- Rename the current platform-collected `tip_crate` presentation to Room Boost or another existing approved product label; it is not a Host Tip.
- Add a shared disclosure component for Host Tip, BeauBucks purchase, Room Boost, and Support.
- Make checkout success mean `payment confirmed` only after verified provider evidence.
- Prevent a returned success URL from granting value by itself.
- Standardize receipts, support ownership, cancellation, and error copy.
- Add analytics that distinguish checkout opened, payment confirmed, fulfillment completed, and fulfillment failed.

### Acceptance

- No screen uses `tip` for both Host-directed money and BeauRocks-collected purchases.
- Every paid action has a verified fulfillment owner.
- Browser-return URLs cannot forge fulfillment.
- Support can identify the provider and transaction type from a stable ID.

## Slice 7 — BeauBucks purchase and balance authority

Status: planned

Depends on: Slices 0, 4, and 6

### Outcome

Guests can buy BeauBucks from BeauRocks and spend them on clearly defined in-app actions, while Points remain earned and non-cash.

### Current foundation

- Stripe points-pack checkout and webhook fulfillment exist.
- The BeauBucks shadow ledger and reconciliation contract exist.
- Server-authoritative BeauBucks spending remains canary-gated.

### Work

- Stop marketing purchased packs as Points.
- Define the BeauBucks pack catalog, pricing, expiration policy, and refund behavior.
- Decide whether BeauBucks are room-scoped, account-scoped, event-scoped, or a deliberately limited combination.
- Complete the published BeauBucks canary evidence gate before changing balance authority.
- Make purchases, grants, spends, refunds, expirations, and chargebacks ledger entries.
- Grant BeauBucks only from verified payment webhooks.
- Add Host controls for whether purchases and eligible spend actions are enabled tonight.
- Preserve competitive integrity: BeauBucks do not buy a winner by default.
- Present the BeauBucks balance and transaction history clearly in the Audience App.

### Acceptance

- Points and BeauBucks never reconcile into the same balance.
- Every balance derives from immutable ledger entries.
- Duplicate webhooks and duplicate spend requests are idempotent.
- Refunds and chargebacks reverse value according to an approved policy.
- Guests can state what they bought and where it can be used.
- Host settings cannot mint purchased value without an auditable grant authority.

### Owner review

- Approve scope and portability of BeauBucks.
- Approve the first allowed spend actions.
- Approve expiration and refund policy before production checkout.

### 2026-07-22 checkpoint

The first backend-only vertical now exists without changing the live Points economy. It defines a room-scoped internal `Starter 1,200 BeauBucks` test pack, exact verified-webhook fulfillment, an authoritative ledger/account projection, reaction-only spending, proportional refund reversal, chargeback restriction and shortfall evidence, and private Audience purchase proof. Emulator coverage proves purchase and spend replay safety and proves legacy Room/global Points remain unchanged.

This is not a public offer. The commercial contract keeps both checkout and the pack's public-offer flag off, no production Room/host is allowlisted by this change, and no Audience storefront or primary Host control is connected. The out-of-order webhook blocker is now closed with bounded pending evidence and fulfillment-time recovery. Remaining owner gates are pack economics, scope/portability, customer-facing refund and expiration terms, support/tax treatment, and simplified Host/Audience controls.

## Slice 8 — Room Boosts and room-controlled consumption

Status: planned

Depends on: Slice 7

### Outcome

The Host can choose which BeauBucks-powered interactions are available, and those purchases drive understandable room participation without making the night pay-to-win.

### Work

- Define a small first set of spend actions using existing language: reactions, profile changes, avatar unlocks, and selected Room Boosts.
- Keep queue priority off by default.
- Separate personal benefits from room-wide benefits.
- Show price and result before confirmation.
- Give the Host safe presets rather than raw economy fields during Tonight Setup.
- Add per-room spend caps and abuse controls.
- Connect purchases to Public TV celebrations only after confirmed fulfillment.
- Measure purchase conversion, spend-through, and unused balance.

### Acceptance

- Money cannot silently change queue order or competitive results.
- Personal and room-wide outcomes are distinguishable.
- A disabled action cannot be purchased or spent through direct API calls.
- Every Public TV purchase celebration corresponds to a verified operation.

## Slice 9 — Assisted Host and Crowd-Driven reliability

Status: planned

Depends on: Slice 2

May progress in parallel with Slices 5–8 only after owner approval.

### Outcome

A private-party Host can choose how hands-on to be while retaining one obvious recovery path.

### Work

- Harden Host-Led, Assisted Host, and Crowd-Driven as the primary room-control choices.
- Make Auto-DJ ownership and status visible.
- Make queue-empty, singer-not-ready, backing-failed, and low-participation fallbacks deterministic.
- Preserve `Host can step in anytime` across all control choices.
- Use BeauRocks Open Stage only where its current self-service format contract is actually active.
- Keep BeauRocks Spotlight Auction fundraiser-specific.
- Add a concise Why this happened explanation for automated decisions.
- Add multi-hour private-party smoke coverage across Host Dashboard, Audience App, and Public TV.

### Acceptance

- Assisted Host can move between performances without hidden stage ownership.
- Crowd-Driven does not stall when the queue or vote pool is small.
- The Host can return to Host-Led behavior without rebuilding the room.
- Provider or device failure produces a visible recovery action.
- No automation can create a paid-priority outcome unless the room explicitly selected that format.

### Owner review

- Review the behavior and naming of the three room-control choices.
- Decide the evidence threshold before marketing a room as self-hosted rather than Host-assisted.

## Slice 10 — Content-agnostic private-party media path

Status: planned

Depends on: Slices 2, 3, and 9

### Outcome

A Host can run a night using available tracks and connected sources without guests needing to understand providers.

### Work

- Keep Audience App requests centered on songs.
- Resolve known and trusted backing versions before live provider search.
- Show Host-facing capability labels such as TV Karaoke, Apple Sing-Along, Room Upload, External Playback, and Review Needed.
- Maintain YouTube quota reserve and graceful degradation.
- Make uploads and local/host-provided media first-class fallbacks.
- Make provider connection and playback failures visible before launch through Room Readiness.
- Track successful backing reuse and failed resolutions by source.
- Keep music-rights responsibility language accurate and visible where needed.

### Acceptance

- Guests can request songs without selecting a provider.
- Host can identify whether a backing version is ready for Public TV.
- Quota exhaustion does not produce an empty catalog.
- A failed provider does not erase the queue or block Host recovery.

## Slice 11 — Private-party marketing and organic acquisition

Status: planned

Depends on: accepted positioning from Slice 0 and truthful availability from Slices 1–2

### Outcome

The public site attracts people who want to run karaoke themselves at home or at private events and routes them into the correct current Host action.

### Work

- Keep the homepage promise: turn karaoke night into a room-wide party game.
- Lead with private gatherings and party nights rather than professional karaoke operations.
- Explain the Host Dashboard, Public TV, Audience App, and Room Recap using shipped language.
- Explain Host-Led, Assisted Host, and Crowd-Driven without exposing internal policies.
- Build useful pages for karaoke at home, private karaoke parties, birthdays, weddings, corporate gatherings, holiday parties, and fundraisers.
- Preserve `Join`, `Discover`, and `Charts` as public utilities.
- Use `Join Host Waitlist` until self-serve paid access is operational; then move to an approved plan-selection CTA.
- Add visible, indexable text and structured data that matches the page.
- Add internal links from use-case pages to Host plans, demo, and relevant Room Recaps or Charts.
- Keep lyrics and copyrighted content out of SEO pages unless separately licensed.

### Acceptance

- A visitor can explain that BeauRocks runs the room but does not provide licensed karaoke music.
- The primary Host CTA matches actual access availability.
- Each page has one clear intent and one primary conversion.
- Important content is present in static or server-generated output for search and AI crawlers.
- Analytics distinguish use case, CTA, and completed Host activation.

### Owner review

- Review homepage hierarchy and the first four use-case pages before expanding the content cluster.
- Review plan/pricing disclosure before publishing commercial claims.

## Slice 12 — Charts, Room Recaps, and Discover growth loop

Status: planned

Depends on: core room reliability and accepted privacy boundaries

### Outcome

Real activity from BeauRocks rooms creates reasons to return, share, and discover another night without exposing private-event details.

### Work

- Keep Charts vocabulary: Singers, Songs, Karaoke Nights, song crown, crown holder, opening score, top score, chart points, and night points.
- Add sanitized top-three qualified performances per song.
- Keep opening scores separate from real performances and structured achievement data.
- Add useful Crown moments to Public TV, Audience App, and Room Recap only when evidence-backed.
- Preserve the current boundary where an eligible singer/song achievement may remain while a private room and public-night artifact stay private.
- Continue Vibe Index evidence collection for Hosts and Venues.
- Use literal future labels such as Most Active Hosts and Most Active Venues rather than inventing another scoring brand.
- Publish Vibe Index values only after evidence, stability, moderation, and confidence gates pass.
- Add indexable song and entity pages only when they contain substantial first-party information.

### Acceptance

- No private location, room, or guest identity leaks through Charts, Room Recaps, or Discover.
- Opening scores cannot be mistaken for real singer performances.
- Chart removal or moderation rebuilds every affected projection.
- Host and Venue activity claims are traceable to verified evidence.
- Search pages provide unique value rather than thin generated variants.

## Slice 13 — Commercial operations and staged release

Status: planned

Depends on: all commercial slices selected for launch

### Outcome

A stranger can pay, create a private room, understand usage, run the night, receive support, and resolve a billing problem without direct founder intervention.

### Work

- Define support ownership for subscription, usage, Host Tip handoff, BeauBucks, and fundraiser Support.
- Add payment, usage, provider, and room-health observability.
- Add refunds, chargebacks, account export/deletion, and incident procedures.
- Complete accessibility and mobile acceptance for checkout and room launch.
- Review tax, stored-value, payout, donation, and consumer disclosure language with qualified counsel.
- Run a controlled commercial cohort before unrestricted access.
- Separate feature rollout flags from subscription entitlement truth.
- Record deployment, rollback, and reconciliation evidence.

### Acceptance

- Subscription and BeauBucks payment reconciliation is exact.
- Host Tip money does not accidentally enter BeauRocks settlement in the outbound-link model.
- Support can trace every paid action by stable ID.
- A failed deploy or provider outage has a tested rollback or degradation path.
- Commercial claims match production behavior.

## Recommended review gates

### Gate A — Business contract

After Slice 0.

Approve payer, access rule, subscription states, money rails, vocabulary, and trial posture.

### Gate B — Paid Host activation

After Slices 1–2.

Approve checkout, entitlement, Tonight Setup, room defaults, and first-room experience.

### Gate C — Margin protection

After Slices 3–4.

Approve meters, rates, budgets, overage behavior, and invoice reconciliation.

### Gate D — Room money

After Slices 5–8.

Approve Host Tip, checkout disclosures, BeauBucks scope, and allowed Room Boosts.

### Gate E — Self-hosted product promise

After Slices 9–10.

Approve what Host-Led, Assisted Host, Crowd-Driven, and content-agnostic reliability can truthfully promise.

### Gate F — Public growth story

After Slices 11–12.

Approve the homepage, use-case pages, Charts, Room Recaps, Discover, and Vibe Index rollout language.

### Gate G — Commercial launch

After Slice 13.

Approve the specific cohort or unrestricted release based on operational evidence.

## Key metrics

### Host acquisition and activation

- Visitor to Host-plan checkout start
- Checkout completion
- Paid Host to first room created
- Median time to first Launch Room
- First room to second room within 30 days
- Rooms per paid Host per billing period

### Room quality

- Successful joins per room
- Song requests reaching the queue
- Performances completed
- Queue stalls and recovery time
- Auto-DJ interventions and Host overrides
- Room completion and Room Recap readiness

### Financial

- Host-plan monthly recurring revenue
- Revenue per paid Host
- Provider cost and internal reserve per paid Host
- Gross margin by plan and room cohort
- Usage overage incidence and capture
- Refund, chargeback, and payment-failure rate

### Host Tips and BeauBucks

- Rooms enabling Host Tips
- Host Tip CTA opens, without treating opens as completed payments
- BeauBucks checkout conversion
- Purchased BeauBucks, spent BeauBucks, and unused balance
- Spend by allowed action
- Ledger reconciliation and duplicate-prevention results

### Growth

- Guests per room
- Guest account continuation
- Guest to future paid Host conversion
- Room Recap views and shares
- Qualified performances entering Charts
- Songs receiving their first real qualified score
- Discover visits that lead to Join

## Adversarial findings incorporated into the sequence

1. The current approved-Host bypass can obscure whether subscription access truly works. Slice 1 makes it a visible rollout exception.
2. Current overage invoices are drafts, not automatic Stripe collection. Slices 3 and 4 separate meter accuracy from money collection.
3. The current Stripe `tip_crate` checkout collects money through BeauRocks and grants points. It cannot be presented as a Host Tip. Slices 5 and 6 split those rails.
4. Selling Points conflicts with the current promise that Participation points are non-cash. Slice 7 moves purchased value to BeauBucks.
5. A platform that receives and pays out Host Tips creates identity, tax, dispute, and compliance work. Slice 5 starts with a Host-owned outbound destination.
6. Crowd-Driven and Auto-DJ are not yet permission to claim fully unattended operation. Slice 9 creates a separate evidence gate.
7. Private-party acquisition will fail if the first screen emphasizes professional karaoke operations. Slice 11 leads with private gatherings while preserving venues and recurring Hosts as later paths.
8. Public growth features must not force a private room to become a public listing. Slice 12 preserves separate room, singer/song, and public-night privacy boundaries.

## Proposed starting point

Begin with Slice 0 and do not change production billing behavior yet.

The first owner review should settle:

1. Whether payment is required before the first room, or whether a limited first-room trial is allowed.
2. What happens to room creation and an already-live room when a Host subscription becomes past due or canceled.
3. Whether Host Monthly and Host Annual remain the only initial paid plans.

Once those decisions are accepted, Slice 1 can implement the commercial Host access path without later reworking its entitlement model.
