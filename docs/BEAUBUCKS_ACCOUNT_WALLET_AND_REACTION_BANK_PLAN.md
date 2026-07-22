# BeauBucks Account Wallet and Reaction Bank Plan

Date: 2026-07-22

Status: account-wallet foundation implemented fail-closed; paid catalog and checkout are not active.

## Product vocabulary

There are two balances, and neither is being renamed:

| Product name | Role | Scope | How it enters the system |
| --- | --- | --- | --- |
| Points | Earned participation balance | Current Room | Joining and participating under the Room's existing rules |
| BeauBucks | Paid BeauRocks balance | Signed-in BeauRocks account across Rooms | Verified BeauRocks purchase or explicit server-controlled grant |

`Event Credits` remains the existing internal Host configuration surface. It is not a third customer currency. UI copy should say Points or BeauBucks whenever it names a balance.

## Responsibility boundary

The account owns its BeauBucks balance and durable unlocks. The Room owns tonight's availability.

- A guest keeps purchased BeauBucks and reaction unlocks when joining another Room.
- A Host can allow or disable eligible BeauBucks actions for the Room without removing anything the guest owns.
- Anonymous guests may use Points under existing Room rules, but must sign in before buying or spending BeauBucks.
- Neither currency buys a score, winner, queue position, moderation exemption, or identity privilege.
- Room attribution remains on every purchase and spend entry for support, analytics, refunds, and Host reporting.

## What the account-wallet change affects

| Existing foundation | Account-wallet revision |
| --- | --- |
| BeauBucks account ID included Room code | One canonical `account__uid__beaubucks` projection |
| Checkout cap was per buyer per Room | Canary cap is per BeauRocks account |
| Purchase metadata described a Room reward | Verified grant requires account reward scope and keeps Room as attribution |
| Activity view was Room-only | Shows account-wide BeauBucks activity beside current-Room Points activity |
| Anonymous Room members could reach the rail | BeauBucks purchase and spend require a non-anonymous account |
| Refunds trusted the stored wallet ID | Refunds and chargebacks recompute the canonical account wallet from the verified buyer UID |

A read-only production inventory on 2026-07-22 found zero BeauBucks account documents and zero BB. No customer balance transfer is required. The activation gate still records this inventory so a future environment cannot skip migration evidence.

## Recommended first BeauBucks product: reaction bank

The public product should not lead with a meter that charges BeauBucks on every tap. BeauBucks should first buy something durable that the guest can recognize and carry between parties.

### Base experience

- Keep four useful reactions available without a paid unlock.
- Keep reaction meaning social and visual; reactions never modify performer score.
- Apply a short server-enforced cooldown or burst limit to control write volume and animation spam.

### Account reaction catalog

- Each catalog item has a stable reaction ID, display label, emoji or asset reference, category, availability state, and unlock price.
- An entitlement is an immutable account-level record created by one idempotent BeauBucks spend.
- Retired reactions remain owned but can be removed from new purchase listings.
- Catalog changes are server-owned; the client cannot supply price or entitlement identity.

### Reaction bank and loadout

- The account owns a reaction bank containing the base reactions and purchased unlocks.
- The Audience App exposes four equipped reaction slots during a performance.
- The guest can swap owned reactions into those slots between performances or from an account customization surface.
- Extra loadout slots may be a later durable BeauBucks unlock, but the initial four-slot interaction should stay simple.
- The Public TV receives only the reaction event and approved asset identity; it never needs wallet data.

### Host control

Keep one primary Host decision: `BeauBucks tonight`.

- Off: base/Points behavior continues; account ownership is unaffected.
- On: the Room accepts the allowed premium reaction categories and other approved BeauBucks actions.
- Advanced policy, if needed later, should be exception-based (for example, disable animated reactions) rather than a preset matrix.
- Autopilot, Assisted Host, and Crowd-Driven modes must not silently change ownership or prices.

### Spend policy

Recommended launch rule: BeauBucks pays once to unlock a reaction. Sending an owned reaction is then free subject to cooldown, or uses Points if a meaningful Room-level sink is needed. The existing per-tap BeauBucks reaction debit remains a closed technical scaffold until the entitlement path replaces it; it is not approved public purchase behavior.

Other suitable future BeauBucks uses include themed reaction packs, durable profile cosmetics, Public TV celebration styles, and clearly described Room Boosts. Every use needs a visible outcome, an idempotent server fulfillment path, and a cost envelope. Pay-to-win and paid queue movement remain excluded.

## Provider-neutral purchase authority

Stripe, Apple, and Google should be payment providers, not separate wallets.

1. The client starts a purchase for a server-owned pack or product ID.
2. The server verifies Stripe evidence, an App Store transaction, or a Google Play purchase token with the provider.
3. A provider transaction reference becomes the idempotency key.
4. One provider-neutral grant command credits the same account wallet or creates the same durable entitlement.
5. Refunds and revocations post compensating ledger entries and, for durable items, apply the approved entitlement-revocation policy.
6. Provider, store, country, tax, fee, Room attribution, and support references stay in restricted evidence records.

The mobile clients must never credit BeauBucks from a local success callback alone. Store receipt verification, replay protection, restored purchases, family/account changes, refunds, and revocations are release gates for iOS or Android sales.

## Revised implementation slices

### Slice 10.3 - Account wallet compatibility and cutover

Status: implementation complete, verification and fail-closed deployment pending.

- Use one case-preserving BeauRocks UID wallet across Rooms.
- Require signed-in accounts for BeauBucks purchase and spend.
- Read the current Room's legacy wallet ID only for compatibility evidence.
- Inventory production before cutover; migrate only through an idempotent, reviewed operation if value exists.
- Keep Points behavior unchanged and checkout disabled.

Acceptance: zero unhandled legacy value, no cross-account collision, duplicate purchase/spend safety, and account balance visible from two Rooms without leaking another user's activity.

### Slice 10.4 - Provider-neutral grant adapter

Status: planned.

- Extract verified purchase fulfillment from Stripe-specific orchestration.
- Define one grant request containing provider, transaction reference, account UID, product ID, amount/currency evidence, and Room attribution.
- Add test-provider fixtures, replay tests, refund/revocation tests, and provider reconciliation output.
- Keep Stripe as the only enabled provider; add StoreKit and Google Play adapters only with server verification.

Acceptance: provider replay grants once, mismatched evidence grants nothing, and all providers converge on the same wallet/ledger contract.

### Slice 11.1 - Reaction catalog and account entitlements

Status: planned.

- Define the base four reactions and a small first premium catalog using existing reaction labels/assets where possible.
- Add server-owned prices and immutable account entitlement operations.
- Make purchase, refund, retirement, and restore behavior explicit.
- Calculate the write and delivery envelope for unlocks and repeated free/cooldown reactions.

Acceptance: an account unlocks once, replay does not double-charge, and the unlock appears in another Room.

### Slice 11.2 - Audience reaction bank and loadout

Status: planned.

- Add a simple reaction-bank customization view to the Audience App.
- Keep four in-performance slots and make locked, owned, equipped, and Room-unavailable states visually distinct.
- Show a compact BeauBucks receipt in the Audience App and retain detailed provider/account evidence in restricted support tooling.

Acceptance: a new guest understands the four reactions without setup; an account holder can equip an owned reaction without Host help; a failed or pending purchase never appears owned.

### Slice 11.3 - Host policy, Public TV delivery, and cost controls

Status: planned.

- Preserve the single `BeauBucks tonight` switch and add only necessary exception controls.
- Deliver only allowlisted reaction IDs/assets to Public TV.
- Enforce rate, burst, Room, account, and platform-wide ceilings before writes or fan-out.
- Degrade by suppressing excess animation while preserving karaoke playback, queue, voting, and Host control.

Acceptance: the Host can explain the switch in one sentence, costs remain bounded under a crowded Room load test, and turning BeauBucks off stops new premium events without changing account ownership.

### Slice 10.5 - Paid canary and production review

Status: blocked by Slices 10.4 and 11.1-11.3 plus commercial approvals.

- Approve pack economics, customer terms, support/refund ownership, tax/accounting treatment, and the controlled cohort.
- Activate one Room and named testers under sales, duration, and support ceilings.
- Verify one real purchase, durable unlock, cross-Room ownership, activity proof, duplicate delivery, refund behavior, Host disablement, and rollback.

Acceptance: strict readiness passes, the owner completes the production checklist, money and entitlements reconcile, and checkout can be disabled without harming the karaoke night.

## Cost and risk controls

- Checkout and catalog availability remain server-owned and fail closed.
- Every grant, spend, and entitlement operation has a stable idempotency key.
- Rate limits apply before Firestore writes and Public TV fan-out.
- The Host's Room usage ceiling and the platform emergency ceiling can disable fresh premium effects while leaving owned value intact.
- Account balances never go negative; refunds preserve shortfall evidence instead of rewriting history.
- A cached account snapshot may improve UI responsiveness, but the server ledger remains the purchase/spend authority.
- Offline/LAN Rooms may use already-synced reaction ownership and queue local visual events, but cannot sell, grant, or spend paid value without later server verification and conflict-safe reconciliation. The initial offline milestone should disable new BeauBucks economic operations.

## Deliberate non-goals for this sequence

- Renaming Points or BeauBucks.
- Converting Points into BeauBucks or allowing cash-out/transfers.
- Charging BeauBucks for score, votes, winner selection, or queue position.
- Exposing payment-provider detail in the normal Host workload.
- Making paid operations a dependency for playback, queue management, voting, or Room shutdown.
