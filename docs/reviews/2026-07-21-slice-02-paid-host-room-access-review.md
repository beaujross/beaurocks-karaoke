# Slice 02 Review - Paid Host Room Access

Date: 2026-07-21

Status: Accepted by owner on 2026-07-21

Slice queue: `docs/reviews/2026-07-21-host-commercial-implementation-slices.md`

## Outcome

Room creation now has a dedicated, server-authoritative `rooms.create` capability.

- An active Host Monthly or Host Annual subscription can create a Room.
- An unpaid, trialing, past-due, canceled, or inactive account cannot create a new Room.
- An approved Host override can create a Room and is logged with a distinct access source.
- A super-admin override remains available.
- An already-existing Room remains operable when the Host no longer has new-Room permission.
- Public checkout accepts and presents only Host Monthly and Host Annual.
- VIP remains available only as a historical compatibility definition.

No production deployment was performed.

## Access matrix

| Account state | Host Workspace and recovery | Create new Room | Continue existing Room |
| --- | --- | --- | --- |
| Active Host plan | Yes | Yes | Yes |
| Active plan, cancels at period end | Yes until period end | Yes until period end | Yes |
| Trialing | Yes where existing capabilities allow | No | Yes |
| Past due | Yes for billing, history, and recovery | No | Yes |
| Canceled or inactive | Limited account and billing access | No | Yes when still the recorded Room Host |
| Approved Host override | Yes | Yes | Yes |
| Super admin | Yes | Yes | Yes |

## Implementation

- Added `rooms.create` to the shared commercial contract and client capability registry.
- Added `canCreateRoomForSubscription` and subscription-state resolution to the shared entitlement module.
- Re-derived `rooms.create` while reading Workspace entitlements so stale stored capability data cannot bypass current subscription state.
- Added a dedicated `requireRoomCreationAccess` backend boundary used by `provisionHostRoom`.
- Added structured `room_creation_access_granted` logs with Host, Workspace, Room, access source, plan, and state.
- Restricted server checkout validation to contract-defined public Host plans.
- Split the client catalog into public subscriptions and legacy compatibility subscriptions.
- Updated Stripe product copy to BeauRocks, Host plan, Room, and Host Dashboard vocabulary.
- Added a specific payment-recovery message in Host Dashboard for past-due Room creation.
- Added deterministic Stripe Checkout Session idempotency keys. A retried request reuses the same Stripe operation; a deliberate new request receives a new key.

## Verification

### Unit

- 3 focused test files passed.
- 8 tests passed.
- Covers active, trialing, past due, canceled, inactive, cancel-at-period-end, public plans, legacy plans, money rails, and contract parity.

### Room provisioning emulator

- 10 checks passed.
- Proves unpaid denial, active paid access, trialing denial, past-due denial, canceled denial, approved-Host override, idempotent provisioning, discovery, branding, and event-credit setup.

### Existing-Room emulator

- 36 checks passed.
- Explicitly proves that an existing Room remains operable without current new-Room entitlement.

### Signed Stripe webhook emulator

- 4 checks passed.
- Proves idempotent active projection, past-due recovery state with Room creation disabled, canceled state, and existing signed checkout fulfillment.

### Static validation

- Focused ESLint passed.
- Production Vite and SEO build passed.
- Diff integrity check passed; only existing line-ending warnings were reported.

## Customer-facing behavior

- Past due: `Payment is past due. Update billing before creating another Room.`
- Other missing paid access: `Choose an active paid Host plan before creating a Room.`
- Stripe product: `BeauRocks Host Monthly` or `BeauRocks Host Annual`.
- Stripe description identifies a Host plan for Room creation and Host Dashboard access.

## Known gaps and follow-up

1. This slice does not deploy Functions or hosting.
2. It does not redesign Tonight Setup; that is Slice 03.
3. Host Workspace may remain accessible in trialing or past-due states so the customer can reach billing, history, and recovery. Only new-Room creation is blocked.
4. Approved Host access remains a rollout exception. The structured log distinguishes it from paid creation, but broader override-expiration and staff reporting can be added during commercial operations.
5. The existing large Functions file and Host hook contain unrelated worktree changes; this slice touched only the access, checkout, audit, and error paths described above.

## Rollback

- Revert `provisionHostRoom` to the generic Host Workspace gate.
- Remove state-derived `rooms.create` from entitlement resolution.
- Restore the combined client subscription catalog and generic paid-plan checkout validator.
- No stored plan IDs, Stripe price IDs, Room documents, or customer balances require migration.

## Recommended next action

Accept Slice 02 and begin Slice 03: simplify first-Room setup around private defaults, room name, join policy, Host-Led or Assisted Host or Crowd-Driven control, media readiness, Launch Room, Public TV, and the Audience App link.

## Owner decision

Accepted on 2026-07-21. Gate B1 is closed and Slice 03 is authorized to proceed.
