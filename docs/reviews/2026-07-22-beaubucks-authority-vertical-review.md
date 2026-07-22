# BeauBucks Authority Vertical Review

Date: 2026-07-22

Status: backend vertical verified and deployed financially inert; not approved for public checkout.

## Outcome

BeauBucks now has an isolated room-scoped server authority path that does not reuse the earned Points balance. The implemented test vertical is:

`registered paid checkout -> verified Stripe webhook -> authoritative purchase grant -> Room wallet -> paid reaction -> refund -> chargeback restriction`

Every monetary mutation is append-only evidence plus a transactionally updated account projection. Duplicate payment webhooks, spend requests, refunds, and chargebacks cannot apply twice.

## Fixed canary policy

- Currency: BeauBucks, separate from Points.
- Scope: one Room and one guest account; no cross-Room portability.
- Internal test pack: 1,200 BeauBucks for USD 5.00.
- Allowed spend: reactions only, using existing server-owned reaction costs.
- Competitive boundary: no scoring, winner, or queue-priority purchase.
- Expiration: none during canary; owner approval required before general release.
- Refund: revoke proportionate unspent value and record any unrecovered shortfall.
- Chargeback: revoke available value, record shortfall, and restrict future spend.

## Financial safety gates

Public purchase requires all three gates, none of which this slice turns on:

1. The commercial contract must be `active` with checkout enabled.
2. The selected pack must be a public offer.
3. The Room must have both a server allowlist match and `beauBucksAuthorityEnabled: true`.

The checked-in contract is `internal_canary_checkout_disabled`, checkout is false, and the pack is not public. The deployed callable therefore fails before a Stripe Checkout Session can be created. A verified paid checkout that was registered before a future rollback is deliberately still fulfilled; disabling sales must not strand a customer's paid value.

## Cost and data boundary

- Wallet reads are one Room read, one Room-membership read, and one ledger-account read.
- An accepted reaction uses one Firestore transaction over the Room, membership, operation, account, and ledger entry.
- Purchase fulfillment and payment reversal are bounded single-account transactions; neither fans out to Room guests.
- The existing collapsed Audience Recent activity read adds one account-document read only when the guest opens it. It does not poll.
- Global authority collections remain server-only under the Firestore rules' default deny.

## Verified vertical

The Firestore emulator proves:

- exact registered value and signed-session value are required;
- one purchase grants 1,200 BeauBucks once;
- legacy Room Points and global Points remain unchanged;
- a 5-BeauBucks reaction debits once and replays safely;
- the private activity projection shows USD 5.00 purchase proof without raw Stripe IDs;
- a 50% refund revokes 600 unspent BeauBucks once;
- a later chargeback revokes the remaining available 595, records a 5-BeauBucks shortfall, and restricts the account;
- restricted accounts cannot spend;
- the old Stripe webhook suite remains compatible.

## Deliberate exclusions and next gate

- No Audience purchase button or automatic routing to `spendAudienceBeauBucks`.
- No primary Host control.
- No public pack copy or price claim.
- No migration of historical Points purchases.
- No expiration job, transferable wallet, cash-out, Host settlement, or pay-to-win action.
- No production canary activation.

Before public checkout, prove recovery for a refund/chargeback arriving before its purchase fulfillment record, approve customer-facing pack/refund/expiration/support terms, and add explicit Host and Audience controls with the same low-mental-load disclosure pattern.

## Verification and production release

- Focused authority/activity unit suite: 15 tests passed.
- Complete unit suite: 321 files and 1,166 tests passed.
- Complete BeauBucks emulator suite passed, including the new purchase-to-chargeback vertical.
- Shared Givebutter/Stripe webhook emulator suite passed unchanged.
- Full lint: zero errors; existing unrelated React warnings remain.
- Production build: 363 modules, 135 prerendered routes, and 132 social cards.
- Targeted Functions deployment: five functions deployed, zero errors; no Hosting release.
- Production smoke: all four callables reject unauthenticated requests with 401; the Stripe webhook rejects a request without a valid signature with 400.

Production revisions, each serving 100% traffic:

- `createBeauBucksCheckout`: `createbeaubuckscheckout-00001-lad`
- `getMyRoomBeauBucksWallet`: `getmyroombeaubuckswallet-00001-jir`
- `spendAudienceBeauBucks`: `spendaudiencebeaubucks-00001-vur`
- `stripeWebhook`: `stripewebhook-00149-teq`
- `listMyRoomCreditActivity`: `listmyroomcreditactivity-00003-heq`
