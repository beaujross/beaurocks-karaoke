# Slice 06.2 Review - Additional usage adjustments and receipts

Date: 2026-07-22
Status: deployed and live-smoked; checkout and auto-refill disabled; Gate C3 open
Parent slice: Slice 06 - Prepaid usage packs and capped auto-refill

## Outcome

BeauRocks can now reverse the remaining capacity associated with a future prepaid Additional usage purchase after a signed Stripe refund or chargeback event. The Host Dashboard can show an owner/admin a sanitized, period-scoped history of purchases and adjustments. This closes the accounting-integrity and receipt-foundation work from Slice 06.1 without opening a sale.

The production pack catalog remains empty. There is still no Additional usage checkout callable, purchase button, published price, auto-refill control, or postpaid balance.

## Accounting invariants

- Purchase grants remain immutable ledger entries keyed by Stripe Checkout Session ID.
- Refund and chargeback events append separate `capacity_adjustment` entries keyed by Stripe event ID.
- A server-only payment reference maps the Stripe Payment Intent to the original Workspace, billing period, and grant.
- A mutable grant-state projection tracks capacity already revoked; it is not the receipt or source of purchase history.
- The refund and chargeback mutation reads the purchase, payment mapping, grant state, and monthly aggregate in one Firestore transaction.
- Stripe event replay is idempotent. A later overlapping chargeback after a refund records the event but cannot revoke capacity twice.
- Sequential partial refunds use Stripe's cumulative refunded amount to derive the incremental amount for each immutable receipt entry.
- Any refund, including a partial refund, conservatively revokes all capacity that remains from the purchase. This policy is explicit in the Host receipt surface and still requires owner approval before checkout can open.
- Unmapped Stripe refunds are classified as `not_additional_usage` and do not write an Additional usage ledger entry.

## Server-owned data

- Purchase and adjustment history: `organizations/{orgId}/additional_usage_ledger/{transactionId}`
- Mutable revocation projection: `organizations/{orgId}/additional_usage_grant_state/{stripeCheckoutSessionId}`
- Monthly capacity aggregate: `organizations/{orgId}/usage_capacity/{YYYYMM}`
- Payment lookup: `additional_usage_payment_refs/{stripePaymentIntentId}`

All four paths remain default-denied to app clients. Owners and admins receive only the known receipt fields through `listMyAdditionalUsageTransactions`; Stripe secrets, raw event payloads, and unknown meter fields are not returned.

## Host Dashboard

Money > Billing & Usage now includes `Receipts & adjustments` for the selected usage period. It distinguishes purchases, refunds, and chargebacks; shows the capacity added or removed; shows the recorded amount and time; and states the conservative revocation rule. Owners and admins may refresh the history. An empty period renders a truthful empty state.

No checkout action is present. Receipt access depends on Workspace owner/admin membership rather than an active usage capability, allowing a canceled owner to retain access to commercial history.

## Verification

- Syntax checks and `git diff --check` passed.
- Focused Additional usage unit tests passed: 4 tests.
- Full unit suite passed: 316 files, 1,136 tests.
- Stripe webhook emulator passed, including disabled checkout refusal, one-time refund revocation, duplicate replay, overlapping chargeback handling, and unrelated-refund isolation.
- Usage-operation callable emulator passed, including sanitized owner receipt output.
- Complete Firestore and Storage rules suite passed with explicit server-only assertions for the ledger, grant state, aggregate, and payment mapping.
- Focused lint passed with zero errors; 18 pre-existing Host hook warnings remain.
- Production build passed and generated 135 prerendered routes and 132 social cards.

## Remaining Gate C3 decisions

1. Approve the first customer-facing unit and included allowance.
2. Approve pack capacity, price, duration/guest assumptions, margin floor, and maximum exposure.
3. Approve the conservative any-refund/full-remaining-capacity revocation policy or specify a proportional policy.
4. Approve expiration and unused-capacity behavior.
5. Add and approve a pre-event estimate.
6. Define capped auto-refill size, warning threshold, immediate off switch, and required monthly maximum.
7. Approve a safe production cohort and reconciliation review.

## Controlled production deployment

- Function revisions: `stripewebhook-00148-vid` and `listmyadditionalusagetransactions-00001-vin`, both Ready at 100% traffic.
- Hosting release: `1784731848817000`
- Hosting version: `58186aa686fa2c10`
- Live Host asset: `HostApp-CMn_LT5b.js`
- Live smoke returned HTTP 200 for the index, entry asset, and Host asset and found all four required receipt, refresh, conservative-revocation, and empty-state strings.
- Checkout remains disabled, auto-refill remains disabled, and the pack catalog remains empty.

## Rollback

- Keep the commercial feature flags and pack catalog disabled; this prevents any live grant from being created.
- Roll back the Host receipt panel and callable independently of the usage enforcement path.
- Roll back the refund/dispute webhook branch before enabling checkout if the adjustment policy changes.
- Existing purchase entries must never be edited or deleted during rollback; correction remains append-only.
