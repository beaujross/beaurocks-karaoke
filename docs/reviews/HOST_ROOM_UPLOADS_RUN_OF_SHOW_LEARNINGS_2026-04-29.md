# Host Room Uploads + Run Of Show Learnings

Date: April 29, 2026

## Scope

This review covered the host-side changes that:

- make the AAHF room easier to find from the host launch surface
- unify local media ingest under `Room Uploads`
- allow uploaded image/video assets to flow into `TV Library` and `Run Of Show`
- make room reset and asset deletion clean up linked run-of-show / TV state

## What Changed

- Added an `Event Focus` strip for the AAHF room in the host launchpad.
- Made `Room Uploads` the shared ingest surface for queue media, scene media, and run-of-show media.
- Simplified run-of-show insertion to one smart action: `Use In Run Of Show`.
- Added smart targeting for uploaded scene media:
  - selected scene slot first
  - otherwise active live/staged/next media-capable slot
  - otherwise append a new scene moment
- Hardened cleanup:
  - room reset now clears `programMode`, `runOfShowEnabled`, `runOfShowDirector`, `announcement`, `tvPreviewOverlay`, and `appleMusicPlayback`
  - deleting a room upload or scene preset now strips linked run-of-show references before deleting storage/docs
- Added stable media identity fields to run-of-show presentation plans:
  - `mediaSceneSourceUploadId`
  - `mediaSceneStoragePath`
  - `mediaSceneFileName`

## CTO Review

Status: approved

Original blocker:

- reset/delete flows could remove uploaded assets while leaving stale run-of-show or Public TV references behind

Fix that closed it:

- introduced `src/apps/Host/runOfShowMediaCleanup.js`
- reset now clears both room-level live TV state and run-of-show state together
- single-asset deletion now reconciles show items, live announcement state, and preview state before file/doc deletion
- media-scene identity is now persisted beyond raw URL matching

Residual risks:

- matching still falls back to `mediaUrl` when stronger identity is missing
- there is still no full UI interaction test for `upload -> use in run of show -> delete/reset -> verify TV`

## Product Review

Status: approved with non-blocking refinements

What product liked:

- AAHF is easier to reach from the host panel
- `Room Uploads` now behaves like one front door instead of fragmented ingest paths
- smart targeting is cleaner than forcing hosts through another picker
- cleanup now better matches host expectations and preserves trust

Remaining product refinement:

- the pending-upload card still has too many equal-weight actions at upload time

Recommended next pass:

- make one upload action visually primary
- keep secondary destinations available after upload from the asset row
- expose clearer target context for `Use In Run Of Show`

## Key Learnings

- Shared ingest is the right host mental model. `Room Uploads` should remain the single entry point for local media.
- Smart defaults are better than extra prompts, but the system should show where it will place media.
- Cleanup behavior is part of UX. Reset and delete flows must remove stale live/show references or hosts stop trusting the room state.
- Event-priority rooms benefit from dedicated launch affordances; the AAHF strip is a good pattern for future marquee rooms.
- Stable asset identity matters. URL-only references are not enough once uploads can be reused across library, TV, and run-of-show surfaces.

## Verification

- `npx vitest run tests/unit/runOfShowMediaCleanup.test.mjs tests/unit/runOfShowDirector.test.mjs tests/unit/hostRunOfShowControls.test.mjs tests/unit/hostSetupSource.test.mjs tests/unit/hostRoomLaunchPadSource.test.mjs tests/unit/hostRoomLaunchPadRuntime.test.mjs`
- `npx esbuild src/apps/Host/HostApp.jsx --bundle --platform=browser --format=esm --outfile=NUL`
- `npx esbuild src/apps/Host/runOfShowMediaCleanup.js --bundle --platform=node --format=esm --outfile=NUL`

Known non-blocking warning:

- duplicate `sharp` key remains in `package.json`
