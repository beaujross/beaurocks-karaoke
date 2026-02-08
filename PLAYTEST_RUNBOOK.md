# Host Runbook + Playtest Checklist

This is a quick, single-page guide for running a ~20 person playtest.

## Host Runbook (During the Session)
1) Launch
   - Open host panel.
   - Click `LAUNCH TV` for the public display.
   - Optional: click `LAUNCH CATALOGUE` on a tablet for browsing.
2) Create Room
   - Confirm room code is visible.
   - Say the room code out loud and point to it on TV.
3) Ready Check
   - Host panel: Stage > Overlays & Guides > `Ready Check`.
   - Watch the TV countdown and ready count.
4) First Song
   - Search a known karaoke track.
   - Add to queue and start the performance.
   - Confirm lyrics toggle works (TV + singer).
5) Crowd Moment (pick one)
   - Game: Flappy or Vocal Challenge.
   - or Bingo: load a board and launch.
6) Tip CTA
   - Toggle `Tip CTA` on TV.
   - Call out the tip link or QR.
7) Wrap
   - End the current performance.
   - Trigger recap overlay.
   - Thank everyone and ask for feedback.

## Playtest Checklist (Pre‑Session)
Core Flow
- Host creates room, TV + mobile connect.
- Singer joins (name + emoji).
- Search works (iTunes / YouTube / Local).
- Add to queue → play → end → recap.

Ready Check
- Countdown visible on TV.
- Singer can tap READY.
- Points reward applied once per check.
- Ready state resets for a new check.

Media + Audio
- Stage audio volume changes affect playback.
- BG audio continues between songs if enabled.
- Mix fader shifts audio balance correctly.
- Upload a local file → add to queue → play.

YouTube
- API key works for your origin.
- Search returns results.
- Playlist index loads and fallback search works.

Games
- Launch one game and stop it cleanly.
- For voice games, verify player selection + ambient mode.

Bingo
- Board loads + launches.
- Tile toggles work.
- Victory conditions show + rewards apply.

UI/UX
- Host panel scroll works on smaller screens.
- Game launchpad scroll works.
- Lyrics toggle can always be closed on singer.

Stability
- No red errors in console (host + TV + singer).
- Room stays responsive after 10+ minutes.

## Playtest Checklist (During)
- Run one full “ready check → song → recap.”
- Run one game or bingo round.
- Run a tip CTA.
- Capture top 3 user pain points.
- Ask: “What was confusing?” “What was fun?”

## Post‑Session Notes
- Record issues with screen, steps, and device.
- List top 3 fixes for next build.
