# Host Control Surface Decisions
Date: 2026-02-19

## Goal
Reduce confusion between the **Admin Workspace** and the **Live Deck / live host surfaces** by defining clear ownership for duplicated controls.

## Decisions
| Control | Live Surface | Admin Surface | Decision | Why |
|---|---|---|---|---|
| `autoPlayMedia`, `autoBgMusic`, `autoDj` | Live Deck `Automation` dropdown | Admin `Automation` tab | Keep in both | Live Deck is for in-show toggles; Admin is for presets/default tuning. |
| `readyCheck` trigger | Live Deck button | Admin `Automation` tab | Keep in both | Host needs immediate trigger live; Admin is useful in setup/testing. |
| `showLyricsTv` / `showVisualizerTv` display mode | Live Deck `TV` dropdown | Admin `Playback` context | Keep in both | Live Deck handles rapid show switching; Admin owns broader playback configuration. |
| `chatShowOnTv` / `chatTvMode` | Live Deck `Overlays` dropdown | Admin `Chat` tab | Keep in both | Live toggle during show; Admin defines policy and default behavior. |
| `marqueeEnabled` | Live Deck `Overlays` dropdown | Admin `Marquee` tab | Keep in both | Live moment toggle vs content/rotation management in Admin. |
| Vibe Sync effects (`storm`, `strobe`, `guitar`, `banger`, `ballad`, `selfie_cam`) | Live Deck `Vibe` dropdown | Admin `Live Effects` tab | Live Deck primary, Admin secondary | Runtime control belongs in Live Deck; Admin keeps fallback + reset controls. |
| Soundboard / SFX | Live Deck `SFX` dropdown | Admin `Live Effects` tab | Live Deck primary, Admin secondary | Low-latency triggers should stay in Live Deck; Admin remains backup. |
| Apple Music connection | Top status pill | Admin `Playback` tab | Keep in both | Status pill = quick health + deep-link; Admin = full connect/disconnect workflow. |
| AI access status | Top status pill | Admin `Billing` / AI setup | Keep in both | Status pill gives instant health; Admin handles entitlement/workspace setup. |
| Access/Auth status | Top status pill | Admin `Room Setup` | Keep in both | Pill exposes operational readiness; Admin owns permission configuration. |

## UX Rule
- Live surfaces (Live Deck, stage/game/lobby tabs) are for **real-time show operations**.
- Admin is for **configuration, defaults, policy, and diagnostics**.
- Any button inside Admin that leaves Admin must be clearly labeled with **`(Exit Admin)`**.

## Phase 2 Applied
- `Live Effects` in Admin is now read-only plus emergency recovery actions (`Emergency Reset Scene`, `Silence All SFX`).
- Direct effect triggers and embedded soundboard controls are removed from Admin to prevent control-surface duplication.
- Chat TV runtime toggles were removed from Admin `Chat` + `Moderation` surfaces; those now show status and route to Live Deck for live switching.
- Added ownership badges across Admin sections:
  - `Config` = setup/default policy
  - `Live` = active runtime operations
  - `Fallback` = monitor + emergency recovery only
