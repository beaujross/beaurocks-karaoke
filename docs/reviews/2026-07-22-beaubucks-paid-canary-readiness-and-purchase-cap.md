# BeauBucks Paid Canary Readiness and Purchase Cap

Date: 2026-07-22

## Outcome

This slice converts the remaining BeauBucks commercial authority work into a checked-in, read-only release preflight and closes the first paid canary's concurrent/unbounded checkout gap.

The production commercial state remains fail-closed: `internal_canary_checkout_disabled`, checkout false, and the starter pack non-public. No Room or Host is authorized by this slice.

## Readiness packet

`npm run ops:report:beaubucks-activation-readiness` now evaluates eight gates:

1. prelaunch safety;
2. decision-record integrity;
3. product policy;
4. starter pack and database-operation envelope;
5. customer promises;
6. commercial operations;
7. bounded cohort;
8. final activation approval.

The checked-in packet supplies recommended values but treats recommendations as different from approvals. The current expected result is `blocked_checkout_disabled`: the two repository-safety gates pass, while explicit owner and operating decisions remain blocked.

## Purchase limit

The registered canary policy permits one completed pack per buyer per Room. Checkout creation now reserves that account transactionally before creating the Stripe Session. A second concurrent request is rejected. The reservation and Stripe Session share a bounded 35-minute window; failed session creation releases the reservation. Fulfillment increments the purchase-limit projection in the same transaction as the balance and purchase ledger grant. Existing authoritative `lifetimePurchased` data also blocks a second pack if the limit projection has not yet been created.

The Audience wallet reads the limit only when a public pack is actually available. Normal and checkout-disabled Rooms therefore add no new wallet read. Once a purchase is complete or a checkout is active, `canPurchase` is false and the storefront withholds the button.

## Cost boundary

The readiness helper derives the maximum spend count from the registered pack and current reaction-cost file. At 1,200 BB and a lowest paid reaction cost of 2 BB, the pack permits at most 600 spends. Each accepted spend writes the operation, account projection, and immutable ledger entry, so the minimum server-authority envelope is 1,800 writes per fully spent pack. Existing Room reaction delivery is separate and must remain part of production observation.

## Verification

- Focused BeauBucks authority, activation, and Audience tests: 19 passed.
- Full unit suite: 322 files and 1,176 tests passed.
- Functions ESLint and repository-wide ESLint errors-only checks: zero errors.
- Full BeauBucks callable emulator: reconciliation, legacy spend, activity, authority purchase, refunds, chargebacks, and out-of-order recovery passed.
- The authority vertical now asserts the completed purchase-limit projection.

## Production deployment

The fail-closed purchase-limit hardening was deployed without hosting changes or commercial activation. Revisions serving 100% traffic:

- `getMyRoomBeauBucksWallet`: `getmyroombeaubuckswallet-00003-but`
- `createBeauBucksCheckout`: `createbeaubuckscheckout-00004-rus`
- `stripeWebhook`: `stripewebhook-00151-wef`

Post-deploy smoke confirmed both public callables reject unauthenticated requests with HTTP 401 and the wallet service has no `BEAUBUCKS_AUTHORITY_*` environment variable. The checked-in contract remains checkout-disabled and the pack remains non-public.

## Remaining activation boundary

The owner must approve product policy, pack economics and cost envelope, customer promises, named operations ownership, one exact Room cohort, and final activation. Public Terms and point-of-purchase copy must then implement the approved promises. Only a separate reviewed change may activate the contract, publish the pack, configure the Room allowlist, set the admin Room permission, and deploy production.
