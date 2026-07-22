# YouTube Data Lifecycle

Last updated: 2026-07-19

## Scope

This document describes how BeauRocks Karaoke uses and stores YouTube API data for karaoke backing-track search and playback support.

## Current YouTube API Use Cases

- Search for karaoke backing tracks from the host and singer surfaces
- Verify whether a known YouTube video is embeddable/playable
- Inspect playlist items when a host indexes a YouTube playlist
- Refresh previously indexed room-level YouTube entries by known `videoId`
- Reuse verified canonical backing candidates before spending live search quota
- Near the end of the Pacific quota day, use a bounded portion of otherwise-unused `search.list` calls to find verified candidates for recently requested or performed canonical songs that do not have a fresh YouTube backing

## API Methods In Use

- `search.list`
  - used for live YouTube search
  - used by the demand-driven nightly catalog worker, only below a reserved live-event ceiling
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
- verification and expiration timestamps; new YouTube candidates receive a 29-day lease and are deleted by daily maintenance before the 30-day boundary unless refreshed
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
- build a bounded first-party-demand backup index without downloading or storing YouTube audiovisual content

### Nightly demand-driven enrichment

At `23:35` Pacific, `nightlyYouTubeCatalogEnrichment` may search for canonical songs surfaced by first-party performance and recent catalog activity. It:

- skips the run when a room has been active recently or shared quota status is blocked
- reads the project-wide daily method ledger before searching
- reserves at least 20 calls or 25% of the configured daily Search Queries allocation for live use
- uses at most 25 calls under the current 100-call allocation and at most 100 calls under larger allocations unless configured lower
- searches only songs without a fresh verified YouTube candidate
- requires a strong title/artist match, explicit karaoke/backing intent, and a playable embeddable `videos.list` result
- stores only IDs, metadata, canonical associations, provenance, and a 29-day verification lease
- deletes expired canonical YouTube candidate documents during daily maintenance
- never downloads, caches, or stores YouTube audio or video

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
