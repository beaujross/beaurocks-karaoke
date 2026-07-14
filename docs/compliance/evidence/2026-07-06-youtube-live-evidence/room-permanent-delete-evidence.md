# Production Room Permanent-Delete Evidence

Captured: 2026-07-13

Project: `beaurocks-karaoke-v2`

Hosting release: `ac2b07c988fe1f57`

Callable: `permanentlyDeleteHostRoom`, `ACTIVE` in `us-west1`, updated `2026-07-13T23:48:29.513558927Z`

Disposable QA room: `26V3`

## Safety Contract

The production path requires authenticated room-host access, an organization `owner` or `admin` role, an archived room, and an exact confirmation-code match. It is rate limited and App Check aware. Room-scoped Firestore collections remain closed to ordinary client deletion; the server callable owns the purge.

Storage objects referenced by room documents are deleted before Firestore documents. If a storage deletion fails, the callable stops before deleting the room document.

## Captured UI Evidence

- `room-permanent-delete-confirmation.png`
  - captured `2026-07-13T23:58:35.4636707Z`
  - SHA-256 `617FE266F1B6790F8E1293CD3CEBCD0C51B5E8FCB4834D433E475FB1F7D162E3`
- `room-permanent-delete-success.png`
  - captured `2026-07-13T23:58:39.8159964Z`
  - SHA-256 `F3E4CB4F920A4375BB411A273BA2FDF4F00EA0F82BE91C02F291AC9B8704F15A`

Both browser dialogs were accepted in order: the permanent-delete confirmation and the typed `26V3` prompt. The success capture was written after the production callable returned successfully.

The evidence harness subsequently encountered a detached post-delete search field because the Room Manager remounted after deletion. That post-action verifier has been hardened to reacquire a visible search field when one remains. The UI action outcome is independently verified below and does not rely on the transient locator.

## Independent Production Verification

Authenticated Firestore REST checks after the action returned:

- `404` / absent: `artifacts/bross-app/public/data/rooms/26V3`
- `404` / absent: `artifacts/bross-app/public/data/host_libraries/26V3`
- zero documents with `roomCode == 26V3`: `room_uploads`
- zero documents with `roomCode == 26V3`: `room_scene_presets`
- zero documents with `roomCode == 26V3`: `karaoke_songs`
- zero documents with `roomCode == 26V3`: `reactions`
- zero documents with `roomCode == 26V3`: `activities`
- zero documents with `roomCode == 26V3`: `messages`
- zero documents with `roomCode == 26V3`: `room_users`
- zero documents with `roomCode == 26V3`: `contacts`
- zero documents with `roomCode == 26V3`: `selfie_submissions`
- zero documents with `roomCode == 26V3`: `crowd_selfie_submissions`
- zero documents with `roomCode == 26V3`: `selfie_votes`
- zero `room_sessions` documents with `roomCode == 26V3`

## Stability Evidence

- complete unit suite: 277 files / 975 tests passed
- complete room-callable emulator matrix passed
- dedicated callable integration test passed unauthenticated denial, non-host denial, exact-code enforcement, archive enforcement, and complete purge
- full Firestore/Storage rules suite passed without widening client delete permissions
- scoped lint: zero errors
- canonical Vite production build passed
- Functions deployment completed and callable state was independently confirmed `ACTIVE`
- Hosting release `ac2b07c988fe1f57` completed successfully
