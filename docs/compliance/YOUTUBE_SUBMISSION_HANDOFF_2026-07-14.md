# YouTube Audit And Quota Submission Handoff

Last reviewed: 2026-08-10
Current production app commit: `c63d1da` (deployed 2026-08-10 America/Los_Angeles)
Current production Hosting release: `1786409192112000`
Current production Hosting version: `8e3285f7dfc65739`
Evidence Hosting release: `1784078708909000`
Evidence Hosting version: `5bc48c15cd873eac`

## Executive Decision

The form has been submitted and YouTube API Services requested an English-language script or detailed screencast showing the complete search and embedded-video workflow. Reply in the existing reviewer thread within the stated seven-business-day window. Do not submit a duplicate form unless YouTube asks for one.

Immediate owner action:

1. Record the production walkthrough using `docs/compliance/YOUTUBE_REVIEWER_SCREENCAST_SCRIPT_2026-08-10.md`.
2. Upload the video to a reviewer-accessible link and verify it in a private browser window.
3. Paste that link and duration into the Reviewer Screencast Follow-Up template.
4. Reply in the existing YouTube thread from the monitored contact address.

Recommendation: approve `5,000 Search Queries/day` and `120/minute`. The documented high-engagement envelope is `750` live searches across a five-hour, 150-person event. The request supports five high-engagement event-equivalents (`3,750` calls) plus `1,250` calls of reserve, or approximately 13 medium-engagement events with contingency. It is large enough for a controlled public launch without making an unsupported mass-scale forecast; measured production adoption should drive the next increase. Indexed, canonical, cached, direct-URL, and content-agnostic paths continue to reduce live-search demand.

## Technical Status

- Current official documentation confirms the granular default of `100 search.list` calls/day and `10,000` combined units/day for other endpoints.
- Authenticated project evidence records the same live assignment and increase eligibility.
- The app uses `search.list`, `videos.list`, and `playlistItems.list`.
- Required legal, product, cooldown, quota-API, and permanent-delete evidence is present.
- The deployed product does not download YouTube media or rotate projects/keys to evade quota.
- Temporary room metadata, known-ID refresh, nightly cleanup, and permanent-delete behavior remain documented and tested.
- Current production legal URLs are checked by the submission preflight.
- Production now distinguishes **Verified for Public TV**, **External only**, and **Needs verification**, and shows result provenance and verification freshness.
- Internal YouTube QA controls are hidden unless an authorized operator explicitly adds `?qaYoutube=1`.
- The production Host asset verified after deployment is `HostApp-Dh-8YBIB.js`.

## One-Command Gate

Technical readiness:

```powershell
npm run qa:youtube:submission-preflight
```

Final strict gate after recording the video and finalizing the reply:

```powershell
$env:YOUTUBE_REVIEWER_VIDEO_LINK_CONFIRMED = "1"
$env:YOUTUBE_REVIEWER_EMAIL_FINALIZED = "1"
node scripts/ops/youtube-submission-preflight.mjs --live --strict
```

The strict command exits `2` while a human-owned response item remains. It never stores the video URL, legal name, contact confirmation, or approval secrets in the repository. The historical form-submission gate remains available with `--initial-submission`.

## Submission Files

- Field-by-field form guide: `docs/compliance/YOUTUBE_QUOTA_FORM_FIELD_GUIDE_2026-07-15.md`
- Owner action guide: `docs/compliance/YOUTUBE_QUOTA_OWNER_ACTION_GUIDE_2026-07-19.md`
- Email templates: `docs/compliance/YOUTUBE_QUOTA_EMAIL_TEMPLATES_2026-07-15.md`
- Reviewer screencast script: `docs/compliance/YOUTUBE_REVIEWER_SCREENCAST_SCRIPT_2026-08-10.md`
- Current-form screenshot folder: `docs/compliance/evidence/2026-07-15-youtube-form/`
- Reviewer narrative: `docs/compliance/YOUTUBE_AUDIT_SUBMISSION_DRAFT.md`
- Quota request packet: `docs/compliance/YOUTUBE_QUOTA_EXTENSION_PACKET_2026-07-06.md`
- Checklist: `docs/compliance/YOUTUBE_AUDIT_PACKET_CHECKLIST.md`
- Evidence manifest: `docs/compliance/evidence/2026-07-06-youtube-live-evidence/manifest.md`
- Live capture steps: `docs/compliance/YOUTUBE_LIVE_EVIDENCE_RUNBOOK_2026-07-06.md`

## Official References

- Audit and quota extension: https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits
- Search quota contract: https://developers.google.com/youtube/v3/docs/search/list
- Granular quota revision: https://developers.google.com/youtube/v3/revision_history
