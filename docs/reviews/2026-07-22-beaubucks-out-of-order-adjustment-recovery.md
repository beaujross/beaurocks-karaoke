# BeauBucks Out-of-Order Adjustment Recovery

Date: 2026-07-22

Status: implemented and deployed; production checkout remains disabled.

## Outcome

A signed Stripe refund or chargeback can now arrive before its related BeauBucks purchase completion without becoming a lost reversal. The webhook stores bounded pending evidence keyed by a hash of the PaymentIntent. When the registered paid checkout arrives, its first fulfillment transaction grants the purchased value and immediately posts the compensating authoritative debit before exposing the resulting wallet balance.

## Ordering and race contract

- Adjustment first: store the cumulative refund or chargeback marker, then recover it during first purchase fulfillment.
- Purchase first: use the existing payment reference and apply the adjustment directly.
- Concurrent delivery: pending capture rechecks the payment reference transactionally. Whichever transaction loses the race retries against the committed state, so either fulfillment consumes pending evidence or the adjustment applies directly.
- Duplicate adjustment: the hashed event record already exists, so event count and value do not increase.
- Duplicate purchase: the immutable purchase grant already exists, so neither grant nor recovered reversal repeats.
- Multiple early refunds: retain the greatest cumulative refunded amount rather than summing cumulative Stripe snapshots.
- Early refund plus chargeback: chargeback is sticky and targets the full purchase.

## Cost, privacy, and retention

- Known Additional usage reversals do not enter this inbox.
- An unmatched signed reversal costs at most one immutable event-document create plus one small aggregate write.
- Aggregate event hashes are capped at 20 while the total event count remains available.
- Pending documents contain no guest profile or Room state. The PaymentIntent lookup key is hashed; raw provider references remain server-only evidence.
- Both dedicated collection groups carry a 90-day `expiresAt` timestamp for Firestore TTL. No query, poller, scheduled scan, or Room-wide fan-out is required.
- Recovered financial entries remain durable; only the temporary classification evidence expires.

## Verified cases

- Partial refund before purchase: the USD 5.00 / 1,200 BeauBucks test purchase settles at 600 BeauBucks with one `refund_reversal`.
- Chargeback before purchase: the same purchase settles at zero, posts one `chargeback_reversal`, and restricts the account.
- Replay of either early event does not increment the pending event count.
- Replay of purchase fulfillment does not regrant or rereverse value.
- Room Points and global Points remain unchanged in both paths.
- Existing Additional usage, subscription, Room Boost, and Givebutter webhook tests remain green.

## Remaining activation gates

- Owner approval of pack economics, refund wording, expiration wording, scope/portability, support, and tax/accounting treatment.
- A simplified Host control for whether BeauBucks purchases and eligible interactions are available tonight.
- An Audience storefront and spend route that clearly separates purchased BeauBucks from earned Points.
- A deliberately named, observable production canary before any general release.

## Verification and production release

- Complete unit suite: 321 files and 1,167 tests passed.
- BeauBucks emulator suite passed, including refund-first and chargeback-first settlement.
- Shared Givebutter/Stripe webhook emulator suite passed unchanged.
- Firestore rules suite passed with explicit client read/write denial for all authority and pending collections.
- Full lint: zero errors; existing unrelated React warnings remain.
- Production build: 363 modules, 135 prerendered routes, and 132 social cards.
- Targeted Functions deployment: two updates and zero errors; no Hosting release.
- `createBeauBucksCheckout`: `createbeaubuckscheckout-00002-vox`, 100% traffic.
- `stripeWebhook`: `stripewebhook-00150-qok`, 100% traffic.
- Production smoke: disabled checkout rejects unauthenticated traffic with 401; Stripe rejects unsigned webhook traffic with 400.
- Firestore TTL is `ACTIVE` for `expiresAt` on both `beaurocks_pending_payment_adjustments` and `beaurocks_pending_payment_adjustment_events`.
