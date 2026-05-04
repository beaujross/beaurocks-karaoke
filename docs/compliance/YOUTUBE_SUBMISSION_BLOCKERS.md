# YouTube Submission Blockers

Last updated: 2026-05-02

## Purpose

This document lists the remaining blockers between the current repo state and a credible YouTube Data API audit/quota-extension submission.

Use this as the go/no-go checklist.

## Current State

The repo now has the core YouTube compliance hardening in place:

- live YouTube search has cache, cooldown, and quota-backoff behavior
- room-level `ytIndex` now has temporary retention, ID-based refresh, nightly cleanup, and permanent-delete cleanup
- public legal routes now exist in the app for:
  - `/karaoke/terms`
  - `/karaoke/privacy`
  - `/karaoke/data-deletion`
- singer and host YouTube surfaces now include `This application uses YouTube API Services` disclosure text
- the singer join flow now links to Terms, Privacy, and data-deletion pages
- the internal YouTube meter is now clearly labeled as request count rather than official Google quota usage

The remaining blockers are now mostly deployment, verification, and audit-packet assembly.

## Blocker 1: Public Legal Pages Must Be Deployed And Verified

Current repo state:

- [src/App.jsx](</C:/Users/beauj/Desktop/beaurocks-karaoke/src/App.jsx:274>) now defines real Terms, Privacy, and data-deletion pages
- [TERMS.md](</C:/Users/beauj/Desktop/beaurocks-karaoke/TERMS.md:1>) no longer says `Draft`

Why this still blocks submission:

- the audit packet needs real production URLs, not only repo code
- the submitted URLs must be reachable without login and render correctly in production

Minimum acceptance criteria:

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

## Blocker 3: Final Audit Evidence Has Not Been Captured Yet

Current repo state:

- the repo now has the right surfaces to screenshot
- [YOUTUBE_AUDIT_PACKET_CHECKLIST.md](</C:/Users/beauj/Desktop/beaurocks-karaoke/docs/compliance/YOUTUBE_AUDIT_PACKET_CHECKLIST.md>) and [YOUTUBE_AUDIT_SUBMISSION_DRAFT.md](</C:/Users/beauj/Desktop/beaurocks-karaoke/docs/compliance/YOUTUBE_AUDIT_SUBMISSION_DRAFT.md>) already describe what to collect

Why this still blocks submission:

- reviewers will understand the product much faster with concrete screenshots that match your narrative

Minimum acceptance criteria:

- capture screenshots for:
  - Terms page
  - Privacy page
  - data-deletion page
  - singer join flow showing legal links
  - host YouTube search/index surface showing disclosure
  - singer/audience YouTube-backed search or request surface showing disclosure
  - quota exhaustion fallback state
  - room permanent-delete path

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

## Recommended Submission Sequence

1. Deploy the current legal and disclosure changes to the production surface.
2. Verify the three public legal URLs in production.
3. Capture the screenshot packet and Google Cloud quota screenshots.
4. Review the submission draft against the live product once.
5. Only then submit the audit/quota-extension request.
