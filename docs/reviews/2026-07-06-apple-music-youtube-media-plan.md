# Apple Music + YouTube Media Plan

Date: 2026-07-06

## Goal

Improve BeauRocks Karaoke media workflows for high-usage party days by reducing avoidable YouTube Data API quota burn while making Apple Music more useful after the host connects an account.

The product direction is:
- YouTube remains the primary source for karaoke backing tracks.
- Apple Music becomes the host's easy source for background music, full-song sing-along fallback, canonical song metadata, and playlist-driven vibe control.
- The host should not have to manage separate start/stop controls for different background music sources.

## Current Decisions To Preserve

1. One background music lifecycle control.
   - The BG button and Auto BG controls own background start/stop.
   - If an Apple Music background playlist is configured, BG starts/stops Apple Music.
   - If no Apple playlist is configured, BG uses the built-in background tracks.
   - Apple settings may offer setup and `Play Now`, but should not reintroduce separate Apple pause/resume controls.

2. YouTube source mode stays lightweight.
   - Host and audience can switch between karaoke-focused YouTube search and broader embeddable YouTube search.
   - Hosts can paste a YouTube URL directly.
   - Non-embeddable results should be blocked or clearly unavailable inside BeauRocks.

3. Cached and indexed YouTube tracks are first-class.
   - Known room/global tracks should be reused before spending live `search.list` quota.
   - Idle quota should be spent on low-cost refresh/indexing work, not repeated event-time searching.

## Apple Music Library Expansion

Once a host connects Apple Music, the app should make their own Apple Music content available without requiring copy/paste IDs.

### Surfaces

Add an Apple Music picker inside Media Setup / Playback:

- `My Playlists`
- `Recently Played / Heavy Rotation`
- `Search Apple Music`
- `Paste URL or ID` as a fallback, not the default path

The picker should be compact and setup-oriented. It should not look like another player.

### Playlist Actions

Each playlist row/card should expose:

- `Use for BG` as the primary action in background music setup
- `Play Now` as a secondary action
- optional overflow actions for copying/storing the playlist ID

This keeps the mental model clear:
- selecting a playlist is configuration
- BG/Auto BG controls are runtime playback

### Personalized Content

Investigate and, where supported, expose:

- user library playlists
- recently played or heavy-rotation content
- recommendation-style Apple Music content
- catalog search results

Use conservative labels such as `From Your Apple Music` instead of promising exact native-app surfaces like `Made for You` until the API behavior is verified in production.

## Technical Shape

### Authentication

Reuse the existing MusicKit connection path:

- host requests an app developer token from `createAppleMusicToken`
- MusicKit authorizes the host and provides a Music User Token
- client calls Apple Music user/library APIs only while the host is connected

Do not persist long-lived Music User Tokens in Firestore.

### Data To Cache

Cache only lightweight user-visible metadata:

- playlist ID
- playlist name
- artwork URL, if available
- source type: `library_playlist`, `catalog_playlist`, `heavy_rotation`, `recent`, `search`
- last selected timestamp
- last used as background timestamp

Avoid storing full user libraries. Refresh live after connection.

### Playback

For background playlists:

- `Use for BG` writes `appleMusicAutoPlaylistId` and `appleMusicAutoPlaylistTitle`
- BG start calls the existing shared `setBgMusicState(true)` path
- BG stop calls the existing shared `setBgMusicState(false)` path
- TV display reads from `room.appleMusicPlayback`

For performance backing:

- Apple Music can be used as a full-song sing-along or canonical metadata source.
- YouTube remains the expected karaoke backing source.
- Do not optimize for mixed Apple + YouTube playback inside a single performance unless a real host workflow appears.

## YouTube Quota Impact

Apple Music library browsing does not replace YouTube karaoke backing, but it should reduce live YouTube search pressure in three ways:

1. Hosts can run background music from Apple playlists instead of searching YouTube for room vibe tracks.
2. Apple catalog search can clarify the intended song title/artist before the app looks for a YouTube karaoke backing.
3. Known Apple song IDs can enrich trusted catalog entries, improving dedupe and search intent matching.

During quiet days, keep using available YouTube quota for useful maintenance:

- refresh known `videoId` entries with `videos.list`
- revalidate stale room/global karaoke picks
- index host-provided YouTube playlists at low concurrency
- avoid burning `search.list` quota on speculative broad catalog expansion unless it is tied to real room demand

## Canonical Backing Catalog And Ranking

Use Apple/iTunes song identity as the stable catalog anchor, then attach multiple YouTube backing options to that song. This lets the app answer "what is the best karaoke backing for this canonical song?" without relying on YouTube view count as the main ranking signal.

### Canonical Song Shape

Collection: `canonicalSongs/{canonicalSongId}`

Recommended fields:
- `canonicalSongId`: stable ID, preferably `apple:{appleMusicId}` when Apple/iTunes metadata exists
- `appleMusicId` / `itunesTrackId`
- `title`, `artist`, `album`, `durationMs`, `isrc` when available
- `normalizedTitle`, `normalizedArtist`
- `lastResolvedAt`, `createdAt`, `updatedAt`

### Backing Candidate Shape

Collection option: `canonicalSongs/{canonicalSongId}/backingCandidates/{candidateId}`

Recommended fields:
- `candidateId`: `{canonicalSongId}__youtube__{videoId}` normalized for document IDs
- `canonicalSongId`, `appleMusicId`
- `provider`: `youtube`
- `providerTrackId` / `videoId`
- `title`, `channelTitle`, `durationSec`, `thumbnailUrl`
- `mediaUrl`, `embedUrl`
- `youtubePlaybackStatus`, `embeddable`, `playable`
- `sourceDiscovery`: `host_search`, `audience_search`, `playlist_index`, `idle_refresh`, `trusted_catalog`
- `titleIntentMatch`, `durationFit`, `sourceTrust`
- `viewCount`: retained as a weak prior, not a primary quality signal
- `telemetry`: aggregate counters
- `rankingScore`: computed score from the shared ranking utility
- `lastVerifiedAt`, `lastUsedAt`, `createdAt`, `updatedAt`

### Feedback Event Shape

Collection option: `backingFeedbackEvents/{eventId}`

Recommended fields:
- `roomCode`, `performanceId`, `canonicalSongId`, `candidateId`
- `actorRole`: `host`, `co_host`, `audience`, `system`
- `signal`: `upvote`, `downvote`, `used`, `completed`, `skipped`, `singer_override`, `blocked_embed`
- `weight`: calculated server-side from actor role and signal
- `createdAt`

The aggregate candidate telemetry should keep separate counters for:
- host up/down votes
- co-host up/down votes
- audience up/down votes
- usage count
- completion count
- skip count

Ranking rule of thumb:
- embeddability is mandatory for in-app playback and carries a major penalty when false
- host and co-host feedback outweighs audience feedback
- completion and skip behavior matter more than YouTube popularity
- YouTube view count is only a small prior for cold-start candidates

The initial scoring implementation lives in `src/lib/backingTrackRanking.js` so the scoring behavior is testable independently.

Current implementation note:
- The repo's active canonical song root is `songs/{songId}`, so the first persistence pass writes aggregate backing candidates to `songs/{songId}/backing_candidates/{candidateId}`.
- `recordTrackFeedback` now also writes append-only feedback events to `backing_feedback_events/{eventId}` with a telemetry snapshot.
- Backing candidate ID normalization, telemetry shaping, aggregate writes, event writes, and canonical backing summaries live in `functions/lib/backingCandidates.js` so the callables remain easier to audit.
- This gives us the ranked backing data model now without forcing a disruptive migration to `canonicalSongs/{canonicalSongId}` before the rest of the product flow needs it.

## Implementation Phases

### Phase 1: Apple Music Picker Spike

Goal: prove what the connected host account can browse and play reliably.

Tasks:
- add a small Apple Music API/MusicKit client wrapper for user playlists, heavy rotation/recent content, and catalog search
- confirm whether library playlist IDs can be played directly through MusicKit queue APIs
- confirm artwork/title/track-count fields for library playlists
- confirm behavior when the host is connected but not an active Apple Music subscriber

Exit criteria:
- a developer can connect Apple Music and see real playlist rows in a local/test room
- at least one selected playlist can be played via the existing BG control path
- unknown or unsupported personalized surfaces fail gracefully

### Phase 2: Media Setup UX

Goal: replace paste-first Apple playlist setup with a picker-first flow.

Tasks:
- add tabs or segmented controls for `My Playlists`, `Recent`, and `Search`
- add `Use for BG` and `Play Now` actions
- keep paste URL/ID available in an advanced/fallback row
- show the currently selected BG playlist near the existing BG controls without adding new stop/start buttons

Exit criteria:
- host can connect Apple Music, choose a playlist, start/stop it with BG, and see the title on Host + TV
- no separate Apple pause/resume control appears in the setup card
- fallback paste flow still works

Current implementation note:
- The Apple Music setup card now uses larger labels, larger touch targets, and a selected BG playlist chip.
- Explanatory helper copy was reduced so the remaining UI communicates through `Connect`, `Use for BG`, `Play Now`, and the shared BG control.
- The fallback paste flow is still available behind a compact disclosure instead of being the default path.

### Phase 3: Queue + Karaoke Assist

Goal: use Apple Music to make song intent cleaner without pretending it is always karaoke backing.

Tasks:
- let host/audience Apple search identify canonical song + artist
- preserve YouTube-backed karaoke search as the next step for performances
- store Apple IDs alongside trusted catalog choices when helpful
- show clear source labels: `Apple Music full song`, `YouTube karaoke backing`, `Known backing`

Exit criteria:
- Apple search can seed a queue request without forcing live YouTube search immediately
- host review can approve Apple full-song sing-along or pick a YouTube backing
- source labels are clear on Host, Audience, and TV surfaces

Current implementation note:
- `getBackingSourceLabel` now exposes clear full labels (`Apple Music full song`, `YouTube karaoke backing`, `Known backing`) and compact labels for dense chips.
- Host add/search results and the Audience now-playing chip use the shared source labels instead of local one-off `Apple` / `YouTube` / `Local` strings.
- The labels clarify source intent without adding another playback control or setup step.

### Phase 4: Quota-Aware Catalog Maintenance

Goal: use sporadic event cadence intelligently.

Tasks:
- add a maintenance job for stale known YouTube IDs using low-cost `videos.list`
- prioritize refreshes by recent room usage and trusted picks
- add host-visible status for indexed/verified catalog freshness
- add guardrails so maintenance pauses near event-time quota reserves

Current implementation note:
- `src/lib/youtubeIndexMaintenance.js` plans low-cost refresh batches for known YouTube index entries.
- `functions/lib/youtubeIndexMaintenance.js` mirrors the planner for backend jobs and applies `videos.list` refresh results.
- Host-side room index refresh uses the planner to prioritize high-value stale entries and hold maintenance when estimated fresh searches left are at the event reserve.
- The Room Library Curator now shows catalog health in the existing curator panel: indexed YouTube count, fresh playable count, proven host-approved count, due refresh count, latest check age, and remaining estimated fresh searches.
- The visible catalog state uses the same refresh planner as maintenance, so hosts see `Ready`, `Refreshing`, `Quota Protected`, or `Needs Tracks` without learning another control.
- `nightlyYouTubeIndexCleanup` now keeps its cleanup pass and, when a YouTube key is configured, refreshes a bounded set of stale high-value host library entries with `videos.list`.
- The nightly job also backfills a bounded set of verified embeddable indexed tracks with canonical IDs into `songs/{songId}/backing_candidates`, without spending live YouTube search quota.
- The nightly refresh drops entries that are no longer playable inside BeauRocks, so stale non-embeddable videos do not stay promoted.

Exit criteria:
- known tracks stay fresh without requiring live event search
- event-day search budget is protected
- YouTube audit packet can describe proactive refresh and quota reserve behavior

### Phase 5: Canonical Backing Ranking

Goal: build the reusable data layer for "best known backing track for this Apple/iTunes song."

Tasks:
- keep using `songs/{songId}` as the current canonical root, then introduce or migrate to `canonicalSongs/{canonicalSongId}` only when Apple/iTunes identity coverage justifies it
- write/update YouTube backing candidate docs when hosts paste, search, approve, index tracks, or leave track feedback
- record host/co-host/audience feedback as append-only events and aggregate it onto backing candidates
- compute ranking scores with the shared backing ranking utility
- prefer high-ranking, verified embeddable candidates before spending live YouTube search quota

Exit criteria:
- a canonical Apple/iTunes song can return ranked YouTube backing options
- host/co-host feedback can promote or demote a backing independent of YouTube view count
- non-embeddable tracks cannot win the in-app ranking
- ranking can be recalculated from stored aggregates without reading room history

Current implementation note:
- Host queue review now calls `resolveSongCatalog` for unresolved requests and caches returned canonical backing candidates per request.
- Those canonical candidates feed into `rankSongRequestCandidates` before live YouTube auto-search, so strong known backings can be queued, saved, or trusted through the existing review actions.
- `canonical_backing` is now a first-class ranking layer: stronger than generic catalog matches, still below explicit host favorites.
- Curated YouTube index promotion now also writes canonical backing candidate docs when an index entry already has a canonical song ID and verified embeddable YouTube video ID.
- Host review preference saves preserve verified YouTube playback fields into the index entry, so a normal `good track` action can feed canonical ranking without another host step.
- YouTube index entries now preserve `sourceDiscovery` provenance such as `host_feedback`, `host_search`, `host_paste`, and `playlist_index`, and canonical candidate promotion carries that provenance forward.
- This means host-approved indexed tracks can become reusable ranked options before explicit up/down feedback is left, while unanchored, unverified, or non-embeddable entries are skipped.

## Compliance And Privacy Notes

Apple Music:
- host must explicitly connect Apple Music
- show library/personalized content only to the connected host session
- avoid storing full libraries or long-lived user tokens
- provide disconnect behavior that clears active playback state and local session auth

YouTube:
- continue to avoid downloading YouTube media
- continue to prefer embedded playback and embeddability checks
- keep Google Cloud quota screenshots as the authoritative quota source for audit work

## Open Questions

1. Can all user-library playlists be played directly by MusicKit on the web, or do some require resolving track entries first?
2. Which personalized Apple Music resources are stable enough to show in production: heavy rotation, recommendations, recently played, or only library playlists?
3. Are there playlist types that cannot be shown or played because of regional availability, subscription state, explicit-content settings, or DRM restrictions?
4. Should the selected Apple BG playlist be saved per host account, per room, or both? Current direction: both, with room overriding account default.
5. Should audience members ever connect Apple Music? Current direction: no; keep Apple Music host-owned for now.

## Acceptance Criteria For This Slice

- Host can connect Apple Music once and browse useful personal playlist choices.
- Host can set an Apple playlist as background music with one obvious action.
- The existing BG button remains the single runtime start/stop control.
- TV shows Apple background playback clearly when it is active.
- YouTube search remains available for karaoke backings, but cached/indexed results are preferred before live quota spend.
- The YouTube quota-extension story improves because the app can show concrete alternatives, cache reuse, and low-cost refresh behavior.
- Canonical Apple/iTunes song IDs can accumulate ranked YouTube backing options with host/co-host/audience telemetry.

## Reference Links

- Apple Music API: Get All Library Playlists: https://developer.apple.com/documentation/applemusicapi/get-all-library-playlists
- Apple Music API: Get a Library Playlist: https://developer.apple.com/documentation/applemusicapi/get-a-library-playlist
- Apple Music API: Get Heavy Rotation Content: https://developer.apple.com/documentation/applemusicapi/get-heavy-rotation-content
- MusicKit on the Web: https://js-cdn.music.apple.com/musickit/v3/docs/index.html
- Existing YouTube catalog strategy: docs/reviews/2026-05-10-youtube-catalog-middle-ground.md
- Existing YouTube audit draft: docs/compliance/YOUTUBE_AUDIT_SUBMISSION_DRAFT.md
