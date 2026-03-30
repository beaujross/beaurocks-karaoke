# 2026-03-24 Audience Email-Link Loop Fix

## Summary

Fixed a production regression in the audience app where email sign-in link verification could fall into a repeated `auth/invalid-action-code` loop after the link was already invalid, spent, or malformed from the client's point of view.

This release also improved sign-in email readability by increasing text contrast and adding a visible fallback raw-link block inside the email body.

## User-Visible Symptoms

- Audience sign-up or sign-in email arrived with low-readability text in some inbox clients.
- Clicking the sign-in link could show an expired-link style failure and then keep retrying in a loop.
- Browser console showed repeated requests to `accounts:signInWithEmailLink`.
- Firebase returned `auth/invalid-action-code`.

## Root Cause

The audience client was willing to keep attempting email-link verification while the Firebase auth params were still present in the browser URL.

That meant:

- `isSignInWithEmailLink(...)` kept returning true for the same address bar state.
- the verification effect could re-run after failure.
- terminal failures did not clear `oobCode` and related auth params from the URL.
- the user saw an effective infinite retry loop instead of a one-time failure with recovery UI.

## Fix

Client changes in `src/apps/Mobile/SingerApp.jsx`:

- added single-attempt guarding per verification URL
- allowed one retry only when the user changes the email input
- treated `auth/invalid-action-code` and `auth/expired-action-code` as terminal failures
- stripped Firebase auth params from the URL after terminal link failure
- reopened the account recovery UI instead of silently retrying

Email-template changes in `functions/index.js`:

- increased body copy contrast
- added a visible fallback raw-link panel
- kept same-device handoff guidance in the email body

## Verification

Local verification completed on 2026-03-24:

- `npm run build`
- `node --check functions/index.js`

Production deploy completed to project `beaurocks-karaoke-v2`:

- hosting
- `functions:sendBeauRocksEmailSignInLink`

Live URL:

- `https://beaurocks-karaoke-v2.web.app`

## Follow-Up

- Add release QA coverage for fresh-link, spent-link, expired-link, and cross-device audience email-link flows.
- Upgrade `functions/package.json` from the outdated `firebase-functions` version to reduce deploy-time warning noise.
