# Slice 10 Proof-Readiness Checkpoint Review

Date: 2026-07-22

Status: deployed proof foundation; BeauBucks purchase and balance authority remains planned and gated.

## Outcome

The Audience App now offers a compact, collapsed **Recent activity** disclosure directly beneath the current Room balance. It is intentionally closed by default and performs no activity-history read until the guest opens it. The visible list is capped at five rows and uses the app's existing Room, Points, BeauBucks, Room Boost, and VIP language.

Paid activity is derived only from a completed Stripe checkout whose payment status is `paid`, buyer matches the signed-in guest, and Room matches the Room the guest joined. The client receives the amount paid, fulfilled value, friendly label, time, and a deterministic non-sensitive BeauRocks confirmation code. Raw Stripe session IDs are not returned.

Rewards and spends are derived only from posted server-owned activity records. Current friendly labels cover VIP account rewards, Room welcome rewards, event access rewards, lobby rewards, promo rewards, reactions, profile updates, and avatar unlocks. Raw source IDs, collection names, account UIDs, and song/performance attribution are not returned.

## Mental-load decision

- No new control was added to the Host's primary operating flow.
- Detailed Room-wide BeauBucks reconciliation remains in Host **Advanced Diagnostics** and remains read-only.
- Audience history is one collapsed row, not a new navigation destination or persistent feed.
- The Audience App fetches only after an explicit open and refreshes only after an explicit tap.
- The disclosure says it is server-recorded activity and keeps the balance above as the current total.

## Cost and privacy boundary

`listMyRoomCreditActivity` requires Firebase authentication, App Check when the production mode enforces it, and an existing Room membership document for the caller. It returns only that caller's records. The default request performs one Room membership read plus two newest-first queries capped at 20 documents each; the client requests ten merged records and renders five. There is no subscription, polling loop, background refresh, or Host-wide fan-out.

Two production composite indexes bound the newest-first reads:

- `beaurocks_ledger_entries`: `accountId`, then `createdAt desc`
- `stripe_checkouts`: `buyerUid`, `roomCode`, then `fulfilledAt desc`

Both indexes reported `READY` before Hosting was released.

## Authority boundary

This checkpoint does not complete Slice 10.

- `room_users.points` remains the live Room balance authority.
- The BeauBucks shadow ledger remains non-authoritative.
- Legacy client-side balance mutations may not yet appear in recorded activity.
- Current paid Points/pack naming debt is not reclassified as an approved BeauBucks catalog by this work.
- Refund, chargeback, expiration, cross-Room scope, and canonical ledger-derived balance policy remain gated work.
- No checkout, pack price, grant value, spend rule, score, queue rule, or Host setting changed.

## Verification

- Focused UI/model tests: 13 passed before hardening; final focused rerun 10 passed.
- Complete unit suite: 320 files, 1,159 tests passed.
- Complete BeauBucks emulator gate passed: reconciliation, server-authoritative canary spend, and audience activity.
- Final audience activity emulator regression passed, including unauthenticated denial, non-member denial, other-user exclusion, other-Room exclusion, unpaid exclusion, raw-ID exclusion, and fractional-limit normalization.
- Full lint: zero errors. The new hook warning found during review was removed; targeted lint retained only two pre-existing SingerApp warnings.
- Production build: 363 modules, 135 prerendered routes, 132 social cards.
- Production smoke: site 200, Audience asset 200 with `Recent activity`, Firebase client asset 200 with `listMyRoomCreditActivity`, unauthenticated callable request 401.

## Production release

- Function: `listMyRoomCreditActivity`, revision `listmyroomcreditactivity-00002-bak`, 100% traffic.
- Hosting release: `1784748069933000`.
- Hosting version: `bca8962d9003e6ee`.
- Audience chunk: `SingerApp-Bgsy6B98.js`.
- Firebase client chunk: `firebase-GdRCUxrO.js`.

## Production review checklist

1. Join a Room as an Audience guest and open the Points/BeauBucks balance sheet.
2. Confirm **Recent activity** is collapsed and the balance remains the dominant answer.
3. Open it and confirm recent VIP, welcome, lobby, promo, reaction, profile, or avatar activity uses plain language.
4. For a known completed paid pack or Room Boost, confirm the amount paid and a `BR-` confirmation code appear.
5. Confirm unpaid/cancelled checkout attempts do not appear.
6. Confirm closing and reopening the balance sheet does not add Host controls or interrupt the karaoke flow.
7. Use Refresh only when verifying a newly posted reward or payment; there should be no automatic polling.
