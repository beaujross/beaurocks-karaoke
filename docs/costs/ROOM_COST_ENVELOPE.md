# Room Cost Envelope

Last updated: 2026-07-21  
Owner: Product / Engineering / Finance  
Status: Slice 04 controlled-cohort instrumentation active; not a public pricing or billing contract

## Decision

Room creation must remain commercially gated while BeauRocks measures and contains the maximum cost of a Room. The safe packaging direction remains a Host subscription with included use, followed by prepaid usage packs or capped auto-refill. The system must not create uncapped postpaid liability for BeauRocks or the Host.

The machine-readable contract is `functions/lib/roomCostEnvelopeContract.json`. Run `npm run qa:cost-envelope` to verify its source anchors and calculate the current envelope from `nightly_cost_model_inputs.json`.

## Current Envelope

The model separates direct provider sensitivity from BeauRocks' intentionally conservative feature reserve. `p95` and `p99` are stress multipliers, not measured percentiles, until Room-attributed telemetry is available.

| Guest band | Planning Room | Expected direct cost | p95 stress | p99 stress | Minimum revenue at provisional 80% margin (p99) |
|---|---|---:|---:|---:|---:|
| Home party (up to 25) | 3 hours | about $0.50 | about $0.75 | about $1.00 | about $5.01 |
| Private event (up to 75) | 4 hours | about $1.76 | about $2.65 | about $3.53 | about $17.65 |
| Large event (up to 180) | 6 hours | about $5.18 | about $7.77 | about $10.36 | about $51.80 |

These values are internal cost-defense inputs. They do not set public Host prices, included Room-hours, guest limits, or credit exchange rates.

## Top Marginal Drivers

For the existing Private event scenario, the direct-provider ranking is:

1. Hosting egress
2. Gemini provider sensitivity
3. Storage egress
4. Firestore reads
5. Storage at rest

YouTube search remains a quota and abuse-ceiling risk even when it is not a direct per-request invoice line. The existing `youtube_data_request` reserve is therefore retained as protection pricing, not described as true Google cost.

## Listener Finding

The first inventory covers the core live Room subscriptions on Host, Audience, and Public TV. The highest-risk patterns are:

- every Audience member formerly receiving an unbounded `room_users` collection; Slice 04.2 now caps Host, Audience, and Public TV participant subscriptions at 250, covering the 180-person planning band with headroom;
- Public TV formerly allowed its bounded reaction query to fall back to an unbounded query when an index was missing; Slice 04.2 now hard-bounds both paths to 250 documents;
- Host media and scene-preset listeners remaining mounted across every Host tab;
- Host, Audience, and Public TV formerly loaded full Room song history. Slice 04.2 now combines up to 250 active songs with the 250 most recent performances, with a hard-bounded 500-song missing-index fallback.

Slice 04.2 also separated the Host's VIP-contact read from its core Room subscription lifecycle. Navigating between Host tabs no longer tears down and re-subscribes every core, media, and scene listener.

All live media-library queries are now finite and lifecycle-gated: Host and Audience media lists are capped at 100 documents per source, Host scene-preset lists are capped at 50, Host media stays dormant outside Stage, Browse, Run of Show, Admin, or the Scene Library, and Audience Room uploads stay dormant outside Request browsing.

The Host activity subscription is reduced from 200 to the latest 80 Room events. The core inventory now contains no unbounded listener and no unresolved containment disposition.

## Room-attributed observations

Slice 04.3 records one idempotent observation per accepted Room/surface/actor UTC day in the internal `room_cost_observations` collection:

- Host sessions are sampled once after an eight-second hydration window.
- Audience sampling is deterministic at approximately 1/16 of joined sessions, with the same decision enforced by the server.
- Raw Audience UIDs are not stored; a one-way truncated actor hash is used only in the idempotency key.
- Every observed count is clamped to the live listener envelope.
- Observation documents include a 90-day expiry field, have a collection-specific Firestore TTL policy, and are never placed in the monthly usage rollup document.

This provides Room and surface evidence without creating one telemetry write for every guest or an unbounded analytics map.

Run `npm run ops:report:room-cost` for a read-only trailing-30-day production report using the active `gcloud` identity. Use `-- --days=90 --json` for the full retained window and machine-readable output. The report keeps observed Room shape separate from the Audience 1/16 session-equivalent projection, audits the payload for raw identity fields, and refuses to mark percentile evidence ready until at least 30 Room-days and five Room-days in every supported guest band have been observed.

The report is sampling evidence, not cloud-bill reconciliation. Reads, writes, Functions, egress, and provider totals must still be joined to the Google Cloud billing export and provider invoices before the provisional stress multipliers can be replaced.

### Production state

- `recordRoomCostObservation` is active in `us-west1` at revision `recordroomcostobservation-00001-gir`.
- The two bounded `karaoke_songs` indexes are deployed; missing-index reads remain hard-capped during index or rollback transitions.
- Firestore TTL for `room_cost_observations.expiresAt` is `ACTIVE`.
- Hosting release `1784704413290000`, version `71e3ad9c6d188b55`, serves the corrected Host and Audience observers.
- The first trailing-30-day report found one Host Room-day, no raw identity fields, and correctly left percentile readiness blocked pending representative coverage.

Each unbounded entry has a Slice 04.2 containment action in the machine-readable inventory. A retained live listener must be bounded or have an explicit singleton/real-time justification.

## Gate C1 Remaining Evidence

- Replace the critical unbounded listeners and verify behavior across Host, Audience, and Public TV.
- Record Room-attributed observations for reads, writes, functions, egress, AI, and provider requests.
- Replace stress multipliers with observed expected/p95/p99 values after a representative sample.
- Reconcile modeled usage to provider billing within an agreed tolerance.
- Approve the gross-margin floor, maximum BeauRocks-funded Room exposure, guest bands, and duration bands.
- Demonstrate that one abusive guest and one abandoned Room have bounded maximum exposure.

Until those checks pass, this document supports engineering decisions but does not open broader paid Host access.
