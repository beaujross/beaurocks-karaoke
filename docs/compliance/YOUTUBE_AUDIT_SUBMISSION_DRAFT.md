# YouTube Audit Submission Draft

Last updated: 2026-07-14

## Status

This draft supports the YouTube Data API compliance audit and quota-extension request. The current product behavior is deployed through Hosting release `1784078708909000` (version `5bc48c15cd873eac`); the production callable is active. The permanent-delete evidence was captured on the earlier production checkpoint and remains independently verified.

Do not submit yet if the following are still missing:
- Google Cloud Console quota presentation screenshot from the live project
- final business/contact confirmation
- final confirmation of the proposed `1,000 Search Queries/day` request


Controlled cooldown and permanent-delete evidence are complete. Authenticated Quotas API evidence and the production usage-ledger baseline are captured. The remaining hard evidence item is the Google Cloud Console presentation screenshot; business/contact and final request-amount confirmation remain open.

## Product Summary

BeauRocks Karaoke is a live karaoke web application with separate host, singer, and TV surfaces.

The product uses YouTube Data API methods to:
- search for karaoke backing tracks
- verify whether a known video is embeddable/playable
- inspect playlist items when a host indexes a playlist
- refresh previously indexed room tracks by known `videoId`

The product does not:
- download YouTube videos or audio
- use multiple API projects to avoid quota limits
- act on behalf of a user's YouTube account or channel for these flows
- upload, edit, or delete YouTube content on a user's behalf

## Suggested Reviewer-Facing Narrative

Use concise language like this:

> BeauRocks Karaoke is a live karaoke web application used by hosts and participants during events. We use the YouTube Data API to help hosts and participants find karaoke backing tracks and to verify that known tracks are playable and embeddable. We do not download YouTube media. We reduce scarce live-search usage through client and server caching, temporary cooldowns when quota is exhausted, indexed-track reuse, canonical backing candidate reuse, and by refreshing known stale tracks by `videoId` instead of forcing repeated full-text searches.

## API Methods and Why They Exist

### `search.list`

Purpose:
- live karaoke track discovery

Why it is needed:
- hosts and singers need to find candidate backing tracks by title/artist query

Cost:
- separate default daily bucket of `100` calls; each call costs `1` quota from that bucket

Controls in place:
- short-lived client cache
- short-lived server cache
- durable cross-session query cache
- quota cooldown when exhausted
- indexed and canonical backing reuse before live fallback

### `videos.list`

Purpose:
- verify embeddability/playability
- get duration/details
- refresh stale room-index entries by known `videoId`

Why it is needed:
- the app must avoid presenting unusable videos as playable backing tracks
- stale known entries should refresh cheaply without forcing a new text search

Cost:
- `1` quota unit per call

### `playlistItems.list`

Purpose:
- host playlist indexing

Why it is needed:
- hosts may preload a YouTube playlist into a room-scoped temporary library

Cost:
- `1` quota unit per call

## Data Storage Answer

If asked what YouTube data is stored, use an answer like this:

> We store temporary, room-scoped YouTube metadata needed to avoid repeated live YouTube searches and to preserve recent host-curated karaoke tracks for the active room. This may include video ID, title, channel name, thumbnail URL, playability metadata, source-discovery provenance, and timestamps. Room-level indexed entries are retained for up to 30 days from validation unless refreshed sooner, and expired or unusable entries are pruned. Verified embeddable tracks associated with a canonical song may also be stored as reusable backing candidates with host-feedback telemetry. Permanent room deletion removes the associated room host library as well.

## Quota Management Answer

If asked how quota is controlled, use an answer like this:

> We treat `search.list` as the scarce live-search method and reduce it through client caching, server caching, durable repeated-query caching, indexed backing reuse, canonical backing reuse, and a quota exhaustion cooldown. When we already know a `videoId`, we prefer `videos.list` refreshes instead of forcing new full-text searches. Nightly maintenance also backfills verified indexed tracks into canonical backing candidates without live search. This lowers repeated live-search demand and keeps known room tracks fresh with low-cost known-ID refreshes.

## Requested Search Queries Allocation

Proposed request: `1,000 Search Queries calls/day`.

The production server ledger for period `202607` records `27` actual `search.list` calls, `26` paired `videos.list` calls, `94` total metered YouTube Data API calls, `13` represented rooms, and `17` total method calls for the highest recorded single room. This recent monthly aggregate is an observed baseline, not a complete historical peak trace.

The established five-hour, 150-person event envelope models `120`, `300`, and `750` live searches at low, medium, and high engagement. The proposed `1,000/day` allocation covers the high envelope with roughly 33% contingency. It does not reduce the obligation to prefer indexed, canonical, cached, direct-URL, and content-agnostic paths before live search.

The paired validation load remains far below the assigned `10,000` general-data-unit limit. The requested increase applies to the separate Search Queries bucket.

## Deletion / Retention Answer

If asked how deletion works, use an answer like this:

> Room-scoped indexed YouTube metadata is temporary. Entries expire unless refreshed within the retention window. A nightly cleanup removes expired indexed entries from dormant rooms, and permanent room deletion removes the room host library document as well.

## Evidence Packet

Already captured:

- public Terms URL and screenshots: `https://beaurocks.app/karaoke/terms`
- public Privacy Policy URL and screenshots: `https://beaurocks.app/karaoke/privacy`
- public data deletion URL and screenshots: `https://beaurocks.app/karaoke/data-deletion`
- host YouTube add/search panel screenshot
- Host Room Library Curator screenshot with YouTube disclosure and catalog health context
- audience YouTube search screenshot
- audience YouTube URL-paste screenshot
- public TV YouTube performance screenshot
- public TV Apple Music background screenshot
- evidence manifests under `docs/compliance/evidence/2026-07-06-youtube-audit/` and `docs/compliance/evidence/2026-07-06-youtube-product-audit/`
- authenticated Quotas API assignment evidence
- controlled production cooldown screenshot and evidence note
- live room permanent-delete confirmation, success, hashes, and independent absence checks

Still required before submission:

- Google Cloud Console presentation screenshot for the live project
- final business/contact confirmation
- final confirmation of the proposed `1,000 Search Queries/day` request
- optional authenticated live-room host screenshot only if reviewers request proof beyond the captured packet

Use `docs/compliance/YOUTUBE_LIVE_EVIDENCE_RUNBOOK_2026-07-06.md` for the remaining live-only capture steps.

## Screenshot Runbook

The deterministic public-page and QA product screenshots are already captured. The remaining live-only capture checklist now lives in `docs/compliance/YOUTUBE_LIVE_EVIDENCE_RUNBOOK_2026-07-06.md`.

Minimum live evidence still needed:

- Google Cloud YouTube Data API quota page for the live project
- optional authenticated host screenshot only if reviewers ask for proof beyond the captured packet

Current note:
- public legal routes are deployed and verified
- QA product screenshots should be used to explain the host, audience, and TV surfaces without exposing private event data

## Repo References

- `functions/index.js`
- `functions/lib/entitlementsUsage.js`
- `functions/lib/backingCandidates.js`
- `functions/lib/youtubeIndexMaintenance.js`
- `src/lib/youtubeSearchClient.js`
- `src/apps/Host/HostApp.jsx`
- `docs/compliance/YOUTUBE_DATA_LIFECYCLE.md`
- `docs/compliance/YOUTUBE_AUDIT_PACKET_CHECKLIST.md`
- `docs/compliance/YOUTUBE_QUOTA_EXTENSION_PACKET_2026-07-06.md`
- `docs/compliance/YOUTUBE_LIVE_EVIDENCE_RUNBOOK_2026-07-06.md`

## Remaining Submission Blockers

- Google Cloud Console quota presentation screenshot
- final business/contact confirmation
- final confirmation of the proposed `1,000 Search Queries/day` request
- final audit narrative read-through completed against deployed release `1784078708909000` (version `5bc48c15cd873eac`)
