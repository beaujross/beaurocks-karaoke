# Billing + IAP Foundation (BROSS Karaoke)

## Goals
- Support Stripe on web/desktop.
- Support Apple In-App Purchases (IAP) on iOS for digital points/VIP/hosting.
- Keep a single product catalog with consistent IDs across providers.

## Product IDs (canonical)
Points (consumable):
- `points_1200`
- `points_3000`
- `points_7500`

Subscriptions:
- `vip_monthly`
- `host_monthly`

## Client flow (iOS)
1) App loads products from StoreKit using the canonical IDs.
2) User taps purchase in the Points/VIP UI.
3) StoreKit returns a transaction + receipt.
4) Client sends `receipt` + `productId` + `userUid` to backend.

## Server flow (Apple)
1) Verify receipt with App Store Server API:
   - Call `https://api.storekit.itunes.apple.com/inApps/v1/transactions/{transactionId}` (or legacy receipt endpoint).
   - Validate bundle ID, product ID, and environment.
2) Grant entitlement:
   - Points: increment `room_users/{roomCode_uid}` and/or `users/{uid}`.
   - VIP/Host: set `users/{uid}.vipLevel` or `hostTier` and set expiry from Apple subscription status.
3) Store a transaction record:
   - Save `apple_transactions/{transactionId}` to prevent double-grants.

## Server webhooks (Apple)
Use App Store Server Notifications v2 to keep entitlements in sync:
- `DID_RENEW`, `EXPIRED`, `DID_FAIL_TO_RENEW`
- Update `users/{uid}` VIP/host flags and expiry.

## Stripe flow (web/desktop)
1) Create checkout session (already implemented).
2) On webhook `checkout.session.completed`, grant points/badges.
3) Store `stripe_events/{eventId}` to prevent double-grants.

## Notes / Constraints
- iOS apps must use IAP for digital goods (points, VIP, hosting).
- Web can continue using Stripe.
- Tip crates on iOS should map to fixed IAP packs (no custom amounts).
