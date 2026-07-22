# YouTube Audit Packet Checklist

Last updated: 2026-07-19

## Goal

Prepare a clean, credible packet for a YouTube Data API compliance audit and quota-extension request.

## Submission Narrative

Be prepared to explain the app in simple terms:

- BeauRocks Karaoke is a live karaoke web application with host, singer, and TV surfaces.
- The app uses YouTube Data API methods to find karaoke backing tracks and to verify whether known tracks are playable/embeddable.
- The app does not download YouTube videos or audio.
- The app does not use multiple API projects to avoid quota limits.
- The app reduces quota burn through caching, cooldowns, indexed-track reuse, ID-based refresh of known tracks, and quota-aware maintenance.
- The app stores room-scoped YouTube metadata only temporarily and prunes or refreshes it within the retention window.
- Verified embeddable indexed tracks can become reusable canonical backing candidates, but unverified or non-embeddable entries are skipped.

## Public URLs To Have Ready

- Terms of Service: `https://beaurocks.app/karaoke/terms`
- Privacy Policy: `https://beaurocks.app/karaoke/privacy`
- Data deletion / data removal instructions: `https://beaurocks.app/karaoke/data-deletion`

Verified HTTP 200 without login on 2026-07-06. Desktop and mobile screenshots are captured in `docs/compliance/evidence/2026-07-06-youtube-audit/`; QA product-surface screenshots are captured in `docs/compliance/evidence/2026-07-06-youtube-product-audit/`.

## Captured Evidence

- public Terms page, desktop and mobile
- public Privacy page, desktop and mobile
- public data-deletion page, desktop and mobile
- host YouTube add/search panel showing karaoke/general YouTube modes
- Host Room Library Curator showing YouTube API Services disclosure, Terms, Privacy, and catalog health context
- audience YouTube-backed search surface showing disclosure and mode controls
- audience YouTube URL-paste flow
- public TV YouTube performance playback surface
- public TV Apple Music background playback surface
- rendered legal-page manifest: `docs/compliance/evidence/2026-07-06-youtube-audit/manifest.json`
- rendered product-surface manifest: `docs/compliance/evidence/2026-07-06-youtube-product-audit/manifest.json`
- authenticated Quotas API evidence for the live project (`100` Search Queries/day and `10,000` general units/day)
- controlled production cooldown screenshot and evidence note
- live disposable-room permanent-delete confirmation, success, hashes, and independent absence checks

## Screenshot Status

- all five required current-form address-bar captures are complete and reviewed in `docs/compliance/evidence/2026-07-15-youtube-form/`
- the supplemental general-quota and Host Curator captures are also complete
- an authenticated live-room host screenshot is optional only if a reviewer requests evidence beyond the QA product-surface packet

Use `docs/compliance/YOUTUBE_LIVE_EVIDENCE_RUNBOOK_2026-07-06.md` for exact capture steps and filenames.

## Technical Evidence To Prepare

- current-form Cloud quota, Privacy, policy-link context, Terms, and player/embed captures
- list of YouTube Data API methods currently used
- explanation of the separate `search.list` bucket and the lower-cost `videos.list` refresh path
- explanation of server-side and client-side caching
- explanation of room-level `ytIndex` retention and refresh behavior
- explanation that known stale tracks refresh by `videoId` instead of forcing new text searches
- explanation of canonical backing candidate storage and host-feedback/source-discovery telemetry
- emulator test evidence for `upsertCuratedYouTubeIndexes` canonical candidate persistence
- production usage-ledger baseline and the request-sizing calculation

## Search Queries Request Sizing

Proposed request: `5,000 Search Queries calls/day` with a `120 calls/minute` peak. The owner action guide is `docs/compliance/YOUTUBE_QUOTA_OWNER_ACTION_GUIDE_2026-07-19.md`.

Observed production baseline from the server usage ledger for period `202607`, read on 2026-07-14:

- `27` actual `search.list` calls
- `26` actual `videos.list` calls
- `94` total metered YouTube Data API method calls across all recorded sources
- `13` rooms represented in the meter
- `17` total YouTube method calls for the highest recorded single room

The server meter was introduced recently and is monthly aggregate evidence, so it is not presented as a historical peak-event trace. The established five-hour, 150-person planning envelope in `docs/costs/GAME_MODE_COST_SHEET.md` models `120`, `300`, and `750` live searches for low, medium, and high engagement. A `5,000/day` request supports five same-day high-engagement event-equivalents (`3,750` calls) plus `1,250` calls of reserve, or approximately 13 medium-engagement events with contingency. The `120/minute` peak supports four short room/actor bursts at the enforced `30/minute` limit while staying below the global `600/minute` safety ceiling. The product continues to reduce live demand through indexed, canonical, and cached reuse.

The request is for the separate Search Queries bucket. At full requested search usage, an approximately one-to-one paired `videos.list` validation pattern would use about `5,000` of the assigned `10,000` general-data units, leaving capacity for playlist inspection, known-ID refresh, and other detail calls. Google Cloud Console remains the source of truth for assigned limits and final submission values.

## Important Method/Cost Summary

- default broader YouTube Data API quota: `10,000 units/day` for non-`search.list`/non-`videos.insert` endpoints; verify the live project in Google Cloud Console
- `search.list`: separate default daily bucket of `100` calls; each live call consumes `1` call from that bucket
- `videos.list`: `1` quota unit per call
- `playlistItems.list`: `1` quota unit per call

## Request-Count Meter Caveat

The repo currently includes an internal workspace meter labeled `YouTube Data API request count`.

Important:
- this meter tracks application request count for workspace ops/budgeting purposes
- it is not the source of truth for official Google YouTube quota consumption
- the Google Cloud Quotas page should be treated as the authoritative quota record during audit

## Data Handling Points To State Clearly

- non-authorized YouTube API data is cached temporarily
- room-scoped indexed YouTube entries are retained for up to 30 days unless refreshed sooner
- stale entries are refreshed by `videoId`
- expired/unusable entries are removed
- permanent room deletion removes the room host library as well

## Questions Reviewers Are Likely To Ask

- What exactly does the product do with YouTube data?
- Which API methods are used, and why?
- How does the app control quota usage?
- What YouTube data is stored, where, and for how long?
- How does a host or user get data removed?
- Does the app act on behalf of a user's YouTube account or channel?
- Does the app download or modify YouTube content?

## Short Answers To Keep Consistent

- We use YouTube Data API to find and validate karaoke backing tracks.
- We do not download YouTube media.
- We do not use multiple projects to bypass quota.
- We cache repeated searches and pause live search when quota is exhausted.
- We refresh known stale tracks by `videoId` to avoid unnecessary live search calls.
- We retain room-scoped YouTube metadata temporarily and prune it on expiry or room deletion.

## Repo References

- `functions/index.js`
- `functions/lib/backingCandidates.js`
- `functions/lib/youtubeIndexMaintenance.js`
- `src/lib/youtubeSearchClient.js`
- `src/lib/youtubeIndexMaintenance.js`
- `src/apps/Host/HostApp.jsx`
- `tests/integration/upsertCuratedYouTubeIndexesCallable.test.cjs`
- `tests/integration/recordTrackFeedbackCallable.test.cjs`
- `docs/compliance/YOUTUBE_DATA_LIFECYCLE.md`
- `docs/compliance/YOUTUBE_QUOTA_EXTENSION_PACKET_2026-07-06.md`
- `docs/compliance/YOUTUBE_LIVE_EVIDENCE_RUNBOOK_2026-07-06.md`


## Official References

Verified 2026-07-06:

- YouTube quota/compliance audit guide: https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits
- YouTube quota calculator: https://developers.google.com/youtube/v3/determine_quota_cost
- YouTube API Services Terms: https://developers.google.com/youtube/terms/api-services-terms-of-service
- YouTube Terms: https://www.youtube.com/t/terms
- Google Privacy Policy: https://policies.google.com/privacy
