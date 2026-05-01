# Host Track Check Inbox Hotfix

Date: 2026-04-30
Project: `beaurocks-karaoke-v2`
Branch: `main`
Deploy type: urgent dirty-worktree hosting-only hotfix

## Issue

- Host operators were still getting post-performance track-check prompts directly in the stage panel.
- The stage-empty `Last Track Check` card offered only `Use Again` and `Bad Track`, which felt interruptive and did not match the host inbox model.

## Change Shipped

- Added explicit `Inbox` and `Skip` actions to the host-facing last-track review card.
- Changed the floating post-performance track-check prompt to auto-route into the host inbox instead of simply disappearing.
- Added deferred track-check items to the host inbox with `Use Again`, `Bad Track`, and `Skip` actions.
- Hid the stage card once that track check has been deferred or dismissed for the current performance.

## Targets Deployed

- Firebase Hosting only
- Project: `beaurocks-karaoke-v2`
- Live hosting release version: `ca3356a75ee88e8d`
- Live release record: `projects/426849563936/sites/beaurocks-karaoke-v2/channels/live/releases/1777595102293000`
- URLs:
  - `https://beaurocks.app`
  - `https://beaurocks-karaoke-v2.web.app`

## Verification

Commands that passed before or during deploy:

- `npx vitest run tests/unit/stageNowPlayingPanelSource.test.mjs tests/unit/hostQueueTabRuntime.test.mjs tests/unit/hostRunOfShowControls.test.mjs tests/unit/sourceTdzSafety.test.mjs`
- `npm run build`
- `npm run deploy:hosting`
- `Invoke-WebRequest -Method Head https://beaurocks.app/assets/HostApp-CxY77PQS.js`

## Known Follow-Up Debt

- Full production host smoke still was not run in this session because QA host credentials were not present in environment variables.
- This remains a dirty-worktree deploy, so rollback still depends on these release notes rather than a committed production SHA.
