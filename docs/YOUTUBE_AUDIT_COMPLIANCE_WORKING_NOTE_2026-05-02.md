# YouTube Audit Compliance Working Note

Last updated: 2026-05-02

## Purpose

Capture the current state of YouTube audit/quota readiness work without forcing immediate legal drafting decisions. This note parks the legal discussion, records what is already known, and keeps the active engineering thread focused on YouTube API quota and compliance.

## What We Know Today

- The app uses the YouTube Data API for karaoke backing-track search and related playability checks.
- The default YouTube Data API quota is `10,000 units/day`.
- `search.list` costs `100` quota units per call.
- Additional quota requires a compliance audit before quota extension approval.
- The repo already contains meaningful quota mitigation:
  - server-side cache for YouTube search
  - durable Firestore-backed search cache
  - server-side quota backoff
  - client-side cache and local cooldown
  - host-facing telemetry for recent search behavior
- The app appears to use non-authorized YouTube API flows rather than user-authorized YouTube OAuth flows.
- The room-level `ytIndex` is currently persisted in Firestore and is the main YouTube data-retention risk.

## Current Repo Reality

- `TERMS.md` exists but is still draft-level and not audit-ready.
- The in-app `/karaoke/terms` route is placeholder-grade and not a production compliance surface.
- No repo-level Privacy Policy artifact was found.
- No clear user-facing delete-my-data flow was found.
- Room purge/delete currently appears incomplete for `host_libraries/{roomCode}` cleanup.
- Internal YouTube usage metering currently looks like request-count tracking, not true YouTube quota-unit tracking.

## Legal Questions Parked For Now

These are real issues, but they do not need to dominate the current engineering thread:

- Final legal entity / business identity naming
- Correct support/contact email and domain
- Final Terms wording
- Final Privacy Policy wording
- Whether user deletion should be self-serve in-product, support-ticket based, or both

## Viable Legal Surface Options

### Option A: In-App Legal Pages

Add production-ready `/karaoke/terms`, `/karaoke/privacy`, and `/karaoke/data-deletion` routes inside the existing app shell.

Why choose it:
- Smallest architecture change
- Keeps links stable across host and singer surfaces
- Fastest way to become audit-submittable

Main downside:
- Legal copy still has to be maintained in app code or bundled markdown/content

### Option B: Marketing-Site Legal Pages

Host Terms, Privacy, and deletion instructions on the marketing domain and link to them from app surfaces.

Why choose it:
- Cleaner public/legal presentation
- Easier for non-engineering edits later
- Stronger long-term separation between product UI and legal content

Main downside:
- Slightly more routing/content coordination
- Must ensure the pages are always accessible from the actual API client surfaces

### Option C: Hybrid

Use marketing-hosted canonical legal pages, but keep lightweight in-app routes that deep-link or mirror them.

Why choose it:
- Strong public/legal surface
- Minimal breakage risk for existing in-app links
- Reasonable migration path

Main downside:
- Two places to keep aligned if mirroring content

## Active YouTube Audit Compliance Thread

This is the work that should stay active now:

1. Correct quota accounting and audit evidence
   - distinguish internal request counts from true YouTube quota units
   - treat `search.list` as `100` units in reporting or clearly label existing meters as request counts only

2. Fix YouTube data retention for `ytIndex`
   - add bounded retention
   - add refresh/delete rules
   - remove expired room-level YouTube metadata

3. Make deletion defensible
   - ensure room delete also clears `host_libraries/{roomCode}`
   - define how a user or operator can request removal of app-held personal data

4. Prepare audit-facing documentation
   - use-case summary
   - API method inventory
   - data lifecycle summary
   - screenshot list

## Recommended `ytIndex` Direction

Keep the current architecture, but treat `ytIndex` as a temporary room-scoped cache instead of a permanent YouTube library.

Recommended shape:
- keep only fields needed for room reuse and playback checks
- add `lastValidatedAtMs`
- add `expiresAtMs`
- prune expired entries on read and write
- cap entry count per room
- delete the entire room library doc when the room is permanently deleted

This is the lowest-disruption path that best matches YouTube’s storage expectations for non-authorized API data.

## Suggested Next Technical Steps

1. Make `ytIndex` retention explicit in code.
2. Include `host_libraries/{roomCode}` in room purge/permanent delete.
3. Correct or relabel YouTube usage metering so audit evidence is honest.
4. Write a short YouTube data lifecycle doc for the audit packet.
5. Return to legal drafting only after the storage/deletion/quota story is technically defensible.

## Working Position

Do not block YouTube audit-compliance engineering on final legal prose. Do block audit submission on unresolved legal/public-page gaps.
