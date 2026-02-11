# VIP SMS Auth Runbook

Last updated: 2026-02-11

## Purpose

Use this runbook to validate VIP phone verification for both test and real numbers before production launch.

## Prerequisites

- Firebase Auth `Phone` sign-in provider enabled.
- Firebase App Check enabled for web app.
- `VITE_RECAPTCHA_V3_SITE_KEY` configured in `.env.local` (for App Check tokening in web client).
- Domain allowlist includes your production and preview hostnames.

## Local setup

1. Set `.env.local`:
   - `VITE_RECAPTCHA_V3_SITE_KEY=...`
2. Run app:
   - `npm run dev`
3. For localhost testing, app code enables `auth.settings.appVerificationDisabledForTesting = true`.
4. In Firebase Auth console, add phone test numbers/codes for deterministic QA.

## QA test matrix

1. Test number flow:
   - Enter phone in E.164 format (`+15555555555`).
   - Send SMS, verify code, confirm VIP unlock and points grant.
   - Confirm `/users/{uid}` has `phone` and `vipLevel`.
2. Real number flow:
   - Repeat with real number.
   - Confirm SMS arrives and verify succeeds.
3. Retry/abuse limits:
   - Trigger repeated sends and confirm user sees "too many attempts" guidance.
4. UI entry points:
   - Verify both VIP tab flow and phone modal flow succeed (both now use dedicated reCAPTCHA containers).

## Known reliability guardrails in code

- Phone numbers are normalized to E.164-like input before submission.
- Distinct reCAPTCHA container IDs prevent duplicate DOM ID collisions across VIP views.
- Firebase auth error codes are mapped to user-facing guidance for common failures.

## Production checks before enabling enforcement

1. Run host smoke test with write checks enabled:
   - Confirm `/users/{uid}` write succeeds.
2. Validate App Check dashboard:
   - Requests include valid tokens for web app traffic.
3. Monitor Firebase Auth logs:
   - Verify successful `signInWithPhoneNumber` and low error rates.
