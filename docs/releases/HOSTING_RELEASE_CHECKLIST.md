# Hosting Release Checklist

Last updated: 2026-02-28

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
  - `/for-hosts`
  - `/for-venues`
  - `/for-performers`
  - `/for-fans`
  - `/demo`
- `/demo` host iframe lands in host admin context (not room entry screen).
- Primary CTA links route correctly to intended surfaces/pages.

## Optional QA
- `npm run qa:marketing:golden`
- `npm run qa:marketing:cross-surface`

## Source Control
- Commit with release summary.
- Push `main` after deploy verification.
- Capture commit SHA + Hosting URL in release note.

