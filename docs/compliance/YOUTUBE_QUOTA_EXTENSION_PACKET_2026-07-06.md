# YouTube Quota Extension Packet

Date: 2026-07-06
Status: Production hosting deploy completed on 2026-07-06 15:49 UTC (2026-07-06 08:49 America/Los_Angeles). Firebase analyzed functions during the deploy and skipped them because no deployable function changes were detected. Public legal URLs verified HTTP 200 after deploy, desktop/mobile legal-page screenshots are captured, and QA product-surface screenshots are captured. Not ready to submit until live Google Cloud quota evidence, quota-exhaustion evidence, and final business/contact details are attached.

## Executive Summary

BeauRocks Karaoke is a live karaoke web application with host, singer/audience, and public TV surfaces. YouTube remains the primary source for karaoke backing tracks, but the product now reduces live YouTube Data API pressure by reusing known embeddable tracks before spending live search quota.

The quota-extension story is now technically stronger:

- live `search.list` is treated as the scarce fallback path
- repeated searches use client/server/durable cache layers first
- known YouTube IDs are refreshed with lower-cost `videos.list`
- room/account/global indexes reuse previously verified embeddable tracks
- canonical backing candidates preserve host feedback and source provenance
- maintenance pauses near event-time quota reserves and backfills verified catalog data without live search
- non-embeddable or unknown-playback tracks are blocked from canonical ranking promotion
- the app does not download YouTube videos or audio
- the app does not use YouTube OAuth for these public-data flows
- the app does not upload, edit, delete, or modify YouTube content

## Official Process Reference

Verified against official Google/YouTube docs on 2026-07-06:

- YouTube Data API quota/compliance audit guide: https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits
- YouTube Data API quota calculator: https://developers.google.com/youtube/v3/determine_quota_cost
- YouTube API Services Terms of Service: https://developers.google.com/youtube/terms/api-services-terms-of-service
- Google Privacy Policy: https://policies.google.com/privacy
- YouTube Terms: https://www.youtube.com/t/terms

The Google quota/compliance guide says additional quota requires completing an audit demonstrating compliance with YouTube API Services Terms. The current quota calculator shows that `search.list` has its own default daily bucket of 100 calls, while other YouTube Data API endpoints share the broader daily quota allocation.

## Product Use Of YouTube API Services

BeauRocks uses YouTube Data API for:

- karaoke backing-track discovery by host and audience search
- embeddability/playability checks before in-app playback
- host playlist indexing for room preparation
- stale known-ID refresh for indexed tracks
- low-cost maintenance of verified indexed catalog entries

BeauRocks does not use YouTube API Services to:

- download YouTube media
- alter YouTube media
- upload, edit, or delete videos
- act on behalf of a user's YouTube channel
- bypass quota with multiple API projects

## Quota Reduction Controls Now In Code

### Search Avoidance

Evidence:

- `src/lib/youtubeSearchClient.js` tracks quota exhaustion, cache hit rate, live call share, daily estimated quota units, and fresh searches left.
- Host queue and audience search prefer indexed and curated Browse matches before live YouTube fallback.
- `tests/unit/youtubeSearchCacheSource.test.mjs` asserts persisted Firestore cache is checked before live API calls.
- `tests/unit/curatedKaraokeIndexSource.test.mjs` asserts host and audience search reuse curated Browse/global/account indexes before live search.

### Embeddability And Playback Guardrails

Evidence:

- `src/lib/youtubePlaybackStatus.js` normalizes embeddability, upload status, privacy status, and playable state.
- `functions/lib/backingCandidates.js` only promotes canonical backing candidates when `playable === true` and `embeddable === true`.
- `tests/unit/backingCandidatesServer.test.mjs` asserts unanchored, unverified, and non-embeddable entries are skipped.
- Host and audience copy directs users away from non-embeddable in-app playback.

### Quota-Aware Maintenance

Evidence:

- `src/lib/youtubeIndexMaintenance.js` and `functions/lib/youtubeIndexMaintenance.js` plan bounded refreshes for stale known IDs.
- `nightlyYouTubeIndexCleanup` refreshes stale high-value IDs with `videos.list` when a YouTube key is configured.
- The nightly job also backfills verified indexed canonical tracks into `songs/{songId}/backing_candidates` without live YouTube search.
- Maintenance is bounded by library and candidate limits to prevent write/API spikes.
- `tests/unit/youtubeIndexMaintenanceServer.test.mjs` covers refresh planning, playable refresh application, dropping unplayable IDs, and bounded canonical backfill wiring.

### Canonical Backing Reuse

Evidence:

- `functions/lib/backingCandidates.js` stores ranked backing candidates under `songs/{songId}/backing_candidates/{candidateId}`.
- `recordTrackFeedback` writes append-only feedback events and aggregate backing candidate telemetry.
- `upsertCuratedYouTubeIndexes` can promote verified canonical index entries into reusable backing candidates.
- `tests/integration/upsertCuratedYouTubeIndexesCallable.test.cjs` proves account index, global index, and canonical candidate persistence in Firestore emulator.
- `tests/integration/recordTrackFeedbackCallable.test.cjs` proves feedback-driven canonical backing persistence.

### Host Simplicity

No extra host controls are required for this learning path. The app learns from existing host actions:

- approve/use a backing
- mark a track good or bad
- paste a YouTube URL
- index a playlist
- use a known backing suggested by the review flow

## Public Compliance Surfaces To Verify

Production URLs verified HTTP 200 on 2026-07-06 and again after the 2026-07-06 15:49 UTC hosting release:

- https://beaurocks.app/karaoke/terms
- https://beaurocks.app/karaoke/privacy
- https://beaurocks.app/karaoke/data-deletion

Repo surfaces:

- `src/App.jsx` includes Terms, Privacy, and Data Deletion routes.
- Host Room Library Curator includes YouTube Terms and Google Privacy links near YouTube search.
- App legal pages state that the app uses YouTube API Services and link to YouTube/Google policy pages.

## Captured Screenshot Evidence

Public legal-page screenshot evidence is captured under `docs/compliance/evidence/2026-07-06-youtube-audit/`.

Captured files:

- `desktop-terms.png`
- `desktop-privacy.png`
- `desktop-data-deletion.png`
- `mobile-terms.png`
- `mobile-privacy.png`
- `mobile-data-deletion.png`
- `manifest.json`

The capture script, `scripts/qa/youtube-audit-evidence-screenshots.mjs`, verifies each rendered page title and required YouTube/Google disclosure text before writing the screenshot.

Product-surface screenshot evidence is captured under `docs/compliance/evidence/2026-07-06-youtube-product-audit/`.

Captured files:

- `host-youtube-add-panel.png`
- `host-room-library-curator.png`
- `audience-youtube-search.png`
- `audience-youtube-url-paste.png`
- `tv-youtube-performance.png`
- `tv-apple-background.png`
- `manifest.json`

The capture script, `scripts/qa/youtube-audit-product-evidence-screenshots.mjs`, renders QA-only host, audience, and TV fixtures from the built app and asserts the expected YouTube/Google disclosure, search-mode, URL-paste, curator, and playback labels before writing the screenshots.

## Screenshots To Capture Before Submission

Required screenshots:

- Google Cloud Console YouTube Data API quota page for the live project
- quota exhaustion fallback state
- room permanent-delete path
- authenticated production host session for the live audit room, if reviewers request live-room evidence beyond the QA product-surface packet

Use `docs/compliance/YOUTUBE_LIVE_EVIDENCE_RUNBOOK_2026-07-06.md` for exact capture steps and filenames.

Optional but useful screenshots:

- top-chrome YouTube budget indicator
- Room Library Curator showing indexed/fresh/proven counts
- host review flow showing `Known backing` suggestions

## Remaining Submission Blockers

No known code blocker remains for the quota-mitigation story.

Submission still requires:

- Google Cloud Console quota screenshot from the live project
- quota exhaustion/cooldown evidence from a real exhausted state or controlled production test
- room permanent-delete evidence from a live test room
- authenticated live-room product screenshots only if reviewers require evidence beyond the captured QA product-surface packet
- confirmation of final business/contact details
- final read-through to ensure the submitted narrative matches deployed behavior

## Recommended Submission Sequence

1. Capture Google Cloud quota screenshots, quota exhaustion/cooldown evidence, and room permanent-delete evidence.
2. Confirm final business/contact details.
3. Review this packet against deployed behavior.
4. Submit the YouTube API Services Audit and Quota Extension Form.
