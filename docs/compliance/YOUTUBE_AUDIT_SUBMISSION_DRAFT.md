# YouTube Audit Submission Draft

Last updated: 2026-05-02

## Status

This draft is intended to support a future YouTube Data API compliance audit and quota-extension request.

Do not submit yet if the following are still missing:
- deployed production Terms of Service URL
- deployed production Privacy Policy URL
- deployed production data deletion instructions URL
- final screenshots from the live product
- Google Cloud Console quota screenshots from the live project

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

> BeauRocks Karaoke is a live karaoke web application used by hosts and participants during events. We use the YouTube Data API to help hosts and participants find karaoke backing tracks and to verify that known tracks are playable and embeddable. We do not download YouTube media. We reduce high-cost search usage through client and server caching, temporary cooldowns when quota is exhausted, and by refreshing known stale tracks by `videoId` instead of forcing repeated full-text searches.

## API Methods and Why They Exist

### `search.list`

Purpose:
- live karaoke track discovery

Why it is needed:
- hosts and singers need to find candidate backing tracks by title/artist query

Cost:
- `100` quota units per call

Controls in place:
- short-lived client cache
- short-lived server cache
- durable cross-session query cache
- quota cooldown when exhausted

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

> We store temporary, room-scoped YouTube metadata needed to avoid repeated high-cost searches and to preserve recent host-curated karaoke tracks for the active room. This may include video ID, title, channel name, thumbnail URL, playability metadata, and timestamps. Room-level indexed entries are retained for up to 30 days from validation unless refreshed sooner, and expired or unusable entries are pruned. Permanent room deletion removes the associated room host library as well.

## Quota Management Answer

If asked how quota is controlled, use an answer like this:

> We treat `search.list` as the high-cost method and reduce it through client caching, server caching, durable repeated-query caching, and a quota exhaustion cooldown. When we already know a `videoId`, we prefer `videos.list` refreshes instead of forcing new full-text searches. This lowers repeated search demand and keeps known room tracks fresh at much lower quota cost.

## Deletion / Retention Answer

If asked how deletion works, use an answer like this:

> Room-scoped indexed YouTube metadata is temporary. Entries expire unless refreshed within the retention window. A nightly cleanup removes expired indexed entries from dormant rooms, and permanent room deletion removes the room host library document as well.

## Evidence Packet

Prepare the following before submission:

- public Terms URL: `https://beaurocks.app/karaoke/terms`
- public Privacy Policy URL: `https://beaurocks.app/karaoke/privacy`
- public data deletion URL: `https://beaurocks.app/karaoke/data-deletion`
- screenshots of host YouTube search
- screenshots of singer/audience YouTube search or request flow
- screenshot of the quota exhaustion fallback state
- screenshot of the host indexed-track view
- screenshot of the permanent room delete path
- Google Cloud Console screenshot of official YouTube quota usage

## Screenshot Runbook

### 1. Host YouTube search

Capture:
- the host search UI
- search results
- any indicator that only embeddable/playable items are preferred

Likely surface:
- `https://host.beaurocks.app/?mode=host...`

### 2. Singer / audience flow

Capture:
- singer search/request UI that can lead to YouTube-backed selection
- Terms / Privacy links if present

Likely surface:
- `https://app.beaurocks.app/?room=ROOMCODE`

### 3. Quota exhaustion fallback

Capture:
- UI state where live YouTube search is paused
- message directing the operator/user to indexed tracks or direct URL fallback

### 4. Room-level YouTube index

Capture:
- host indexed-track view
- any controls for adding/removing indexed tracks

### 5. Permanent delete

Capture:
- host room manager flow
- confirmation step

### 6. Legal pages

Capture:
- Terms page
- Privacy page
- data deletion instructions

Current note:
- the repo now contains production-grade legal routes, but the final audit packet should use deployed production URLs and screenshots from the live surface

## Repo References

- `functions/index.js`
- `functions/lib/entitlementsUsage.js`
- `src/lib/youtubeSearchClient.js`
- `src/apps/Host/HostApp.jsx`
- `docs/compliance/YOUTUBE_DATA_LIFECYCLE.md`
- `docs/compliance/YOUTUBE_AUDIT_PACKET_CHECKLIST.md`

## Remaining Submission Blockers

- legal pages still need to be deployed and verified on production URLs
- final business/contact details still need to be confirmed
- final audit screenshots have not been collected yet
- Google Cloud quota screenshots still need to be captured from the live project
