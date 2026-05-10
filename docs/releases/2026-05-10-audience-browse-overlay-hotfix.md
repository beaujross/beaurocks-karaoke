# Audience Browse Overlay Hotfix

Date: 2026-05-10
Project: `beaurocks-karaoke-v2`
Deploy type: dirty-worktree hosting-only hotfix

## Issue

- Audience song-browse overlays were sharing scroll and stacking context with the streamlined stage shell.
- In the Streamlined Audience app, live-status UI could bleed into browse surfaces and create overlapping elements while guests were trying to browse songs.

## Change Shipped

- Moved the custom browse-list overlay, Top 100 overlay, and room-library overlay onto the same `document.body` portal path already used by the audience search sheets.
- Extended the audience body-scroll lock so those browse overlays freeze the underlying page while open.
- Added a regression test to keep browse overlays isolated from the stage shell stack in `SingerApp`.

## Targets Deployed

- Firebase Hosting only
- Project: `beaurocks-karaoke-v2`
- Live hosting release version: `d7cc157d1e53ceaa`
- Live release record: `projects/426849563936/sites/beaurocks-karaoke-v2/channels/live/releases/1778443596392000`
- URLs:
  - `https://beaurocks.app`
  - `https://beaurocks-karaoke-v2.web.app`

## Verification

Commands and checks completed in this session:

- `npx vitest run tests/unit/singerAppHooks.test.mjs -t "browse overlays"`
- `npm run deploy:hosting`
- Local built-artifact smoke via Playwright against `dist` using the non-VIP audience fixture `crowd-song-faceoff`

Verification result:

- The targeted browse-overlay regression test passed.
- Hosting build and release completed successfully.
- AAHF-specific fresh-session visual verification of `streamlined-aahf-browse` is still partially blocked by the first-run festival profile gate, so a true end-to-end visual check of that exact fixture remains pending.

## Explicit Waiver

- Full `tests/unit/singerAppHooks.test.mjs` is not clean in this session because of an unrelated pre-existing join-copy assertion failure.
- That failure was not introduced by the browse-overlay hotfix and is waived for this hosting-only release note.

## Known Follow-Up Debt

- This deploy was made from a dirty worktree, so the live hosting release is not mapped to one clean commit in the current branch state.
- `src/apps/Mobile/SingerApp.jsx` already contained unrelated local edits outside the overlay hotfix, which blocked a clean isolation commit in this session.
- The AAHF browse flow should still be visually rechecked in a browser session that has already completed the festival-profile onboarding path.
