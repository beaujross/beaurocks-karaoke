# YouTube Audit And Quota Submission Handoff

Date: 2026-07-14
Current production release: `1784078708909000`
Current Hosting version: `5bc48c15cd873eac`

## Executive Decision

The technical packet is ready. Do not submit until the five required address-bar presentation captures and three confirmation items are complete:

1. Capture the five required files in `docs/compliance/evidence/2026-07-15-youtube-form/` using the included README.
2. Confirm `hello@beaurocks.app` as the audit/legal contact.
3. Confirm the final legal operator name and `BeauRocks Karaoke` product naming used on Terms, Privacy, and deletion pages.
4. Approve the proposed staged public-launch request of `5,000 Search Queries/day` with a `120/minute` peak.

Recommendation: approve `5,000 Search Queries/day` and `120/minute`. The documented high-engagement envelope is `750` live searches across a five-hour, 150-person event. The request supports five high-engagement event-equivalents (`3,750` calls) plus `1,250` calls of reserve, or approximately 13 medium-engagement events with contingency. It is large enough for a controlled public launch without making an unsupported mass-scale forecast; measured production adoption should drive the next increase. Indexed, canonical, cached, direct-URL, and content-agnostic paths continue to reduce live-search demand.

## Technical Status

- Current official documentation confirms the granular default of `100 search.list` calls/day and `10,000` combined units/day for other endpoints.
- Authenticated project evidence records the same live assignment and increase eligibility.
- The app uses `search.list`, `videos.list`, and `playlistItems.list`.
- Required legal, product, cooldown, quota-API, and permanent-delete evidence is present.
- The deployed product does not download YouTube media or rotate projects/keys to evade quota.
- Temporary room metadata, known-ID refresh, nightly cleanup, and permanent-delete behavior remain documented and tested.
- Current production legal URLs are checked by the submission preflight.

## One-Command Gate

Technical readiness:

```powershell
npm run qa:youtube:submission-preflight
```

Final strict gate after the screenshot and approvals:

```powershell
$env:YOUTUBE_AUDIT_CONTACT_CONFIRMED = "1"
$env:YOUTUBE_AUDIT_LEGAL_IDENTITY_CONFIRMED = "1"
$env:YOUTUBE_SEARCH_QUOTA_REQUEST_APPROVED = "5000"
node scripts/ops/youtube-submission-preflight.mjs --live --strict
```

The strict command exits `2` while a human-owned item remains. It never stores contact confirmation or approval secrets in the repository.

## Submission Files

- Field-by-field form guide: `docs/compliance/YOUTUBE_QUOTA_FORM_FIELD_GUIDE_2026-07-15.md`
- Email templates: `docs/compliance/YOUTUBE_QUOTA_EMAIL_TEMPLATES_2026-07-15.md`
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
