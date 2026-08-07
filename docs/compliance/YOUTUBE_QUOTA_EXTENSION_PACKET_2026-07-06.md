# YouTube Quota Extension Packet

Originally assembled: 2026-07-06
Last reviewed: 2026-08-07
Status: The evidence set remains anchored to Hosting release `1784078708909000` (version `5bc48c15cd873eac`). The current production application is deployed from commit `4a9030a` (2026-08-06), and the documented YouTube methods, legal routes, Room Library Curator, quota controls, and retention behavior remain present. Authenticated quota, controlled cooldown, permanent-delete, request-sizing, and all current-form address-bar evidence are captured. The room-deletion evidence remains tied to its original 2026-07-13 production checkpoint. Technical preflight passed again on 2026-08-07; only final business/contact/request approval, factual upcoming-event details, and owner submission remain.

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

The official quota/compliance guide was revalidated on 2026-07-13 against the June 2026 granular-quota model. Projects receive default allocations of 100 `search.list` calls per day, 100 `videos.insert` calls per day, and 10,000 units per day combined for other endpoints. `search.list` consumes 1 unit from its dedicated Search Queries bucket per call. Additional quota still requires an audit demonstrating compliance with the YouTube API Services Terms.

Authenticated project evidence confirms the live assignment is `100 Search Queries/day` and `10,000` general-data units/day.

Official current references:

- Quota and compliance audits, last updated 2026-06-01: https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits
- `search.list`, including the dedicated quota impact: https://developers.google.com/youtube/v3/docs/search/list
- June 2026 granular-quota revision: https://developers.google.com/youtube/v3/revision_history

Do not infer the live project's assigned limits from these defaults. The Google Cloud Console quota page remains the source of truth and its screenshot is still a submission blocker.

## 2026-07-13 Event-Scale Operating Posture

The production event-readiness pass proved that BeauRocks can continue a night with Host-owned uploads and an explicit Apple connection boundary while YouTube remains a catalog/backing option. This reduces the operational pressure to treat every song request as a live YouTube search.

Compliant behavior when the `search.list` bucket is low or exhausted:

- prefer verified canonical-song backing candidates, curated indexes, account indexes, and recent compliant cache entries before live search;
- revalidate known video IDs through bounded lower-cost metadata paths where required rather than repeating discovery searches;
- keep non-embeddable or unknown tracks out of TV-ready ranking;
- allow direct host-provided URLs only through the existing validation/embeddability path;
- offer Host uploads, BeauRocks/local files, Apple capability flows, and provider-neutral external handoff where appropriate;
- stop live search during cooldown and disclose the reduced catalog honestly;
- never scrape YouTube search/results, download media, rotate API projects or keys to evade quota, or represent unverified results as an available in-app catalog.

The quota-extension request should include measured peak-event search demand, cache/index hit rate, live-search share, embeddable acceptance rate, exhausted/cooldown behavior, and the requested Search Queries allocation. Requesting more quota and reducing avoidable live calls are complementary controls.

## Deployed Event-Readiness Evidence

Hosting release `3098b4aa26e1003d` introduced `Tonight's media preflight` inside the Host Room Library Curator. The captured evidence is anchored to release `1784078708909000` (version `5bc48c15cd873eac`), and the behavior remains present in current production app commit `4a9030a`. The preflight combines known embeddable catalog coverage, room-proven fresh backings, content-agnostic fallback availability, and this Host browser's estimated Search Queries reserve. It limits guidance to three next moves and states that Google Cloud Quotas is the source of truth for assigned limits.

Authenticated production acceptance observed 115 known embeddable tracks, 14 content-agnostic fallbacks, an estimated 100-search browser reserve, and 0 of the 3 targeted room-proven fresh backings. The product therefore reported `Ready with Watchouts` and asked the Host to use or approve three more room backings. These browser estimates are not submitted as evidence of the project's assigned Google quota.

The product evidence capture fails if the Audio popover obscures Admin. The production Admin smoke also proves normal curator open/Back navigation and continued Chat/Approvals navigation, preventing a screenshot-only pass over an unusable workflow.

Default granular limits are configurable through `VITE_YOUTUBE_DAILY_SEARCH_LIST_CALL_LIMIT` and `VITE_YOUTUBE_DAILY_GENERAL_DATA_UNIT_LIMIT`. Production should set those values only to allocations verified in Google Cloud; absent configuration, the client labels the June 2026 defaults as `official_default`.
## Product Use Of YouTube API Services

Current commercial posture: BeauRocks is onboarding a limited, selectively approved Host testing cohort. Applying is free; approved testing access is complimentary while an invitation is active; no card or subscription is started; and there are no automatic charges. Paid Host plans are not currently available. Any future paid Host access will present pricing and terms and require explicit opt-in. YouTube content itself is not sold.

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
- `nightlyYouTubeCatalogEnrichment` is a separate 23:35 Pacific demand-driven worker. It uses the server-wide daily method ledger, skips active rooms, preserves at least 20 calls or 25% of the daily Search Queries allocation for live use, and searches only first-party-demand canonical songs lacking a fresh candidate.
- Nightly discoveries require strong title/artist and karaoke-intent matching plus `videos.list` playability and embeddability validation. Stored metadata receives a 29-day verification lease, and daily maintenance deletes expired documents before the 30-day boundary; no audiovisual content is downloaded or cached.
- `tests/unit/youtubeDailyCatalog.test.mjs` covers daily budget boundaries, Pacific reset dates, strict candidate selection, and candidate freshness.

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

## Submission Screenshot Status

Required presentation screenshots:

- all five address-bar captures listed in `docs/compliance/evidence/2026-07-15-youtube-form/README.md` are complete and reviewed
- `quota-exhaustion-fallback.png` (captured)
- `room-permanent-delete-confirmation.png` and `room-permanent-delete-success.png` (captured)
- authenticated production host session for the live audit room, if reviewers request live-room evidence beyond the QA product-surface packet

Use `docs/compliance/YOUTUBE_LIVE_EVIDENCE_RUNBOOK_2026-07-06.md` for exact capture steps and filenames.

Optional but useful screenshots:

- top-chrome YouTube budget indicator
- Room Library Curator showing indexed/fresh/proven counts
- host review flow showing `Known backing` suggestions


Live permanent-delete evidence, hashes, and independent absence checks are documented in `docs/compliance/evidence/2026-07-06-youtube-live-evidence/room-permanent-delete-evidence.md`.

## Proposed Search Queries Request

Proposed allocation: `5,000 Search Queries calls/day` with a `120 calls/minute` peak.

Observed production baseline from the server usage ledger for period `202607`, read on 2026-07-14:

- `27` actual `search.list` calls
- `26` actual `videos.list` calls
- `94` total metered YouTube Data API method calls
- `13` rooms represented in the meter
- `17` total YouTube method calls for the highest recorded single room

This ledger was introduced recently and provides monthly aggregate evidence, not a complete historical peak-event trace. The established five-hour, 150-person event model supplies the capacity envelope: approximately `120` low-, `300` medium-, and `750` high-engagement live searches per event. Requesting `5,000/day` supports five same-day high-engagement event-equivalents (`3,750` calls) plus `1,250` calls of reserve, or approximately 13 medium-engagement events with contingency. The `120/minute` peak supports four short room/actor bursts at the enforced `30/minute` callable limit while staying below the global `600/minute` safety ceiling. Indexed, canonical, and cached reuse continue reducing live demand, and measured adoption should justify any later increase.

The increase applies to the separate Search Queries bucket. At full requested search usage, an approximately one-to-one paired `videos.list` validation pattern would consume about `5,000` of the assigned `10,000` general-data units, leaving capacity for playlist inspection, known-ID refresh, and other low-cost detail calls.

## Remaining Submission Blockers

No known code blocker remains for the quota-mitigation story.

Submission still requires:

- authenticated live-room product screenshots only if reviewers require evidence beyond the captured QA product-surface packet
- confirmation of final business/contact details
- confirmation that `5,000 Search Queries/day` with a `120/minute` peak is the approved request amount
- final read-through to ensure the submitted narrative matches deployed behavior

## Recommended Submission Sequence

1. Confirm final business/contact details and approve the proposed `5,000 Search Queries/day` request with a `120/minute` peak.
2. Follow `docs/compliance/YOUTUBE_QUOTA_OWNER_ACTION_GUIDE_2026-07-19.md` and run the strict preflight.
3. Review this packet against deployed behavior.
4. Submit the YouTube API Services Audit and Quota Extension Form.
