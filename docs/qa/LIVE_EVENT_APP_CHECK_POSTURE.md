# Live Event App Check Posture

For live events, App Check should observe but not block core workflows.

## Event Mode

- Firebase service enforcement: `UNENFORCED`
- Functions runtime: `APP_CHECK_MODE=log`
- Web build: `VITE_APP_CHECK_ENABLED=true`
- Web build: `VITE_REQUIRE_APP_CHECK=false`

This keeps App Check telemetry active while allowing Auth, Firestore rules, Storage rules, callable host checks, rate limits, and server validation to carry production authorization.

## Verify

```bash
npm run ops:appcheck:event-mode:check
```

## Apply

```bash
npm run ops:appcheck:event-mode
```

## Pre-Show Smoke

- Host signs in on the production URL.
- Host creates or opens the room.
- Host uploads a scene image.
- Host launches the scene to Public TV.
- Guest joins from a phone.
- Guest submits email if email capture is enabled.
- Guest requests a song.
- Host can approve, queue, and control playback.

Do not switch App Check to `ENFORCED` for Firestore, Storage, or Auth until these paths have clean repeated production smoke runs.
