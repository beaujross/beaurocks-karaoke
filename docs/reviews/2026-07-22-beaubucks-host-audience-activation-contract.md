# BeauBucks Host and Audience Activation Contract

Date: 2026-07-22

Status: implementation verified; safe to deploy financially inert; no public purchase activation approved.

Account-wallet revision (2026-07-22): BeauBucks now follow the signed-in BeauRocks account across Rooms. Points retain their existing name and Room participation behavior. The Room still decides which BeauBucks actions are available tonight. Any older Room-scope statements below describe the superseded Slice 10.1 canary contract.

## Outcome

The BeauBucks authority vertical now has one plain-language Host decision and a matching Audience explanation without combining purchased value with earned Points.

- Host label: `BeauBucks tonight`.
- Off summary: `Off — guests use earned Points`.
- On behavior: guests with BeauBucks may use them for paid reactions in that Room.
- Audience balances: `Earned Points` and `BeauBucks` are shown separately.
- Paid reactions use BeauBucks only when the Room is both authorized and enabled by the Host.
- Profile changes and avatar unlocks remain earned-Points actions.

No normal Host or Audience copy exposes `authority`, `canary`, ledger terminology, or environment configuration.

## Fail-closed activation contract

Runtime availability requires every layer below:

1. The Room matches the server-owned BeauBucks Room or Host allowlist.
2. The Room has the admin-owned `beauBucksAuthorityEnabled` permission.
3. The existing Room experience is enabled.
4. The Host has turned on `beauBucksEnabledTonight`.
5. Purchases additionally require an active commercial contract, checkout enabled, and a public pack.

Ordinary Host settings saves preserve the admin-owned permission but cannot mint it through the public Event Credits payload. Turning the Host choice off immediately removes allowed BeauBucks spend kinds and new paid reactions fail on the server. Duplicate operations still replay their prior result safely.

The checked-in commercial contract remains `internal_canary_checkout_disabled`, checkout remains false, and the starter pack remains non-public. This slice therefore cannot create a production Stripe Checkout Session without a separate reviewed activation change.

## Host experience

The control appears only in an internally authorized Room and lives inside the existing `Room experience` / Event Credits surface. It is disabled until the Room experience itself is enabled. The Host sees one switch plus the practical result, not an additional preset or a second configuration system.

The copy explicitly states that:

- BeauBucks are purchased separately from Points;
- BeauBucks stay in the current Room;
- the currently eligible use is paid reactions;
- a purchase button only appears when BeauRocks has enabled checkout.

## Audience experience

In an authorized Room, the Points sheet becomes `Points + BeauBucks` and shows:

- the earned Points total in `PTS`;
- the separate room-scoped BeauBucks wallet in `BB`;
- a short explanation of what each balance means;
- a collapsed, on-demand activity list whose entries retain their own currency;
- the purchase pack only when the server returns `canPurchase: true`.

Legacy personal `POINTS_PACKS` are suppressed in an authorized BeauBucks Room so two different paid personal balances are not sold side by side. Existing Room support/boost offers remain separate support actions. Normal Rooms keep their current Points presentation.

## Cost boundary

- No new polling was added.
- The BeauBucks wallet is requested only when a joined guest opens the Points sheet in an internally authorized Room.
- The existing activity proof remains collapsed and loads only when opened.
- A paid reaction uses the existing bounded, idempotent BeauBucks transaction.
- Rooms outside the internal rollout do not incur the wallet read path.

## Verified behavior

- Focused Host/Audience source suite: 10 tests passed.
- Full unit suite before the final helper assertion: 321 files and 1,169 tests passed; the focused helper suite then passed with the added intent/permission-boundary test.
- Full repository ESLint errors-only pass: zero errors.
- BeauBucks callable emulator suite: all reconciliation, legacy spend, activity, purchase, reaction, refund, chargeback, and out-of-order recovery checks passed.
- Host room-update emulator: all 36 checks passed, including Host intent persistence and preservation of the admin-owned rollout permission.
- Production build: 363 modules, 135 prerendered routes, and 132 social cards.

## Production review checklist

For a Room that is not internally authorized:

- No `BeauBucks tonight` Host control appears.
- The Audience Points sheet behaves exactly as before.
- Paid reactions continue to use the existing Points path.

For an internally authorized test Room with BeauBucks off:

- The Host sees one `BeauBucks tonight` switch with the off summary.
- Audience copy says BeauBucks are off tonight.
- Allowed BeauBucks spend kinds are empty.
- A paid reaction cannot debit the BeauBucks wallet.

For an internally authorized test Room with BeauBucks on:

- Host save/reload preserves both the visible choice and hidden rollout permission.
- The Audience sheet shows separate PTS and BB totals.
- No generic personal Points pack is offered beside BeauBucks.
- With checkout still disabled, no BeauBucks purchase button appears.
- A preloaded BeauBucks balance can pay for a reaction once; the Points balance does not move.
- Insufficient BeauBucks opens the balance sheet and does not fall back to Points.
- Recent activity labels BeauBucks entries as BB and Points entries as PTS.
- Profile changes and avatar unlocks still use Points.

Public checkout activation remains a separate owner decision requiring approved pricing, terms, refund/expiration/support copy, bounded cohort configuration, and production environment allowlists.

## Production release

Deployed 2026-07-22 to `beaurocks-karaoke-v2`.

Production revisions, each serving 100% traffic:

- `updateRoomAsHost`: `updateroomashost-00133-jah`
- `getMyRoomBeauBucksWallet`: `getmyroombeaubuckswallet-00002-dos`
- `spendAudienceBeauBucks`: `spendaudiencebeaubucks-00002-duy`
- `createBeauBucksCheckout`: `createbeaubuckscheckout-00003-vez`

Hosting live-channel version: `5e31d5d1e9a3493b`.

Post-release smoke confirmed:

- all four callables reject unauthenticated requests with HTTP 401;
- the deployed wallet service has no `BEAUBUCKS_AUTHORITY_*` environment variables;
- the production index and exact Host, Audience, and Event Credits bundles return HTTP 200;
- the production index references the released entry bundle;
- checkout remains disabled and the starter pack remains non-public in the checked-in commercial contract.
