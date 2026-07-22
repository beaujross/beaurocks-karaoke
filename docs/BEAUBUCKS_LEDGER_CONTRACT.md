# BeauBucks Canonical Ledger Contract

Status: legacy Points remain legacy-authoritative; an isolated room-scoped BeauBucks purchase/reaction authority rail is implemented behind closed production gates, with public checkout disabled.

## Objective

Make BeauBucks issuance, purchase, grant, spend, refund, expiration, and donation attribution auditable without changing game mechanics. Participation Points and BeauBucks use the same entry envelope but remain different currencies and policies.

## Current-State Inventory

| Existing path | Current authority/idempotency | Ledger target |
| --- | --- | --- |
| Room join/welcome grant | Firestore transaction plus join/grant marker docs | `join_grant` credit |
| Ticket entitlement | entitlement and grant marker docs | `ticket_value` credit |
| Timed lobby refill | room-user timestamp/cap transaction | `timed_refill` credit with interval-derived key |
| Promo redemption | redemption/campaign transaction | `promo_grant` credit |
| Stripe points pack | Checkout Session and webhook event | `purchase_grant` credit |
| Stripe tip crate | Checkout Session and webhook event | `donation_reward` credit, buyer or room scope |
| Givebutter support | provider external transaction event | `donation_reward` credit with fund attribution |
| Reactions/profile/avatar | server callable in canaries; legacy client path elsewhere | typed debit with operation ID; legacy room balance remains read authority |
| Performer scoring | reaction aggregation into performance/song fields | attribution metadata, not a financial payout |

## Entry Invariants

- Amount is a positive integer; direction determines credit or debit.
- Every entry has one stable `idempotencyKey` derived from the authoritative source event.
- An account is scoped by room, user, and currency.
- Points and BeauBucks never reconcile into the same balance.
- Financial metadata requires the external provider transaction ID.
- Canonical song attribution is primary; backing rendition is optional supporting metadata.
- Refunds and corrections are new compensating entries, never destructive edits.
- Only `posted` entries affect the reconciled balance.

## Firestore Target Shape

- `beaurocks_ledger_entries/{ledgerEntryId}`: immutable entry envelope.
- `beaurocks_ledger_accounts/{roomCode__uid__currency}`: cached posted balance, last entry, reconciliation status.
- `beaurocks_ledger_idempotency/{hash}`: optional reservation when the entry ID cannot itself be the provider key.
- Provider source documents remain evidence and reference the resulting ledger entry.

## Migration Sequence

1. Contract and validator tests only.
2. Server-only shadow writes for already-idempotent grants and payment webhooks.
3. Reconciliation reports compare shadow ledger totals to existing `room_users.points` and `users.pointsBalance`; no reads switch.
4. Introduce a server-authoritative spend callable with client operation IDs; retain current UI and costs.
5. Dual-write spends and verify convergence under retries/offline recovery.
6. Backfill an explicit migration opening balance for accounts whose full history predates shadow writes.
7. Switch balance reads only after event-level and account-level reconciliation meet the agreed threshold.
8. Add compensating refund/expiration flows; never rewrite historical entries.

## Read-Only Reconciliation Contract (Implemented 2026-07-13)

- `reconcileBeauBucksShadowLedger` reads one explicit room and never writes Firestore.
- Access requires room-host authorization plus an allowlisted canary room or host; super admins may inspect an explicit room.
- Queries are capped at 250 documents per evidence collection. A capped report is marked `truncated` and cannot serve as migration evidence.
- The room-local `room_users.points` value is the reconciliation authority. `users.pointsBalance` is optional super-admin context because it is global and is not interchangeable with a room balance.
- Mismatches are classified as `opening_balance_gap`, `missing_shadow_event`, `duplicate_idempotency_conflict`, `currency_mismatch`, or `unsupported_legacy_spend`.
- Canonical song/performance attribution and backing-track metadata are returned in separate report fields.
- The Host Advanced Diagnostics surface runs the report only on demand. It does not poll and makes no audience-facing accounting claim.
- Production acceptance in canary room `A6M6` verified the operator surface, legacy-authority label, and shadow-not-live-money disclosure after the targeted Function and Hosting releases.
- Disabling the callable or removing the canary allowlist has no effect on grants, purchases, spends, refunds, game costs, or balance presentation.

Known evidence boundary: the current shadow ledger covers selected join/event grants, ticket value, timed refills, promo grants, and canary reaction/profile/avatar debits. Other legacy mutations remain expected reconciliation gaps until they receive their own server/idempotency boundary.

Audience proof-readiness now has a separate, user-scoped read boundary. `listMyRoomCreditActivity` requires authentication, App Check when enforcement is enabled, and an existing Room membership document. It returns only that guest's current Room balance, sanitized posted activity, and completed paid Stripe checkout records for the same Room. Raw provider/session IDs, source collection IDs, account UIDs, and attribution internals are never returned. Paid records receive a deterministic non-sensitive BeauRocks confirmation code. The Audience App loads this data only when the guest opens the collapsed Recent activity disclosure and shows at most five rows before an explicit refresh.

This view is proof of server-recorded activity, not a declaration that the shadow ledger is authoritative or complete. The Room balance remains the live total, legacy client-side mutations may not yet have a ledger entry, and the Host's full read-only reconciliation stays in Advanced Diagnostics rather than the primary operating flow.

## Isolated BeauBucks Authority Rail (Implemented 2026-07-22; checkout disabled)

- This rail starts a separate `beaubucks` account at zero. It does not migrate, relabel, reconcile, or debit `room_users.points` or `users.pointsBalance`.
- The canary scope is one Room plus one guest account. Rollout requires both a server environment allowlist and `eventCredits.beauBucksAuthorityEnabled === true` on the Room.
- The internal test pack is `Starter 1,200 BeauBucks` for USD 5.00. It remains `publicOffer: false`; the commercial contract also keeps checkout disabled and non-active, so `createBeauBucksCheckout` fails closed before contacting Stripe.
- A future enabled checkout must use the server-owned pack definition, an authenticated Room member, and the same dual Room gate. The browser never supplies price or grant value.
- `checkout.session.completed` grants only after Stripe signature verification, paid status, and exact agreement among the registered checkout, signed Session metadata, amount, currency, pack, Room, and buyer.
- Purchase fulfillment uses one transaction to create an immutable authoritative `purchase_grant`, increment the cached account projection, store a hashed payment reference, and mark the registered checkout fulfilled. A replay cannot grant twice.
- `spendAudienceBeauBucks` currently allows only server-priced reactions. It creates one stable spend operation, one authoritative `reaction_spend` debit, and one exact account projection update in a transaction. It cannot change queue priority, scoring, winners, identity, avatars, or legacy Points.
- Refunds create immutable `refund_reversal` debits for proportionate unspent value. Chargebacks create `chargeback_reversal` debits, restrict the account, and preserve unrecovered shortfall evidence rather than allowing a negative balance.
- The private Audience activity projection can render an authoritative purchase with USD amount and a hashed BeauRocks confirmation code. It also returns the separate ledger balance, but no Audience storefront or new Host control is routed to this rail yet.
- BeauBucks do not expire during this canary. General-release expiration, portability, support, tax/accounting, and refund language require owner review.

Activation remains a no-go until the out-of-order adjustment/recovery procedure is proven, the pack/refund terms are approved, Host enablement is designed, and the Audience purchase/spend surface is explicitly routed away from legacy Points.

## Server-Authoritative Canary Spend Contract (Implemented 2026-07-13)

- `spendAudienceRoomCredits` accepts `roomCode`, `kind`, `clientOperationId`, and a kind-specific payload from an authenticated room member.
- Canary eligibility is server-owned through room/host allowlists. `joinRoomAudience` gives the client a routing hint, but the callable repeats the gate before every mutation.
- Non-canary or rolled-back rooms receive `legacy_fallback` with no spend-operation, balance, profile, avatar, or ledger write.
- The operation document ID hashes room, user, and client operation ID. A repeated operation returns the stored accepted or insufficient result, increments replay telemetry, and never mutates economic fields, balances, identity/avatar state, or the ledger again.
- Ambiguous client failures retain the operation ID in session. Only accepted, insufficient-balance, or explicit legacy-fallback outcomes clear it.
- Costs are never trusted from the client: reactions use `reactionPointCosts.json`, profile changes use the persisted `nameEmojiChangeCount`, and avatar unlocks use `AUDIENCE_AVATAR_CATALOG`.
- Accepted paid operations update `room_users.points`, create `beaurocks_spend_operations/{operationId}`, and create one typed shadow debit in a single Firestore transaction.
- Paid profile identity projection and paid avatar ownership are part of that same transaction. Reaction event animation and performance attribution retain the existing buffered pipeline after acceptance.
- Insufficient operations record a stable outcome but do not change balances, identity, avatar ownership, or the ledger.
- The room-local balance remains the live read authority; the ledger stays shadow/non-authoritative and global `users.pointsBalance` is not decremented by room-local spends.

Rollback: remove the room/host from `BEAUBUCKS_SPEND_ROOM_CODES` / `BEAUBUCKS_SPEND_HOST_UIDS` and redeploy the callable. Existing clients receive explicit legacy fallback; historical operation and ledger evidence is retained.

Production acceptance in canary room `A6M6` verified server-canary routing, an accepted 2-credit reaction, duplicate replay without a second debit, exact room-balance delta, unchanged global balance, stored accepted operation evidence, and the matching typed `reaction_spend` shadow debit after the targeted Function and Hosting releases.

## Spend-Boundary Readiness Contract (Implemented 2026-07-13)

- The read-only reconciliation report joins each accepted spend operation to exactly one posted debit through `audience_spend:{operationId}` and validates kind, amount, user, currency, direction, status, and before/after balance transition.
- The report exposes accepted, insufficient, and unrecognized outcomes; distinct accepted accounts; accepted coverage by spend kind; safe replay totals; missing, invalid, unexpected, and orphan ledger entries; and machine-readable blockers.
- A canary spend boundary is ready only with at least 12 accepted operations from at least 3 distinct guests, accepted coverage for `reaction`, `profile_change`, and `avatar_unlock`, at least 1 observed replay, zero operation-ledger gaps, and no truncated evidence.
- Passing this spend-boundary gate does not change the balance-read authority. Balance-read migration additionally requires every reported account to reconcile exactly and explicit compensating opening entries for pre-shadow history; destructive historical backfill is prohibited.
- The Host Advanced Diagnostics panel presents boundary readiness separately from account reconciliation and keeps all accounting evidence out of audience-facing surfaces.
- Production closeout recorded 2 accepted reaction operations from 1 dedicated QA guest, 1 persisted duplicate replay, 0 operation-ledger gaps, an exact controlled 2-credit room-balance delta, and no global-balance change. The report correctly remains `collecting evidence` for sample, account, and paid-kind coverage while balance authority remains `legacy`.
- The isolated production Host smoke confirmed the Advanced Diagnostics report renders on demand with legacy-authority and shadow-not-live-money disclosures.

## Go/No-Go Gates

- Duplicate webhook and callable retries create one entry.
- Ledger balance and legacy balance reconcile for every canary account.
- No cross-room or cross-currency account collision.
- Negative balances follow an explicit room policy rather than client timing.
- Canonical performance support remains stable when backing tracks change.
- Rollback disables shadow writes without affecting legacy balance behavior.
