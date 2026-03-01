# Release Note: Auth Bootstrap + Discover Visibility (2026-03-01)

## Summary
- Fixed a production auth regression where host entry could loop back to `/host-access` after successful login.
- Updated discover defaults so public sessions without coordinates are visible by default.

## Changes
- Auth bootstrap session-preservation fix:
  - commit: `97bf4eb`
  - behavior: auth initialization reuses existing signed-in user and does not force anonymous sign-in over a full account.
  - coverage: `tests/unit/authBootstrap.test.mjs`
- Discover bounds default:
  - commit: `4d79612`
  - behavior: `Bounds-only list` defaults to OFF.
  - effect: virtual/no-coordinate public rooms are visible by default in discover rail.

## Verification Notes
- Verified `host-access -> profile -> host dashboard` path reaches host controls after fix.
- Verified room-session discover/join path works with bounds filter disabled:
  - listing can be found in discover rail
  - `Join room` routes to `/join/:roomCode`

## QA Follow-Ups
- Update automated QA scripts that still assume older persona-rail or pre-auth host routing behavior.
- Keep an explicit release-gate check for:
  - auth gate correctness
  - host room creation
  - discover visibility
  - join route correctness

