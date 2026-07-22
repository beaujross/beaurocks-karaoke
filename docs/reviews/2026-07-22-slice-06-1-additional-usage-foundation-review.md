# Slice 06.1 Review - Additional usage foundation

Date: 2026-07-22
Status: foundation deployed; checkout and auto-refill disabled; Gate C3 open
Parent slice: Slice 06 - Prepaid usage packs and capped auto-refill
Gate: C3 remains open

## Outcome

BeauRocks now has the server contract needed to add prepaid Room capacity without extending an uncontrolled loan. The Host Dashboard truthfully shows that Additional usage purchases and auto-refill are not open. No pack, price, checkout action, or automatic charge was introduced.

This is a foundation sub-slice, not completion of Slice 06. The first customer-facing unit, pack economics, refund and chargeback fulfillment, receipts, pre-event estimates, and capped auto-refill still require implementation and owner approval.

## Liability boundary

- `additionalUsagePolicy.checkoutEnabled` is `false` and the approved pack catalog is empty.
- `additionalUsagePolicy.autoRefillEnabled` is `false`; any future auto-refill requires a Host-selected monthly maximum.
- Capacity can be granted only by a verified Stripe `checkout.session.completed` webhook.
- The server requires the exact checkout type, paid status, Workspace, UTC billing period, enabled pack, amount, currency, and known meter capacity.
- The append-only ledger is keyed by Stripe Checkout Session, so retries or multiple event IDs for one payment cannot grant twice.
- The capacity aggregate and ledger are under default-denied Firestore paths and have no client write surface.
- A canceled, inactive, or non-Host plan cannot use prepaid capacity.
- Workspace and Room ceilings remain Host safety controls. Additional capacity raises the allowable maximum; it does not override a lower configured ceiling.
- Reservation reads monthly capacity and current exposure in the same Firestore transaction. Concurrent Rooms therefore cannot spend past the shared Workspace ceiling.

## Data contract

- Monthly aggregate: `organizations/{orgId}/usage_capacity/{YYYYMM}`
- Append-only fulfillment ledger: `organizations/{orgId}/additional_usage_ledger/{stripeCheckoutSessionId}`
- Aggregate meter fields: `granted`, `revoked`, and computed active capacity (`granted - revoked`)
- Usage-operation snapshots now retain plan hard limit, Additional usage capacity, combined maximum, Workspace ceiling, and optional Room ceiling.

Refunds and chargebacks will add future adjustment entries and increment `revoked`; they must not edit or delete purchase-grant history.

## Host Dashboard

Money > Billing & Usage now includes an Additional usage readiness panel with:

- `Purchases not open` while checkout is disabled;
- auto-refill shown as `Off`;
- an explicit no-uncapped-overage promise;
- active prepaid capacity for the selected period when present;
- the combined current maximum in Cost Guardrails while preserving the Host-selected Workspace ceiling.

The UI contains no purchase button and publishes no unvalidated price.

## Verification

- Syntax checks passed for Functions and both changed integration suites.
- Focused prepaid-capacity, entitlement, and usage-control unit tests passed: 9 tests.
- Full unit suite passed: 316 files, 1,135 tests.
- Usage-operation emulator passed, including plan-plus-prepaid maximum reporting and controls.
- Signed webhook emulator passed, including refusal of the disabled Additional usage checkout without a grant or accidental subscription projection.
- Firestore and Storage rules suite passed.
- Focused lint passed with zero errors; 18 pre-existing Host hook warnings remain.
- Production build passed and generated 135 prerendered routes and 132 social cards.
- The repository-wide lint plus build command was attempted concurrently and hit the five-minute combined timeout without reporting an error. Both changed primary files passed focused lint, and the production build then passed independently.

## Required owner decisions before checkout

1. Approve the first customer-facing unit: included private karaoke night, Room-hour, or another evidence-backed allowance.
2. Approve the duration and active-guest band represented by that unit.
3. Approve pack capacity, price, target gross margin, and maximum BeauRocks-funded exposure.
4. Approve expiration, refund, and chargeback behavior.
5. Approve receipt copy that separates the Host plan from Additional usage.
6. Approve auto-refill size, warning threshold, immediate-disable behavior, and required monthly ceiling.
7. Approve the production cohort size for Gate C3.

## Controlled production deployment

- Hosting release: `1784711753917000`
- Hosting version: `23346e2878422268`
- Live Host asset: `HostApp-C2KTSASp.js`
- Usage and fulfillment revisions: `getmyusagesummary-00138-waz`, `managemyusagecontrols-00003-sov`, and `stripewebhook-00147-xes`
- YouTube revisions: `youtubesearch-00148-lif`, `youtubeplaylist-00147-cep`, `youtubestatus-00148-dah`, `youtuberefreshindexentries-00045-tex`, and `youtubedetails-00147-vav`
- AI and Apple/lyrics revisions: `geminigenerate-00146-nev`, `applemusiclyrics-00151-bec`, `resolvequeuesonglyrics-00109-kam`, and `autoapplelyrics-00147-vav`
- Background trivia revisions: `autopoptrivia-00093-xaf`, `backfillpoptriviaonroomenable-00093-yiy`, and `recoverpendingpoptrivia-00093-ced`
- Live smoke returned HTTP 200 for index, entry, main, and Host assets and found all three required readiness strings.
- No pack, price, checkout function, purchase button, auto-refill setting, postpaid behavior, Firestore rule, or payment configuration was enabled.

## Rollback

- Keep `checkoutEnabled`, `autoRefillEnabled`, and the pack catalog disabled to preserve the current no-sale state.
- Revert the Host readiness panel without affecting subscription or usage enforcement.
- Revert plan-plus-prepaid maximum resolution to the plan-only maximum; no production capacity document exists in this sub-slice.
- Revert the webhook branch; the disabled catalog currently prevents it from writing any grant.
