# BeauBucks Paid Canary Activation Runbook

Date: 2026-07-22

## Current answer

The BeauBucks product authority is implemented and deployed fail-closed. The Audience App can show a separate Room-scoped BeauBucks balance, the Host has one `BeauBucks tonight` control in authorized Rooms, paid reactions use the server ledger, and checkout cannot open under the current commercial contract.

The paid canary is **not ready to activate** until the owner decisions below are recorded. Run:

```text
npm run ops:report:beaubucks-activation-readiness
```

Use `-- --strict` in a release job. A blocked packet exits with code 2. The command is read-only and never changes production.

## Remaining owner decisions

The checked-in proposals live in `docs/costs/beaubucks_activation_decision_inputs.json`. Values marked `not_approved`, blank owners, blank decision references, and an empty Room list are intentional blockers.

1. Product policy
   - Recommended: BeauBucks stay in the current Room, have no cash value, cannot transfer, and pay only for reactions.
   - BeauBucks cannot buy a score, a win, or queue priority.
2. Starter pack and cost envelope
   - Recommended first pack: `1,200 BeauBucks` for `$5.00 USD`.
   - One completed pack per buyer per Room is enforced on the server.
   - The cheapest reaction costs 2 BB, so one pack permits at most 600 spend operations. Each authoritative spend performs at least the operation, account, and ledger writes: a minimum authority envelope of 1,800 writes per fully spent pack, before existing Room reaction delivery.
3. Customer promises
   - Recommended canary promise: no expiration during the canary.
   - Recommended refund path: contact `hello@beaurocks.app`; a refund reverses the proportionate unspent BeauBucks, while immutable records preserve any spent-value shortfall.
   - Point-of-purchase copy and the public Terms section must be reviewed and shipped before checkout activation. This document is operational guidance, not legal advice.
4. Commercial operations
   - Confirm BeauRocks as merchant of record.
   - Name the support/refund owner and Stripe-to-ledger reconciliation owner.
   - Confirm the monitored support address and a response target no longer than 72 hours.
   - Record owner or professional review of sales-tax treatment and accounting treatment for unused Room balances and refunds.
5. Controlled cohort
   - Choose exactly one production Room.
   - Recommended bounds: no more than 10 named testers, no more than $50 gross sales, no more than 14 days, and a named rollback owner.
   - Keep a manual tester roster even though the one-pack-per-buyer cap is server-enforced.
6. Final activation approval
   - Record who approved the paid production canary and the decision reference.

## Engineering gates already closed

- Checkout requires authenticated membership in an authorized and Host-enabled Room.
- The registered pack, amount, currency, and BeauBucks grant must match at checkout and fulfillment.
- Verified Stripe webhook fulfillment is the only purchase grant authority.
- Duplicate webhook delivery is idempotent.
- Refunds and chargebacks create compensating entries; they do not rewrite history.
- Refund-before-purchase and chargeback-before-purchase ordering is recovered transactionally.
- One completed purchase per buyer per Room is enforced from the server account projection.
- A transactional 35-minute reservation rejects concurrent checkout creation and expires with the Stripe Checkout Session.
- The wallet withholds the purchase button after a purchase or while another checkout is active.
- The first pack's maximum spend/write envelope is calculated by the readiness report from the live reaction-cost contract.

## Separately reviewed activation change

Only after the strict preflight passes:

1. Add the approved BeauBucks purchase/refund/expiration language to the public Terms and the Audience point-of-purchase card.
2. Re-run focused tests, the full BeauBucks callable emulator suite, lint, and the production build.
3. In one reviewed source change, set `beauBucksPolicy.status` to `active`, `checkoutEnabled` to `true`, and only the approved starter pack's `publicOffer` to `true`.
4. Put only the approved Room code in `BEAUBUCKS_AUTHORITY_ROOM_CODES`; do not use a Host-wide allowlist for the first paid canary.
5. Set that Room's admin-owned `eventCredits.beauBucksAuthorityEnabled` permission. Let the Host control `BeauBucks tonight`; do not force the Host choice on.
6. Deploy the Audience/Host hosting release and the bounded functions: `updateRoomAsHost`, `getMyRoomBeauBucksWallet`, `spendAudienceBeauBucks`, `createBeauBucksCheckout`, and `stripeWebhook`.
7. Verify one real $5 purchase with a named tester, balance proof, one paid reaction, activity proof, duplicate webhook safety, and the post-purchase purchase-button lock.
8. Reconcile Stripe gross payment, checkout record, payment reference, purchase ledger entry, account projection, and any spend entries before inviting the rest of the cohort.

## Stop and rollback

Stop new purchases if the Stripe amount, ledger grant, Room scope, activity proof, support path, or per-buyer limit disagrees. Disable checkout and the public pack in the commercial contract, remove the Room from the server allowlist, and redeploy the same bounded functions. Do not delete or rewrite balances or ledger entries. Existing paid value must remain spendable in the supported Room or be handled through the approved refund process.

## What comes next

After the paid canary is reconciled, the planned product sequence remains:

1. Room Boosts and Host-controlled consumption, with no pay-to-win mechanics.
2. Assisted Host and Crowd-Driven reliability.
3. Content-agnostic private-party media and degraded-provider behavior.
4. Offline safety, then a resilient shell, single-device offline operation, and later LAN operation.
5. Private-party marketing, Charts, Room Recaps, Discover, and commercial operations expansion.

General release is a new gate. It should replace the manual roster with automated cohort/sales ceilings and revisit Room portability, expiration, taxes, support load, and refund behavior using canary evidence.
