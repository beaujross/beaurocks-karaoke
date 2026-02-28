# Demo Surface Integration Notes

Last updated: 2026-02-28

## Overview
- `/demo` is a multi-surface marketing experience that renders native `tv`, `audience`, and `host` surfaces in iframes.
- Goal: show realistic cross-surface behavior while supporting both interactive testing and scripted autoplay.

## Demo Modes
- `interactive`: default mode.
- `autoplay`: scripted timeline mode.
- Query inputs recognized:
  - `demo_view=interactive|autoplay`
  - `demoView=interactive|autoplay`
  - `autoplay=1` (legacy shortcut to autoplay)

## Demo Room Contract
- Demo room codes must start with `DEMO`.
- Room code is persisted in session storage and reused between reloads.
- Key behavior:
  - if sync permission conflicts occur, the demo may rotate to a fresh `DEMO...` room code.

## Surface URL Contract (Current)
- URLs are built via `buildSurfaceUrl(...)` through marketing helpers.
- `audience` surface includes mobile layout framing.
- `tv` surface is loaded in `mode=tv`.
- `host` surface is deep-linked to host admin workspace:
  - `mode=host`
  - `mkDemoEmbed=1`
  - `hostUiVersion=v2`
  - `view=ops`
  - `section=ops.room_setup`
  - `tab=admin`

## Live Sync Path
- Demo scene progression can call `runDemoDirectorAction` through marketing API wrappers.
- Sync actions include bootstrap/scene/tick/seek/pause flows.
- `runDemoDirectorAction` enforces demo-host ownership for the target room.

## Host Embed Bootstrap Fallback
- In host embed mode (`mkDemoEmbed=1`), when silent join hits `not-found`:
  - host client attempts `runDemoDirectorAction` with `bootstrap`
  - then retries host access
  - and transitions into panel view
- Purpose: avoid broken first-paint in demo host iframe when room is not pre-created.

## Troubleshooting
- Symptom: host iframe lands on room-entry UI instead of admin panel.
  - Check host deep-link params above are present.
- Symptom: demo sync errors for room ownership.
  - Ensure room code begins with `DEMO` and auth context is valid.
- Symptom: sitemap warnings during build around Firestore credentials.
  - Expected fallback behavior is to cached route manifest unless strict mode is enabled.

