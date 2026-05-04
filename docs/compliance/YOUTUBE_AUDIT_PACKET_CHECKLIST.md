# YouTube Audit Packet Checklist

Last updated: 2026-05-02

## Goal

Prepare a clean, credible packet for a YouTube Data API compliance audit and quota-extension request.

## Submission Narrative

Be prepared to explain the app in simple terms:

- BeauRocks Karaoke is a live karaoke web application with host, singer, and TV surfaces.
- The app uses YouTube Data API methods to find karaoke backing tracks and to verify whether known tracks are playable/embeddable.
- The app does not download YouTube videos or audio.
- The app does not use multiple API projects to avoid quota limits.
- The app reduces quota burn through caching, cooldowns, and ID-based refresh of known tracks.
- The app stores room-scoped YouTube metadata only temporarily and prunes or refreshes it within the retention window.

## Public URLs To Have Ready

- Terms of Service: `https://beaurocks.app/karaoke/terms`
- Privacy Policy: `https://beaurocks.app/karaoke/privacy`
- Data deletion / data removal instructions: `https://beaurocks.app/karaoke/data-deletion`

These should be publicly reachable without requiring login.

## Screenshots To Capture

- host YouTube search surface
- singer or audience YouTube-backed search/request surface
- disclosure surface showing Terms / Privacy links
- quota exhaustion fallback messaging
- room permanent-delete path
- any host-side indexed-track management UI that helps explain the `ytIndex` lifecycle

## Technical Evidence To Prepare

- Google Cloud Quotas page screenshot
- list of YouTube Data API methods currently used
- explanation of `search.list` cost versus `videos.list` cost
- explanation of server-side and client-side caching
- explanation of room-level `ytIndex` retention and refresh behavior
- explanation that known stale tracks refresh by `videoId` instead of forcing new text searches

## Important Method/Cost Summary

- default YouTube Data API quota: `10,000 units/day`
- `search.list`: `100` quota units per call
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
- We refresh known stale tracks by `videoId` to avoid unnecessary high-cost search calls.
- We retain room-scoped YouTube metadata temporarily and prune it on expiry or room deletion.

## Repo References

- `functions/index.js`
- `src/lib/youtubeSearchClient.js`
- `src/apps/Host/HostApp.jsx`
- `docs/compliance/YOUTUBE_DATA_LIFECYCLE.md`
