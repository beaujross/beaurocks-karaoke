# YouTube Event-Scale Readiness Closure

Date: 2026-07-13
Production Hosting release: `3098b4aa26e1003d`
Status: Closed and production-accepted

## Outcome

The Host can now evaluate YouTube-backed event readiness from one low-noise preflight inside Screens + Playback. The preflight combines known embeddable catalog coverage, room-proven backing coverage, content-agnostic fallback availability, and the estimated remaining Search Queries reserve. It gives no more than three next moves and explicitly says that Google Cloud Quotas is the source of truth for assigned limits.

This preserves the product position: BeauRocks is a content-agnostic at-home party game. YouTube remains one embeddable backing source, Host uploads and offline files remain a first-class event fallback, Apple remains behind an explicit connection/capability boundary, and Spotify remains discovery or external handoff rather than implied in-app playback.

## Changes Accepted

- Added `buildYouTubeEventReadiness` with bounded thresholds for known catalog, room-proven backings, content-agnostic fallbacks, healthy reserve, critical reserve, and live-heavy search behavior.
- Consolidated existing telemetry and indexes into one Host decision surface instead of adding another settings system.
- Kept live `search.list` as the scarce fallback after curated, indexed, canonical, and cached reuse.
- Made the default June 2026 granular limits configurable through `VITE_YOUTUBE_DAILY_SEARCH_LIST_CALL_LIMIT` and `VITE_YOUTUBE_DAILY_GENERAL_DATA_UNIT_LIMIT`, so an approved Google allocation can be reflected without a code edit.
- Added deterministic product evidence for the preflight and a guard that fails the capture if the Audio popover obscures Admin.
- Closed the tall-desktop Audio popover when entering Admin or Run of Show.
- Raised the full-screen Admin workspace above persistent Host chrome so curator navigation cannot be intercepted.
- Extended the authenticated production Admin smoke to open Screens + Playback, enter the Room Library Curator, verify the preflight and quota disclosure, return through Back, and continue to Chat and Approvals.

## Production Observation

The accepted production Host room reported:

- 115 known embeddable tracks against the 25-track readiness threshold;
- 0 room-proven fresh backings against the 3-track target;
- 14 content-agnostic fallbacks against the 1-source minimum;
- an estimated 100 Search Queries calls remaining in the current Host browser against the 30-call healthy threshold;
- overall state: `Ready with Watchouts`, with one next move to prove or approve three room backings.

These values are operational browser estimates, not a claim about the live Google Cloud project's assigned quota.

## Persona Review

- CTO: quota assumptions are configurable, source-of-truth copy is explicit, reuse precedes live discovery, and no scraping, downloading, or multi-project circumvention was introduced.
- Chief Product Officer: four checks answer one question - whether tonight has sufficient catalog, proven backings, fallback media, and search reserve - with at most three actions.
- Chief Marketing Officer: provider language remains capability-accurate and supports the content-agnostic party-game position.
- Host/co-host: the preflight is inside the existing Room Library Curator and no persistent chrome blocks the workflow.
- Audience/TV viewer: only validated embeddable YouTube backings are represented as in-app playback candidates; alternative-source capability is not overstated.

## Verification

- Full Vitest regression: 275 files, 970 tests, all passing.
- Firestore and Storage rules suite: passing.
- Complete callable integration matrix: passing, including media-catalog canonicalization and BeauBucks contracts.
- Full ESLint error gate: zero errors; established Host warnings unchanged.
- Production Vite build and `git diff --check`: passing.
- Deterministic YouTube product evidence capture: passing with the Audio-overlay absence guard.
- Authenticated production persona path: all 7 Host/Singer/TV/game/recap/End Mode checks passing.
- Authenticated production Admin smoke: preflight, Back, Chat, and Approvals all passing against release `3098b4aa26e1003d`.

## Evidence

- Product screenshots and hashes: `docs/compliance/evidence/2026-07-06-youtube-product-audit/`
- Compliance narrative: `docs/compliance/YOUTUBE_QUOTA_EXTENSION_PACKET_2026-07-06.md`
- Parent program roadmap: `docs/reviews/2026-07-11-original-plan-program-roadmap.md`

## Next Bounded Slice

Close the quota-submission evidence gap without adding another provider or economy schema:

1. capture the live Google Cloud YouTube quota page and assigned Search Queries limit;
2. capture a controlled quota-exhaustion/cooldown state proving degraded known-catalog and content-agnostic fallback behavior;
3. capture the live room permanent-delete path;
4. add final business/contact details and reconcile the requested Search Queries allocation with measured peak-event demand;
5. submit only after the packet is checked against the deployed release.

Definition of done: the audit packet contains live assigned-quota evidence, controlled exhaustion behavior, deletion evidence, final contacts, and a requested allocation grounded in measured event demand. No scraping, YouTube media download, provider-key rotation, or unlicensed catalog claim is introduced.
## Evidence Follow-On

The evidence follow-on captured authenticated Google Cloud Quotas API limits, a controlled production cooldown state, and the disposable-room permanent-delete path on Hosting release `ac2b07c988fe1f57`. Production ledger evidence and the 150-person event envelope now support a proposed `1,000 Search Queries/day` request. Remaining submission work is the Google Cloud Console presentation screenshot, final business/contact confirmation, request-amount approval, and one deployed-behavior read-through.
