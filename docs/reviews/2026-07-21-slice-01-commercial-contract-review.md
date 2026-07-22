# Slice 01 Review - Commercial Contract and Vocabulary

Date: 2026-07-21

Status: Accepted

Slice queue: `docs/reviews/2026-07-21-host-commercial-implementation-slices.md`

## Outcome

BeauRocks now has one versioned commercial contract used by both the client billing catalogs and Functions entitlement logic.

The migration preserves current plan IDs, amounts, capabilities, meter allowances, hard limits, and current rates. It does not activate new checkout, overage collection, broader Host access, or offline claims.

## Contract established

- Public Host offers: `host_monthly`, `host_annual`.
- Legacy compatibility plan: `vip_monthly`; it is not classified as a current Host offer.
- Subscription states: trialing, active, past due, cancels at period end, canceled, inactive, and audited support override.
- Money rails: Host plan, additional usage, Host Tip, BeauBucks purchase, and fundraiser Support.
- Offline financial behavior: BeauRocks checkout and fulfillment are prohibited offline; Host Tip and fundraiser destinations may be displayed but remain unverified.
- Vocabulary: Host Dashboard, Audience App, Public TV, Room Recap, Workspace, Song, Backing version, Charts, Points, BeauBucks, Host Tip, and Support.
- Existing per-request rates are explicitly marked `existing_unvalidated_do_not_publish` pending the cost-envelope slice.

## Changed contracts and files

- `functions/lib/hostCommercialContract.json`: authoritative machine-readable contract.
- `functions/lib/entitlementsUsage.js`: derives plans, entitled statuses, public meter definitions, allowances, hard limits, and current rates from the contract. Server-private pass-through assumptions remain server-only.
- `src/billing/hostCommercialContract.js`: typed-by-convention client adapter and lookup helpers.
- `src/billing/hostPlans.js`: derives Host plan and usage presentation from the contract.
- `src/billing/catalog.js`: derives subscription compatibility lookups from the contract.
- `tests/unit/hostCommercialContract.test.mjs`: parity, vocabulary, money-rail, offline-safety, and legacy/public-boundary tests.

## Verification

- Focused unit tests: 2 files passed, 7 tests passed.
- Focused ESLint: passed.
- Production Vite/SEO build: passed.
- No screenshot evidence is required because this checkpoint intentionally makes no UI layout or checkout-flow change.

## Vocabulary drift inventory

### Preserve as internal compatibility identifiers

Do not globally rename these. They can be migrated only with explicit storage/data compatibility work:

- Firebase/app identifiers such as `bross-app`.
- localStorage and IndexedDB keys beginning with `bross_`.
- existing asset filenames and logo-library paths containing `bross`.
- export filenames where changing the prefix has no customer-value priority.
- `vip_monthly` in historical subscription records and entitlement lookups.
- Firestore `organizations` paths; customer-facing language remains Workspace.

### Remediate as customer-facing brand copy

Route these into the next relevant UI/copy slice:

- `Welcome to BROSS Karaoke` default welcome messages.
- `BROSS Entertainment` default Public TV brand eyebrow.
- `alt="BROSS"` on Audience App default logos.
- `Logo defaults to BROSS when blank` in Host Dashboard.
- `BROSS Workspace` fallback display name.
- Host onboarding copy that says values create or update an `organization record`.

### Remediate as money-rail ambiguity

Route these to Slices 09 and 10; do not solve them with a cosmetic rename alone:

- `Tip the host to unlock bonus points and VIP perks` default copy.
- `BROSS standard: ... pts per $1 tip` Host copy.
- Stripe product names containing `BROSS Room Tip` or `BROSS Points`.
- Checkout type `tip_crate`, which is a BeauRocks-collected Room product rather than a Host Tip.
- `points_pack` and `POINTS_PACKS`, which represent purchased value and need BeauBucks product treatment.

## Known gaps and risks

1. The current Functions entitlement implementation treats `past_due` as entitled. The new contract records its new-Room policy as an owner decision rather than silently changing access.
2. Trialing is also entitled today. Whether it may create a first Room remains an owner decision.
3. The legacy subscription compatibility list is still available to existing code. Slice 02 must ensure public checkout only presents current Host offers while preserving historical account support.
4. Current meter rates and allowances remain production-compatible but are not approved public pricing. Slice 04 must validate their cost basis before Slice 06 packages usage.
5. Customer-facing vocabulary drift remains in large surface files. The inventory deliberately avoids colliding with unrelated work already present in the worktree.

## Recommended owner decisions

1. Require payment before the first self-service Room. Use audited support override for demos and controlled beta access instead of a general trial initially.
2. When a subscription becomes past due, let an already-live Room finish, block new Room creation, and provide a clear payment-recovery action. Do not immediately break the live night.
3. Keep Host Monthly and Host Annual as the only initial public Host plans.

## Owner decision

Approved on 2026-07-21:

1. Payment is required before the first self-service Room; demos and controlled access use audited support override.
2. A past-due Host may finish an already-live Room but cannot create another Room until payment recovers.
3. Host Monthly and Host Annual are the only initial public Host plans.

## Rollback

The migration can be reverted to the previous duplicated plan constants without changing stored plan IDs or billing records. The contract itself is additive and contains no credentials or customer data.

## Next slice after acceptance

Slice 02: make the paid Host plan the normal room-creation path, expose only current public Host offers, keep approved Host access as an audited exception, and test active, canceled, past-due, webhook-retry, and duplicate-checkout behavior.
