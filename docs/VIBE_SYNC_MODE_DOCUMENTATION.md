# Vibe Sync Mode Documentation

## Scope
This document describes Vibe Sync behavior as currently implemented in code across:
- Host controls
- Mobile app (used by both active singer and audience members)
- Public TV screen
- Shared room state and scoring side effects

Primary sources:
- `src/apps/Host/components/OverlaysGuidesPanel.jsx`
- `src/apps/Host/HostApp.jsx`
- `src/apps/Mobile/SingerApp.jsx`
- `src/apps/TV/PublicTV.jsx`
- `src/apps/TV/hooks/useTvVisualizerSettings.js`
- `src/lib/uiConstants.js`

## Mode Inventory
The Vibe Sync panel currently exposes:
- `Beat Drop` (`lightMode: 'strobe'`)
- `Guitar` (`lightMode: 'guitar'`)
- `Banger` (`lightMode: 'banger'`)
- `Ballad` (`lightMode: 'ballad'`)
- `Storm` (`lightMode: 'storm'`)
- `Cam` (`activeMode: 'selfie_cam'`) - this is panel-adjacent, not a `lightMode`

## Shared Surface Model
- Host surface: toggles/starts mode by writing room document fields.
- Mobile surface: all participants in room receive mode UI; there is no separate "audience-only app."
- TV surface: overlays and leaderboards keyed from room state and room users.
- Data surface: `rooms/{roomCode}` carries active mode/timers/winner objects.
- Data surface: `room_users/{roomCode_uid}` carries per-user counters (`guitarHits`, `strobeTaps`, session ids).
- TV visualizer sync: when `visualizerSyncLightMode` is enabled, presets map by mode (`banger/strobe -> club`, `storm -> neon`, `ballad -> calm`, `guitar -> retro`).

## Maturity Snapshot
- Most interactive and complete: `Beat Drop`, `Guitar`
- Moderately immersive but mostly local interaction: `Storm`
- Mostly visual overlays with no gameplay loop: `Banger`, `Ballad`
- Related takeover mode outside lightMode system: `Cam`

## Beat Drop (`lightMode: 'strobe'`)
Host:
- Pressing `Beat Drop` sets `lightMode='strobe'`, creates `strobeSessionId`, and sets countdown + end timestamps.
- Timing defaults are `5s` countdown and `15s` active window.
- Host-side safeguard turns mode off after `strobeEndsAt`.

Mobile:
- Full-screen takeover with countdown, then tap target while active.
- Each tap increments local meter, vibrates, and batches writes to `room_users.strobeTaps` for the current `strobeSessionId`.

TV:
- Shows countdown, active timer, global tap meter, and top tap leaders.
- After end, computes top 3 winners from `room_users` for the session.
- Awards points via callable once-per-session key: 1st `150`, 2nd `90`, 3rd `50`.
- Writes `strobeWinner`, `strobeResults`, and `strobeVictory`.

Post-round interaction:
- Winner gets a mobile victory selfie prompt.
- Captured selfie writes `photoOverlay` to room for TV display.

Intended experience:
- Short synchronized crowd tap battle with visible leaderboard and winner moment.

## Guitar (`lightMode: 'guitar'`)
Host:
- Toggle on sets `lightMode='guitar'`, new `guitarSessionId`, clears prior winner/victory.
- Toggle off ends the session.

Mobile:
- Full-screen 5-lane "strum zone."
- Touch/click strums trigger haptics and throttled reaction events.
- Strums batch into `room_users.guitarHits` keyed by `guitarSessionId`.

TV:
- Shows "GUITAR SOLO" takeover and live top strummers from `room_users`.
- On mode exit, TV computes winner, awards 200 points once per session, logs activity, and writes `guitarWinner` + `guitarVictory`.

Post-round interaction:
- Winner gets mobile victory selfie prompt.
- Captured selfie publishes TV `photoOverlay`.

Intended experience:
- Competitive crowd strum race ending in MVP + victory content.

Current implementation note:
- Guitar has no built-in duration timer; it runs until toggled off.
- Mobile UI includes an `EXIT MODE` button that writes `lightMode='off'` directly.

## Storm (`lightMode: 'storm'`)
Host:
- `startStormSequence()` sets phase-based sequence: `approach 15s`, `peak 20s`, `pass 12s`, `clear 6s`.
- Host timers advance `stormPhase` and auto-reset mode at sequence end.
- `stopStormSequence()` immediately resets to off.

Mobile:
- Full-screen storm takeover with `Join the Storm` and `Tap to Spark`.
- Joining starts local ambient audio; tapping triggers local flash/haptics/thunder.
- UI message states host controls sequence.

TV:
- Full-screen storm overlays and phase-dependent ambient audio.
- Lightning flashes are triggered locally by analyzer thresholds on storm audio.

Intended experience:
- Shared atmospheric sequence controlled by host across phone + TV.

Current implementation note:
- Storm interaction is mostly local/per-device. Mobile taps do not currently write shared storm events to Firestore, so crowd spark actions are not aggregated into a shared storm mechanic.

## Banger (`lightMode: 'banger'`)
Host:
- Simple toggle on/off.

Mobile:
- Keeps normal app context; overlays high-energy visual treatment.

TV:
- Overlays banger/fire effects.

Intended experience:
- Fast "hype boost" visual without changing core interaction flow.

Current implementation note:
- No per-user gameplay input, scoring, winner, or timed sequence.

## Ballad (`lightMode: 'ballad'`)
Host:
- Simple toggle on/off.
- Can also be triggered temporarily by host game interactions.

Mobile:
- Keeps normal app context; overlays softer sway/haze/orb visuals.

TV:
- Ballad haze/glow/orb overlay.

Intended experience:
- Lower-intensity emotional lighting moment without flow interruption.

Current implementation note:
- No per-user gameplay input, scoring, winner, or timed sequence.

## Cam (`activeMode: 'selfie_cam'`) - Panel Adjacent
Host:
- Toggle between `activeMode='selfie_cam'` and `activeMode='karaoke'`.

Mobile:
- Full-screen camera UI with shutter button.
- Captures and uploads selfie as a photo reaction.

TV:
- Shows "SELFIE CAM ACTIVE" takeover state.
- Displays uploaded photos through existing `photoOverlay`/photo reaction pipeline.

Intended experience:
- Quick crowd photo moment orchestrated by host.

Current implementation note:
- This is not a `lightMode`; it is a full `activeMode` transition.

## Practical Build-On Opportunities
- Storm: add shared event writes (for spark/tap intensity) and TV-side aggregate rendering so audience actions materially shape the storm.
- Banger/Ballad: add lightweight interaction hooks (tempo taps, sways, call/response prompts) so they are not visual-only.
- Guitar: decide whether non-host users should be able to terminate mode; enforce with host-only end control if needed.
