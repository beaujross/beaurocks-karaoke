# Slice 06.3 Review - Plan a Room capacity estimate

Date: 2026-07-22
Status: deployed and live-smoked; no price quote or checkout; Gate C3 open
Parent slice: Slice 06 - Prepaid usage packs and capped auto-refill

## Outcome

Workspace owners and admins can now plan a future Home party, Private event, or Large event by date and duration in Money > Billing & Usage. BeauRocks returns an expected-to-high-use request range and compares it with the selected month’s authoritative metered Workspace request ceilings and current exposure.

This is a capacity-planning tool, not a cost calculator. It does not expose BeauRocks infrastructure costs, provisional margins, internal reserve values, unvalidated overage rates, or an Additional usage price. It does not reserve capacity, create a Room, create a ledger entry, write telemetry, or open checkout.

## Public planning contract

- Home party: up to 25 active guests, three-hour default.
- Private event: up to 75 active guests, four-hour default.
- Large event: up to 180 active guests, six-hour default.
- Duration may be planned from one to twelve hours.
- Each supported meter returns expected and high-use modeled units, current exposure, Workspace ceiling, remaining capacity, fit state, and possible additional headroom.
- The high-use range uses the existing provisional 1.5x stress multiplier; it is not described as measured p95 evidence.
- The result is a timestamped snapshot of the three enforced provider-request meters; it explicitly does not claim to predict every database read/write or media transfer.
- Results use `fits current capacity`, `plan for more headroom`, or `Host plan required` rather than a purchase recommendation.
- Recovery guidance names cached/indexed tracks, local media, reduced fresh provider use, a smaller Room plan, or prepaid capacity only after purchases open.

## Server authority and privacy

`previewMyRoomCapacity` requires authentication, App Check under the existing enforcement mode, and Workspace owner/admin membership. It is rate-limited and read-only. It reads the same server-owned usage, Workspace controls, and Additional usage aggregate used by reservation enforcement. A non-owner member is denied.

The response contains no raw usage documents, actor/Room breakdowns, provider secrets, prices, cloud-cost components, or billing rates. The client cannot supply its own baseline demand or high-use multiplier.

## Model integrity

The planning bands and baseline request demand live in `functions/lib/roomCostEnvelopeContract.json`. Contract validation requires finite duration bounds, no public pricing, a high-use multiplier of at least one, and positive demand for every supported meter. Tests require each planning baseline to remain equal to the corresponding scenario in `docs/costs/nightly_cost_model_inputs.json`, preventing silent drift between the Host estimate and the internal cost model.

## Evidence boundary

The read-only 90-day production report on 2026-07-22 found:

- one observed Room-day and one Room;
- one Host observation;
- zero sampled Audience observations and zero Public TV observations;
- one Home party-band Room-day;
- zero Private event and Large event Room-days;
- no raw identity fields and no observation-contract violations.

`percentileEvidenceReady` is false. The report still needs 29 Room-days overall, four more Home party Room-days, five Private event Room-days, five Large event Room-days, and at least one sampled Audience observation. The Host UI therefore says `Early planning range` and explicitly rejects price, bill, reservation, and availability-guarantee interpretations.

## Verification

- Focused Room-capacity and Room-cost model tests passed: 6 tests.
- Full unit suite passed: 317 files, 1,140 tests.
- Usage callable emulator passed, including current-capacity comparison, no-price output, checkout-disabled output, and member denial.
- Complete Firestore and Storage rules suite passed.
- Focused lint passed with zero errors; 18 pre-existing Host hook warnings remain.
- Production build passed and generated 135 prerendered routes and 132 social cards.
- `git diff --check` passed.

## Remaining Gate C3 decisions

1. Gather representative Room and Audience evidence and reconcile it with provider/cloud billing.
2. Approve the first customer-facing Additional usage unit.
3. Approve pack capacity, price, target gross margin, and maximum BeauRocks-funded exposure.
4. Approve expiration and unused-capacity behavior.
5. Approve the existing any-refund/full-remaining-capacity revocation policy or replace it with a proportional policy.
6. Define capped auto-refill size, warning threshold, immediate off switch, and required monthly maximum.
7. Approve the controlled production cohort.

## Controlled production deployment

- `previewMyRoomCapacity` revision `previewmyroomcapacity-00001-vex` is Ready at 100% traffic.
- Hosting release `1784733914438000`, version `3b084952d2cafe56`, serves the planning UI.
- Live smoke returned HTTP 200 for entry asset `index-CgquBkBY.js` and Host asset `HostApp-Dp_25wcS.js`, then found all six required planning, fit-state, meter-boundary, and disabled-purchase strings.
- Additional usage checkout remains disabled, auto-refill remains disabled, and the pack catalog remains empty.

## Rollback

- Roll back the Host `Plan a Room` panel and callable independently; neither changes capacity or billing state.
- Remove the planning baseline fields only together with the estimator and parity assertions.
- Keep checkout and auto-refill disabled throughout rollback.
