# VIP Account Upgrade Runbook

Last updated: 2026-04-13

## Purpose

Use this runbook to validate the BeauRocks VIP account upgrade flow before the May 1, 2026 AAHF Karaoke Kickoff. The current production path is an email-link upgrade flow, not SMS phone verification.

## Email-link upgrade flow

1. Audience guest joins anonymously.
2. Guest enters an email address from the VIP prompt.
3. App sends a BeauRocks email sign-in link with App Check enforced.
4. Guest opens the link on the same device whenever possible so the stored room and anonymous-user context can be restored cleanly.
5. App links the verified email credential onto the anonymous account when possible, or signs into the existing account and merges anonymous progress into it.
6. App grants VIP status, projects `vipLevel` into the room user, and grants the +5000 point upgrade reward.

## Prerequisites

- Firebase Auth `Email link` sign-in enabled.
- Firebase App Check enabled for the web app.
- `VITE_RECAPTCHA_V3_SITE_KEY` configured in `.env.local` for App Check tokening in the client.
- Domain allowlist includes your production and preview hostnames plus the continue URL host used in the email link.

## Local setup

1. Set `.env.local`:
   - `VITE_RECAPTCHA_V3_SITE_KEY=...`
2. Run app:
   - `npm run dev`
3. Use a real inbox that can receive sign-in links.
4. Keep browser storage intact between sending the link and opening it so the same-device recovery path stays available.

## QA test matrix

1. New guest, same-device happy path:
   - Join room anonymously.
   - Trigger VIP upgrade with a fresh email address.
   - Open the email link on the same device.
   - Confirm VIP unlock, +5000 points, and the room session stays intact.
2. Existing account recovery path:
   - Start as an anonymous guest.
   - Upgrade with an email already tied to a BeauRocks account.
   - Confirm the app signs into the existing account, merges anonymous account data, and keeps the guest in the room.
3. Expired or already-used link handling:
   - Open an expired or already-used link.
   - Confirm the user sees clear retry guidance for an expired or already-used link.
   - Confirm the email-link query params are stripped from the URL after handling.
4. Cross-device guidance:
   - Send the link, then open it on a different device or in a storage-cleared browser.
   - Confirm the UI asks for the email again and explains the same-device preference.
5. Data verification:
   - Confirm `/users/{uid}` reflects the verified account and `vipLevel`.
   - Confirm the room-user projection reflects `vipLevel` and the upgraded points total.

## Known reliability guardrails in code

- Email-link sends require App Check before the callable executes.
- Email-link payload is stored locally so the app can recover room context on the same device.
- Invalid-email, rate-limit, network, App Check, expired-action-code, and invalid-action-code failures map to user-facing guidance.
- Existing-account recovery merges anonymous session data instead of dropping the user into a clean account with lost room state.
- Email-link query params are removed from the URL after success or terminal invalid-link handling.

## Production checks before enabling enforcement

1. Run host smoke test with write checks enabled:
   - Confirm `/users/{uid}` write succeeds and room user updates project correctly.
2. Validate App Check dashboard:
   - Requests include valid tokens for `sendBeauRocksEmailSignInLink`.
3. Monitor Firebase Auth and callable logs:
   - Verify email-link sends, sign-in completions, and low error rates during rehearsal traffic.
