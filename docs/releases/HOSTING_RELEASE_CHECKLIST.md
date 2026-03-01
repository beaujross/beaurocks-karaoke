# Hosting Release Checklist

Last updated: 2026-03-01

## Preflight
- Confirm branch and working tree state.
- Verify environment and Firebase project mapping (`beaurocks-karaoke-v2`).

## Build
```powershell
npm run build
```

Expected notes:
- SEO sitemap may log Firestore credential unavailability and use cached fallback.
- Chunk-size warnings may appear for large bundles.

## Deploy
```powershell
npm run deploy:hosting
```

Expected success:
- Firebase Hosting release completes for `beaurocks-karaoke-v2`.
- Hosting URL returns updated build.

## Post-Deploy Spot Checks
- Marketing core pages load:
  - `/discover`
  - `/join`
  - `/host-access`
  - `/demo`
- Persona pages still load (secondary paths):
  - `/for-hosts`
  - `/for-venues`
  - `/for-performers`
  - `/for-fans`
- `/demo` host iframe lands in host admin context (not room entry screen).
- Primary CTA links route correctly to intended surfaces/pages.
- Host login-first gate works as expected:
  - unauthenticated `https://host.beaurocks.app/?mode=host...` redirects to `/host-access`
  - authenticated user can enter host control surface and see create-room UI

## Optional QA
- `npm run qa:marketing:golden`
- `npm run qa:marketing:cross-surface`
- `npm run qa:admin:prod`

## Known QA Drift
- `qa:marketing:golden` still expects older persona rail/buttons and may fail despite healthy current IA.
- `qa:admin:prod` requires authenticated host preconditions and can fail from `/host-access` if run cold.
- For release gating, prefer explicit production checks:
  - sign in on `/host-access`
  - enter `host` surface
  - create room
  - verify discover visibility
  - verify `Join room` routes to `/join/:roomCode`

## Auth Bootstrap Invariant
- `initAuth` must not replace an existing authenticated session with anonymous auth.
- Regression fix shipped in commit `97bf4eb` with unit test coverage (`authBootstrap.test.mjs`).
- Discover default visibility update shipped in commit `4d79612` (`bounds-only` defaults off).

## Source Control
- Commit with release summary.
- Push `main` after deploy verification.
- Capture commit SHA + Hosting URL in release note.
