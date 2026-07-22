# Apple Music Timed Lyrics Readiness Review

Date: 2026-07-19

## Outcome

Apple-backed queue items now use the same canonical lyric fields and shared `AppleLyricsRenderer` as YouTube/local performances. When Room Setup enables Auto Lyrics, a host-side Apple selection immediately retries the resolver with the connected Music User Token; Apple selections created by audience members are also adopted by the connected Host session. Timed lyrics on TV and singer surfaces are clocked from MusicKit playback position and remain anchored across pause/resume. Apple background playlists are explicitly excluded from the performance lyric clock.

## Data And Rendering Path

1. An Apple catalog selection stores its canonical `songId`, rendition `appleMusicId`, source, duration, and artwork on the queue item.
2. `autoLyricsOnQueue` controls automatic enrichment. Existing host-provided lyrics remain usable even when automation is off.
3. The resolver checks `song_lyrics/{songId}` first, then the Apple provider, then an approved timed-provider adapter if configured.
4. Resolved text is stored in `lyrics`; time-coded lines use `lyricsTimed[]` with `text`, `startMs`, and `endMs`.
5. The TV `Stage` and streamlined/classic Singer surfaces both render through `AppleLyricsRenderer`.
6. `lyricsPlaybackClock` converts authoritative MusicKit `positionSec` and `lastReportedAt` into the renderer clock. YouTube/local performances now use the same anchored model with the TV player's `playerPositionSec` heartbeat, including pause/resume; the older room timestamp remains the fallback when no player report exists.

## Host Controls And Display Controls

Lyrics acquisition and lyrics display are deliberately separate controls:

- `autoLyricsOnQueue` turns automatic queue enrichment on or off. It does not force lyrics onto either display.
- `showLyricsTv` controls the public TV lyrics layer.
- `showLyricsSinger` controls host-pushed lyrics on audience/singer phones. A singer can still open attached lyrics manually.
- `lyricsMode` selects focused auto-follow versus the full lyric sheet.
- `lyricsScrollMode` selects playback-following versus manual host scrolling.

Manual host-provided lyrics remain available regardless of automatic enrichment. Static text is not genuinely synchronized: the renderer estimates line spans across the saved track duration. `lyricsTimed[]` or embedded LRC timestamps are required for real synchronization.

## Provider And Rights Boundary

Apple's public documentation exposes whether a catalog song has lyrics (`hasLyrics`), but the reviewed public Apple Music API song relationships do not document a lyric-text or TTML endpoint. The iTunes Search API supplies catalog metadata and promotional previews, not a licensed lyrics feed. Therefore the existing `/songs/{id}/lyrics` integration must be treated as experimental and cannot be the sole public-launch contract without written Apple confirmation.

Production-safe sources for the canonical repository are:

- host/original content for which BeauRocks has display and synchronization rights;
- a licensed lyrics provider whose agreement explicitly permits karaoke/event display, synchronization, and the intended cache duration;
- timecodes authored by BeauRocks for lyric text BeauRocks is already licensed to display;
- Apple-provided timed lyrics only if Apple confirms this client, presentation, and storage pattern is permitted.

Do not treat AI generation of a commercial song's full lyrics as a rights-cleared lyrics source. AI may help align or timestamp text that is already licensed, but it should not create or reconstruct copyrighted lyric text for public display. The production default keeps `LYRICS_AI_FALLBACK_ENABLED` off, the callable rejects manual AI lyric requests while it is off, and the Host no longer exposes AI full-lyrics buttons. Any future re-enable requires an explicit rights and product review and must be limited to rights-cleared material.

When Apple returns code `40012`, the resolver now distinguishes two states. Without a Music User Token, the Host is prompted to authorize Apple Music. If the same response occurs after a user token is supplied, the queue item records `apple_permission_denied`; it is not mislabeled as a catalog miss and is not repeatedly retried as though reconnecting will fix it.

## Remaining Public-Launch Gate

The technical engine and data model are ready for timed lyrics. The external source is not yet contractually production-ready. Before marketing synchronized Apple sing-along lyrics as a guaranteed feature, follow `docs/compliance/APPLE_MUSIC_LYRICS_ACCESS_REQUEST_GUIDE_2026-07-19.md` and obtain Apple confirmation, or integrate a licensed timed-lyrics provider through `timedAdapterProvider`. Then add provider-specific retention/provenance controls and end-to-end QA with an authorized test catalog.
