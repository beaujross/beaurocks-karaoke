# Hosting Release Checklist

Last updated: 2026-03-09

## Release-Critical Contract

Blocking release contract for host-night stability:

1. Host can authenticate and open or create a room.
2. TV can attach to the room and show the valid room code/join path.
3. Audience can join from phone without dead ends.
4. Host and audience requests synchronize across host, TV, and audience.
5. Lyrics/media/performance flow stays stable through an active song.

Everything else is secondary to this contract.

## Preflight
- Confirm branch and working tree state.
- Verify environment and Firebase project mapping (`beaurocks-karaoke-v2`).
- Confirm production QA prerequisites are present:
  - `QA_APP_CHECK_DEBUG_TOKEN`
  - dedicated low-privilege QA host account
  - `QA_ALLOWED_HOST_EMAILS` if allowlist policy is enforced

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

## Mandatory Release Gate

Run the canonical production-facing gate:

```powershell
npm run qa:release:core-night
```

This currently resolves to the secure host-room hands-off smoke and is the command that should block deploy confidence.

Expected coverage:

1. Root-domain host login
2. Host room creation
3. Core automations enabled
4. TV load with QR and room code
5. Audience join
6. Host request sync to TV
7. Host request transitions into active performance
8. Audience surface shows the active performance state
9. Pop Trivia render/interaction on audience and TV during performance
10. Audience request sync to host and TV

Treat failures in this command as release blockers for host/audience/TV changes.

## Secondary Spot Checks

These are useful, but they do not outrank the core-night gate:

- Marketing core pages load:
  - `/discover`
  - `/join`
  - `/host-access`
  - `/demo`
- Persona pages still load:
  - `/for-hosts`
  - `/for-venues`
  - `/for-performers`
  - `/for-fans`
- `/demo` host iframe lands in host admin context (not room entry screen)
- Primary CTA links route correctly to intended surfaces/pages
- Host login-first gate works as expected:
  - unauthenticated `https://host.beaurocks.app/?mode=host...` redirects to `/host-access`
  - authenticated user can enter host control surface and see create-room UI

## Optional QA

- `npm run qa:marketing:golden`
- `npm run qa:marketing:cross-surface`
- `npm run qa:admin:prod`

## Async Pipeline Triage

If the room works but lyrics or Pop Trivia appear stranded:

```powershell
npm run ops:audit:async-pipelines
```

Inspect first:

1. Lyrics entries with `stale_pending`, `provider_error`, or `resolved_without_payload`
2. Pop Trivia entries with `stale_pending`, `failed`, or `ready_without_payload`
3. `recoveryEligible` counts to separate transient misses from items that should be retried or investigated

This script requires Firebase admin credentials and is also wired into the overnight intelligence report.

## Auth Bootstrap Invariant
- `initAuth` must not replace an existing authenticated session with anonymous auth.
- Regression fix shipped in commit `97bf4eb` with unit test coverage (`authBootstrap.test.mjs`).
- Discover default visibility update shipped in commit `4d79612` (`bounds-only` defaults off).

## Source Control
- Commit with release summary.
- Push `main` after deploy verification.
- Capture commit SHA + Hosting URL in release note.
