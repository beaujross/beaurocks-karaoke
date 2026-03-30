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

## Audience Email-Link Regression Checks

Add these checks to any release that touches auth, audience onboarding, or sign-in email templates:

- Request a fresh audience email sign-in link from the live app.
- Confirm the email body is readable in a real inbox client, not just the raw HTML preview.
- Confirm the CTA button works.
- Confirm the fallback raw link is visible and copyable if the button styling is stripped.
- Open the link on the same device used for email entry and verify sign-in completes once.
- Reload after successful sign-in and confirm the app does not try to verify the spent link again.
- Re-open the same link after success and confirm the app fails cleanly without looping.
- Test an expired or invalid link and confirm the user sees recovery UI plus a "send a fresh link" path.
- Confirm the browser URL is scrubbed of Firebase auth params after terminal invalid or expired-link failures.
- If testing cross-device, confirm the audience app prompts for recovery instead of failing silently.

## Audience Shell Crash Regression Checks

Run these whenever `SingerApp.jsx` changes or any release touches audience join/request/live-performance flow:

- Join room from a fresh mobile session.
- Request a song from browse/search without creating an account.
- Vote during an active performance.
- Open lyrics during an active performance.
- Trigger a ready check and respond from audience.
- Confirm no React minified hook-order or pre-init errors appear in console.

Invariant to protect:
- No hooks after early-return render boundaries.
- No early-return branch may reference derived values declared later in the component.
- Keep `tests/unit/singerAppHooks.test.mjs` current with the actual audience-shell structure.

## Song Resolution + Host Review Checks

Run these whenever queueing, YouTube curation, or unresolved-request UX changes:

- Audience submits a song intent that already has a trusted or room-curated backing.
- Confirm the request auto-resolves without host intervention.
- Audience submits a song intent with no known backing and confirm it lands in host `Unresolved Requests`.
- Host can choose `Host Search` or `Edit Request`, attach a YouTube backing, and resolve the request into the queue.
- Confirm the selected backing is added to the room YouTube library for future auto-resolution.
- After a successful YouTube-backed performance, confirm the room library entry is marked with additional usage/success signal.

## Event Credits + Promo Checks

Run these whenever `Credits & Funds`, Givebutter ingestion, or promo redemption changes:

- Guest joins without account and can still request/react/vote immediately.
- Givebutter-backed signed-in attendee receives matched credits/perks automatically by email.
- Guest with no match can still participate and claim later after linking/sign-in.
- Promo QR/deep-link auto-fills redemption without requiring tedious typing.
- Shared/manual codes remain fallback only; VIP / skip-line should not depend on reusable room-level secrets.

## Run Of Show + Co-Host Checks

Run these whenever `Show` or role access changes:

- `Show` workspace opens and makes `Build / Run / Review` modes available.
- A host can add/reorder timeline moments directly from the studio surface.
- A promoted co-host only sees the capabilities intended for them.
- Room-level host access and run-of-show co-host capability are aligned for any user expected to operate the show.
