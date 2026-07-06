# YouTube Submission Blockers

Last updated: 2026-07-06

## Purpose

This document lists the remaining blockers between the current repo state and a credible YouTube Data API audit/quota-extension submission.

Use this as the go/no-go checklist.

## Current State

The repo now has the core YouTube compliance hardening in place:

- live YouTube search has cache, cooldown, and quota-backoff behavior
- room-level `ytIndex` now has temporary retention, ID-based refresh, nightly cleanup, permanent-delete cleanup, and bounded canonical candidate backfill
- public legal routes now exist in the app for:
  - `/karaoke/terms`
  - `/karaoke/privacy`
  - `/karaoke/data-deletion`
- singer and host YouTube surfaces now include `This application uses YouTube API Services` disclosure text
- the singer join flow now links to Terms, Privacy, and data-deletion pages
- the internal YouTube meter is now clearly labeled as request count rather than official Google quota usage
- canonical backing candidates now preserve embeddability, host feedback, and source-discovery provenance
- `test:callables:media-catalog` verifies account/global index writes and canonical backing candidate persistence in Firestore emulator
- production hosting was redeployed on 2026-07-06 15:49 UTC (2026-07-06 08:49 America/Los_Angeles); Firebase analyzed functions and skipped them because no deployable function changes were detected
- production legal URLs were verified HTTP 200 on 2026-07-06 and again after the 2026-07-06 15:49 UTC hosting release
- desktop and mobile legal-page screenshots were captured under `docs/compliance/evidence/2026-07-06-youtube-audit/`
- QA product-surface screenshots were captured under `docs/compliance/evidence/2026-07-06-youtube-product-audit/`

The remaining blockers are now live Google Cloud quota evidence, quota-exhaustion/cooldown evidence, room permanent-delete evidence, final business/contact confirmation, and final submission assembly. No known code blocker remains for the quota-mitigation story.

## Resolved: Public Legal Pages Are Deployed And Verified

Current repo state:

- [src/App.jsx](</C:/Users/beauj/Desktop/beaurocks-karaoke/src/App.jsx:274>) now defines real Terms, Privacy, and data-deletion pages
- [TERMS.md](</C:/Users/beauj/Desktop/beaurocks-karaoke/TERMS.md:1>) no longer says `Draft`

Verification result:

- production legal URLs returned HTTP 200 on 2026-07-06
- desktop and mobile screenshots were captured in `docs/compliance/evidence/2026-07-06-youtube-audit/`
- this no longer blocks submission assembly

Verified criteria:

- production URLs are live for:
  - `https://beaurocks.app/karaoke/terms`
  - `https://beaurocks.app/karaoke/privacy`
  - `https://beaurocks.app/karaoke/data-deletion`
- those pages load cleanly on desktop and mobile
- those pages include the YouTube and Google policy links as expected

## Blocker 2: Final Business And Contact Details Must Be Confirmed

Current repo state:

- legal surfaces now consistently use `hello@beaurocks.app`

Why this still blocks submission:

- the audit packet should not go out with placeholder or unconfirmed legal-contact details
- the legal contact should match the real operator/business owner for follow-up

Minimum acceptance criteria:

- confirm `hello@beaurocks.app` is the correct audit/legal contact
- confirm the business/product naming on Terms, Privacy, and deletion pages is final

## Blocker 3: Live-Only Audit Evidence Still Needs To Be Captured

Current repo state:

- the repo now has the right surfaces to screenshot
- public legal-page screenshots are captured
- QA product-surface screenshots are captured for host YouTube search/add, Room Library Curator, audience YouTube search, audience URL paste, TV YouTube performance, and TV Apple Music background playback
- [YOUTUBE_AUDIT_PACKET_CHECKLIST.md](</C:/Users/beauj/Desktop/beaurocks-karaoke/docs/compliance/YOUTUBE_AUDIT_PACKET_CHECKLIST.md>) and [YOUTUBE_AUDIT_SUBMISSION_DRAFT.md](</C:/Users/beauj/Desktop/beaurocks-karaoke/docs/compliance/YOUTUBE_AUDIT_SUBMISSION_DRAFT.md>) describe the evidence packet

Why this still blocks submission:

- reviewers will understand the product much faster with concrete screenshots that match your narrative
- a few screenshots require live project state or a live test room rather than deterministic QA fixtures

Minimum acceptance criteria:

- capture screenshots for:
  - quota exhaustion fallback state from a real exhausted/cooldown condition or controlled production test
  - room permanent-delete path from a live test room
  - authenticated production host session for the live audit room, if reviewers request live-room evidence beyond the QA product-surface packet

Use `docs/compliance/YOUTUBE_LIVE_EVIDENCE_RUNBOOK_2026-07-06.md` for exact capture steps and filenames.

## Blocker 4: Google Cloud Quota Evidence Still Needs To Be Captured

Current repo state:

- [functions/lib/entitlementsUsage.js](</C:/Users/beauj/Desktop/beaurocks-karaoke/functions/lib/entitlementsUsage.js:94>) now makes clear that the app meter is request count, not Google quota units

Why this still blocks submission:

- the audit packet should use Google Cloud Console as the source of truth for official YouTube quota usage

Minimum acceptance criteria:

- capture a Google Cloud Console screenshot for the live YouTube Data API quota page
- be ready to explain that the in-app counter is an operational request counter, not the official quota ledger

## Blocker 5: Final Submission Narrative Should Be Checked Against Live Behavior

Current repo state:

- the draft narrative is in [YOUTUBE_AUDIT_SUBMISSION_DRAFT.md](</C:/Users/beauj/Desktop/beaurocks-karaoke/docs/compliance/YOUTUBE_AUDIT_SUBMISSION_DRAFT.md>)

Why this still blocks submission:

- the audit answer set should match the live product exactly
- any mismatch between screenshots, URLs, and narrative will weaken the submission

Minimum acceptance criteria:

- verify the live product still matches the documented method list:
  - `search.list`
  - `videos.list`
  - `playlistItems.list`
- verify the live product still matches the documented retention story:
  - temporary room-scoped YouTube metadata
  - up to 30 days unless refreshed sooner
  - nightly cleanup
  - bounded canonical candidate backfill for verified embeddable indexed tracks
  - permanent room deletion removes the room host library

## Resolved In Repo

These are no longer the main blockers in the codebase:

- missing Terms route
- missing Privacy route
- missing data-deletion route
- weak singer legal-link copy
- missing YouTube API Services disclosure in inspected host/singer surfaces
- indefinite `ytIndex` retention
- missing room-host-library cleanup on permanent delete
- missing canonical candidate persistence from curated index promotion
- missing source-discovery provenance for indexed backing entries
- missing bounded backfill for existing verified canonical-indexed tracks

## Recommended Submission Sequence

1. Capture live Google Cloud quota screenshots, quota exhaustion/cooldown evidence, and room permanent-delete evidence.
2. Confirm final business/contact details.
3. Review `docs/compliance/YOUTUBE_QUOTA_EXTENSION_PACKET_2026-07-06.md` and the submission draft against the live product once.
4. Only then submit the audit/quota-extension request.
