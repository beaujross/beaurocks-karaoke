# Host Login TDZ Hotfix

Date: 2026-04-30
Project: `beaurocks-karaoke-v2`
Branch: `main`
Deploy type: urgent dirty-worktree hosting-only hotfix

## Issue

- Production host login succeeded, then the host app crashed to a black screen.
- Browser console reported `Uncaught ReferenceError: Cannot access 'hv' before initialization` from the minified `HostApp` bundle.

## Root Cause

- `src/apps/Host/HostApp.jsx` introduced a same-scope temporal dead zone.
- `startRunOfShowItem` referenced `markScenePresetPresented` before that callback had been initialized.
- In production minification, that surfaced as `Cannot access 'hv' before initialization`.

## Change Shipped

- Moved `markScenePresetPresented` above `startRunOfShowItem` so callback initialization order is valid.
- Added a regression assertion in `tests/unit/hostRunOfShowControls.test.mjs`.

## Targets Deployed

- Firebase Hosting only
- Project: `beaurocks-karaoke-v2`
- Live hosting release version: `fd7f2c73caa1bce1`
- Live release record: `projects/426849563936/sites/beaurocks-karaoke-v2/channels/live/releases/1777593967039000`
- URLs:
  - `https://beaurocks.app`
  - `https://beaurocks-karaoke-v2.web.app`

## Verification

Commands that passed before or during deploy:

- `npx vitest run tests/unit/sourceTdzSafety.test.mjs tests/unit/hostRunOfShowControls.test.mjs tests/unit/hostQueueTabRuntime.test.mjs tests/unit/runOfShowDirectorPanelSource.test.mjs`
- `npm run build`
- `npm run deploy:hosting`
- `Invoke-WebRequest -Method Head https://beaurocks-karaoke-v2.web.app/assets/HostApp-fK6HwCbX.js`
- `Invoke-WebRequest -Method Head https://beaurocks.app/assets/HostApp-fK6HwCbX.js`

## Known Follow-Up Debt

- Full `npm test` is still not a clean release gate because unrelated lint failures remain in the repo.
- The canonical `qa:release:core-night` smoke did not run in this session because QA host credentials were not present in environment variables.
- Host bundle size remains large and should stay on the stability watchlist.
