# YouTube Data Lifecycle

Last updated: 2026-07-06

## Scope

This document describes how BeauRocks Karaoke uses and stores YouTube API data for karaoke backing-track search and playback support.

## Current YouTube API Use Cases

- Search for karaoke backing tracks from the host and singer surfaces
- Verify whether a known YouTube video is embeddable/playable
- Inspect playlist items when a host indexes a YouTube playlist
- Refresh previously indexed room-level YouTube entries by known `videoId`
- Reuse verified canonical backing candidates before spending live search quota

## API Methods In Use

- `search.list`
  - used for live YouTube search
  - scarce live-search bucket
- `videos.list`
  - used for status/playability checks
  - used for duration/details checks
  - used for stale indexed-entry refresh by `videoId`
- `playlistItems.list`
  - used for playlist indexing

## Data Categories

### Temporary search cache

Used to reduce repeated live YouTube searches.

Stored fields may include:
- query-derived cache key
- video ID
- title
- channel title
- thumbnail data
- playability metadata

Storage locations:
- in-memory function cache
- Firestore durable cache for repeated query reuse
- short-lived browser cache

Retention:
- browser cache: short-lived
- function memory cache: short-lived
- durable Firestore search cache: time-bounded and expires automatically by timestamp checks in app logic

Purpose:
- reduce repeated `search.list` calls
- reduce quota burn
- improve latency


### Canonical backing candidates

Used to avoid repeated live search for songs that already have verified embeddable backing tracks.

Stored fields may include:
- canonical song ID
- backing candidate ID
- YouTube video ID
- title and channel/artist text
- thumbnail URL
- embeddability/playability metadata
- source-discovery provenance such as `host_feedback`, `host_search`, `host_paste`, `playlist_index`, or `idle_refresh`
- aggregate feedback telemetry such as host up/down votes and completion/skip counts

Storage location:
- `songs/{songId}/backing_candidates/{candidateId}`

Promotion rules:
- only entries with a canonical song ID are eligible
- only explicitly playable and embeddable YouTube entries are eligible
- non-embeddable, unknown-playback, private, blocked, or unanchored entries are skipped

Purpose:
- rank known good backing tracks for a canonical song
- reduce repeated `search.list` calls
- let normal host actions improve future suggestions without adding host controls

### Room-level YouTube index (`ytIndex`)

Used as a room-scoped temporary cache of previously selected YouTube backing tracks.

Stored fields may include:
- `videoId`
- `trackName`
- `artistName`
- `artworkUrl100`
- `url`
- `playable`
- `embeddable`
- `uploadStatus`
- `privacyStatus`
- `youtubePlaybackStatus`
- `backingAudioOnly`
- `qualityScore`
- `usageCount`
- `successCount`
- `failureCount`
- `curatedAtMs`
- `lastValidatedAtMs`
- `expiresAtMs`
- `addedBy`

Storage location:
- `artifacts/{APP_ID}/public/data/host_libraries/{roomCode}.ytIndex`

Retention policy:
- `ytIndex` is treated as temporary room-scoped non-authorized YouTube API data
- entries are retained for up to 30 calendar days from `lastValidatedAtMs`
- stale entries are refreshed by `videoId` using `videos.list` when possible
- expired or no-longer-usable entries are pruned

Refresh behavior:
- entries near expiry may be refreshed when the room loads
- refresh uses known `videoId` and does not require the host to repeat a text search
- deleted/private/unusable items are removed instead of retained indefinitely

Dormant-room cleanup:
- a nightly scheduled cleanup prunes expired `ytIndex` entries from stored room host libraries
- the same job can refresh stale high-value entries by `videoId` with `videos.list`
- the same job can backfill a bounded set of verified embeddable indexed tracks into canonical backing candidates without live search

## Deletion Behavior

### Permanent room delete

When a room is permanently deleted:
- room-scoped content collections are purged
- the room document is deleted
- `host_libraries/{roomCode}` is also deleted

### Normal room cleanup

Normal room cleanup/reset does not automatically delete the entire `host_libraries` document because that document may also contain other room-scoped non-YouTube settings such as branding libraries.

## User Authorization Model

Current YouTube flows are non-authorized/public-data flows.

The application currently:
- does not request YouTube OAuth access from end users for these flows
- does not act on behalf of a user's YouTube channel
- does not upload, edit, or delete YouTube content on a user's behalf

## Compliance Position

The intended compliance posture is:
- minimize `search.list` usage through caching
- prefer cheap `videos.list` refreshes for known IDs
- avoid indefinite storage of room-level YouTube metadata
- make deletion and retention behavior explicit and defensible during audit
- preserve source-discovery provenance so ranking/audit explanations can distinguish host feedback, host search, pasted URLs, playlist indexing, and idle refresh

## Evidence To Pair With This Doc

- screenshots of host YouTube search flow
- screenshots of quota exhaustion fallback messaging
- screenshots of room delete flow
- Google Cloud Quotas page screenshot for official YouTube quota usage
