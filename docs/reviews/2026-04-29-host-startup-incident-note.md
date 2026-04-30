# Host Startup Incident Note

Date: 2026-04-29
Audience: CTO, Product, Engineering
Status: Fix prepared locally, not yet deployed

## Executive Summary

The production host surface has a startup-path defect that can make the app appear stuck on load for unauthenticated operators. The issue is not a Firebase Hosting outage. The page shell loads, but host startup can stall in auth bootstrap before routing the user into the proper host-access flow.

## Customer Impact

- `beaurocks.app`, `app.beaurocks.app`, and marketing routes are serving normally.
- `host.beaurocks.app` can present a long fullscreen loader instead of routing directly into host sign-in/access.
- In flaky or blocked network conditions, the host surface may attempt anonymous Firebase auth, fail, and delay recovery.

## Root Cause

Two startup-path problems combined:

1. Unauthenticated host startup still attempted anonymous auth bootstrap.
   - This is correct for audience/mobile flows, but incorrect for the host surface where a full BeauRocks account is required.
   - On host, that unnecessary auth attempt can fail with `auth/network-request-failed`, leaving the app on the loader longer than necessary.

2. `App.jsx` relied too heavily on the auth observer to flip `authReady`.
   - When auth/network is noisy, the UI can remain in loader state longer than necessary even after `initAuth()` has already resolved.

## Fix Prepared

Code changes now ready locally:

- Host surfaces no longer bootstrap anonymous auth.
- Host auth handoff routes through the marketing `host-access` surface instead of trying to keep users inside the host origin during access gating.
- `App.jsx` now synchronizes `uid`, account state, and `authReady` immediately after `initAuth()` resolves, instead of waiting only on the observer callback.

## Validation

- Targeted startup/auth tests pass:
  - `tests/unit/authBootstrap.test.mjs`
  - `tests/unit/hostCatalogLaunchSource.test.mjs`
- Production build passes locally.
- Existing unrelated repo health issues remain:
  - lint failures in host/mobile/TV surfaces
  - unit failures unrelated to this patch
  - oversized host/mobile bundles

## Recommended Rollout

1. Deploy the startup/auth fix immediately.
2. Re-check `host.beaurocks.app` with a signed-out browser session after deploy.
3. If host load still feels slow, prioritize bundle reduction on `HostApp` next.
4. Triage existing lint/unit failures separately so release confidence improves.

## Residual Risks

- App Check still shows `403`/throttle behavior in some startup traces and should be investigated separately.
- This fix removes the incorrect host anonymous bootstrap path, but does not address broader host bundle size or unrelated hook/lint violations.
