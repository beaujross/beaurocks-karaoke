# Content Source, Autopilot, and Directory Production Release

Date: 2026-07-24
Project: `beaurocks-karaoke-v2`
Deploy type: dirty-worktree Functions and Hosting release
Branch at deploy: `agent/host-queue-horizon-readability`
HEAD at deploy: `236cf89142fa549a4a4aa0c62f3370ac11b74377`

## Scope Shipped

- Content-agnostic song and playback-source modeling, including song-level requests that can be resolved to a specific playable version.
- Contextual source badges and clearer host handling for requested songs versus selected backing tracks.
- Sing-Along and Lip Sync room recipes, plus format-aware Auto DJ behavior.
- Host queue controls and setup refinements carried in the current production scope.
- Public directory owner pathways for submitting, claiming, and maintaining karaoke nights and venues.
- Public chart, discovery, listing, profile, venue, and event refinements included in the accumulated release.
- Server-side queue request fields and associated callable behavior.

## Targets Deployed

- Firebase Functions
- Firebase Hosting
- Firestore rules were not changed and were not deployed.

Production identifiers:

- Hosting version: `9b126f4b297095b9`
- Live release: `projects/426849563936/sites/beaurocks-karaoke-v2/channels/live/releases/1784929685385000`
- Firebase project: `beaurocks-karaoke-v2`
- URLs:
  - `https://beaurocks.app`
  - `https://beaurocks-karaoke-v2.web.app`

## Verification

Completed before deployment:

- Production build passed.
- Client bundle budgets passed:
  - Host: 1051.8 kB / 1100.0 kB
  - Audience: 545.0 kB / 565.0 kB
  - Game registry: 7.1 kB / 20.0 kB
  - Game launcher: 154.9 kB / 175.0 kB
- Focused playback, Auto DJ, room recipe, marketing, and integration tests passed: 8 TAP checks and 48 Vitest tests.
- `npm run lint:functions` passed.
- `npm run test:callables` passed in full.
- Local marketing golden paths, cross-surface profiles, and AAHF Discover-to-Join checks passed.

Completed after deployment:

- Production marketing golden paths passed all nine checks on `https://beaurocks.app`.
- Production cross-surface checks passed on desktop Chromium, Android Chromium, and iOS WebKit.
- Legacy `/marketing` and `/auto-demo` redirects, UTM preservation, and conversion attribution passed.
- Public charts and Discover-to-Charts smoke checks passed on desktop and mobile.
- Charts reported no horizontal viewport overflow at 1440 px or 390 px.

## Explicit Limitation

- `npm run qa:release:core-night` could not run because this environment does not have `QA_HOST_EMAIL` and `QA_HOST_PASSWORD`. The script exits without executing its credentialed host-room flow when those values are absent. This is recorded as unavailable, not passed.
- A signed-in manual host-room production pass remains the required follow-up for room creation, queue operations, playback-source selection, and Auto DJ behavior.

## Non-Blocking Warnings

- Firebase CLI reported a generic functions dependency upgrade advisory even though `functions/package.json` currently declares `firebase-functions ^7.2.5`; the deployment completed successfully.
- Browserslist data is seven months old.
- Vite continues to report chunks above 500 kB. The enforced bundle budgets still passed.
