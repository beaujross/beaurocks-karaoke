# BeauBucks Canonical Ledger Contract

Status: server-authoritative canary debits plus shadow-ledger writes and read-only reconciliation; all balance reads remain legacy-authoritative.

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
