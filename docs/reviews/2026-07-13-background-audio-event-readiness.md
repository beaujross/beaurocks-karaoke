# Background Audio Event-Readiness Closure

Date: 2026-07-13
Production Hosting release: `7aad694505045973`
Status: Closed and production-accepted

## Outcome

The Host can now open the unified media library, move between Background and Apple Music without the persistent Host chrome blocking the modal, start an uploaded background track, pause it from the in-library truth card, recover it without a reload, and delete the active source without leaving stale playback state. Host and TV report the same redacted playback capability and clear together after deletion.

The platform remains content-agnostic: uploaded files are a first-class fallback, Apple Music is presented through a connection/capability boundary, YouTube remains governed by embeddability and quota controls, and Spotify remains discovery or external handoff rather than an implied in-app streaming source.

## Changes Accepted

- Added `host.beaurocks.app` to the Firebase Storage CORS allowlist and verified the live bucket readback.
- Made active-upload deletion stop the Host media element and clear `bgMusicPlaying`, `bgMusicUrl`, and `backgroundAudioPlayback` before object/document deletion.
- Added an in-library `Pause Background` action that disables Auto BG before pausing, preventing immediate automated restart.
- Hid and disabled the persistent Host top chrome while the full-screen media library is open, restoring access to the Background and Apple Music tabs.
- Hardened the production drill to upload a disposable compatible MP3, inspect redacted Storage failures, verify Host/TV truth-state agreement, and clean up the active source.
- Corrected the QA confirmation-dialog ordering and accepted the server-rendered `recap not found` state for rooms without a published public recap.

## Persona Review

- CTO: one operation guard owns local playback transitions; deletion clears runtime and room truth before destructive storage work; QA diagnostics omit Storage tokens; no provider credentials or Apple authorization state are captured.
- Chief Product Officer: the Host sees one truth card and one contextual recovery action; pausing does not fight Auto BG; opening the library no longer traps or blocks navigation.
- Chief Marketing Officer: copy describes capabilities truthfully and reinforces BeauRocks as a content-agnostic party platform rather than a licensing-dependent catalog.
- Host/co-host: upload, start, pause, recover, change provider tab, and delete are reachable in one library without a page reload.
- Audience/TV viewer: TV reflects `playing/host_playback` while the Host device owns audio and clears when the Host deletes the source.

## Verification

- Full Vitest regression: 271 files, 960 tests, all passing.
- Full ESLint error gate: zero errors; established warnings unchanged.
- Production Vite build: passed.
- `git diff --check`: passed; line-ending notices only.
- Authenticated production persona path: room setup, Trivia launch, Singer join/interaction, TV live mode, recap fallback, End Mode, and return to karaoke all passed.
- Authenticated production background drill: upload, Host playback, TV truth agreement, pause, recovery, Apple connection-required CTA, active-source deletion, and Host/TV cleared state all passed.

## Evidence

Evidence is stored in `docs/reviews/evidence/2026-07-13-background-audio-event-readiness/`.

- `host-upload-playing.png`: uploaded source in confirmed Host playback.
- `tv-upload-playing.png`: TV truth state agrees with Host playback ownership.
- `host-upload-recovered.png`: source recovered after an in-library pause.
- `host-apple-capability.png`: Apple Music tab reachable and showing the connection-required capability boundary without authenticating or mutating Apple.
- `host-apple-tab-transition.png`: superseded diagnostic from the blocked-tab investigation; retained to document the defect that the stacking fix closed.
- `manifest.json`: hashes, release, and evidence roles.

## Next Bounded Slice

Move to YouTube event-scale readiness without adding a new provider schema:

1. finish the quota-extension submission packet with live Google Cloud quota evidence and final business/contact details;
2. capture a controlled quota-exhaustion/cooldown state and permanent-delete evidence;
3. expose event preflight metrics for indexed/curated reuse, live-search share, embeddable coverage, and remaining search reserve;
4. when live search is unavailable, prefer verified canonical/backing indexes and content-agnostic sources without scraping, multi-project quota circumvention, or non-embeddable TV claims.

Definition of done: the operator can determine before an event whether the catalog and quota reserve are sufficient, the audit packet matches deployed behavior, and a depleted YouTube search bucket degrades to compliant known catalog and alternative-source paths.
