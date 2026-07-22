# YouTube Quota Increase — Owner Action Guide

Date: 2026-07-19
Project ID: `beaurocks-karaoke-v2`
Project number: `426849563936`
Requested Search Queries quota: `5,000 calls/day`, `120 calls/minute`
General YouTube Data API quota: no increase requested from `10,000 units/day`

## Readiness

The repository and evidence packet are technically ready. The live preflight passed every technical check on 2026-07-19: all required screenshots are present, all three public legal URLs return HTTP 200, the documented API methods remain in code, and the 30-day room-index retention control remains wired.

The only remaining blockers are owner attestations and submission:

1. Confirm `hello@beaurocks.app` as the reviewer/audit contact.
2. Enter the actual legal applicant/operator name, entity type, and legal address.
3. Approve the requested `5,000/day` and `120/minute` Search Queries limits.

## Which Google Account To Use

Sign into the Google account that owns or administers Google Cloud project `beaurocks-karaoke-v2`. This will normally be the personal Gmail account already tied to the Cloud project. The signed-in account and the reviewer contact do not need to match; use `hello@beaurocks.app` as the reviewer contact if that is the confirmed monitored address.

## Step-By-Step Submission

1. Open the official Audit and Quota Extension Form while signed into the Cloud-owner account:
   `https://support.google.com/youtube/contact/yt_api_form?hl=en`
2. Select `Complete a compliance audit to request for additional quota`.
3. Enter the real applicant information. Select `Independent Developer/Sole Proprietor` unless a registered entity actually owns and operates the project. Do not invent an organization name or address.
4. Use `hello@beaurocks.app` for the primary contact, and select same-as-primary for technical and business contacts if accurate.
5. Use the organization and business-model copy in `docs/compliance/YOUTUBE_QUOTA_FORM_FIELD_GUIDE_2026-07-15.md`. Keep the current monetization answer truthful: private-event hosting/private testing today, with commercial host and venue plans planned for launch.
6. Enter the API client details:
   - Client name: `BeauRocks Karaoke`
   - Primary URL: `https://beaurocks.app`
   - Privacy: `https://beaurocks.app/karaoke/privacy`
   - Terms: `https://beaurocks.app/karaoke/terms`
   - Login: `https://host.beaurocks.app`
   - Demo username: `beaujross+qa-host-20260407b@gmail.com`
   - Demo password: paste the authorized QA password directly into Google's form; do not add it to this repository or an email.
7. Enter one project: `426849563936`.
8. Select the web/mobile-app use case and describe the product as a live karaoke and event companion with Host, Audience, and TV browser surfaces.
9. List the methods actually used: `youtube.search.list`, `youtube.videos.list`, and `youtube.playlistItems.list`.
10. Select expected usage of `1,000 to 10,000 requests per day`.
11. Leave the general quota at its current `10,000 units/day`; do not request upload quota because BeauRocks does not upload YouTube videos.
12. Request Search Queries limits of `5,000/day` and `120/minute`. Paste the detailed justification from the field guide. This request covers five high-engagement 150-person event-equivalents plus reserve and is supported by the product's cache, known-ID validation, canonical backing reuse, cooldown, and content-agnostic fallback controls.
13. Upload the evidence from `docs/compliance/evidence/2026-07-15-youtube-form/`:
   - Privacy: `02-privacy-policy-address-bar.png`
   - Product/policy context: `03-host-youtube-policy-links-address-bar.png`
   - Terms: `04-terms-address-bar.png`
   - Player/embed: `05-youtube-player-address-bar.png`
   - Optional quota proof: `01-google-cloud-youtube-quotas-address-bar.png` and `01b-google-cloud-youtube-general-quota-address-bar.png`
   - Optional operational proof: `06-host-curator-address-bar.png`
14. Personally read and accept every required policy, demo-access, truthfulness, data-processing, and recording attestation.
15. Before submitting, run the strict local gate:

```powershell
$env:YOUTUBE_AUDIT_CONTACT_CONFIRMED = "1"
$env:YOUTUBE_AUDIT_LEGAL_IDENTITY_CONFIRMED = "1"
$env:YOUTUBE_SEARCH_QUOTA_REQUEST_APPROVED = "5000"
node scripts/ops/youtube-submission-preflight.mjs --live --strict
```

16. Submit the form. Save the confirmation page or PDF, submission date, submitting Google account, and Google case/reference ID.
17. Fill in the submission-record template in `docs/compliance/YOUTUBE_QUOTA_EMAIL_TEMPLATES_2026-07-15.md`. The first request goes through the form; send a follow-up email only in a reviewer-created thread or when Google supplies a case contact.

## After Approval

1. Verify the assigned Search Queries daily and per-minute limits in Google Cloud Console.
2. Set the production build value `VITE_YOUTUBE_DAILY_SEARCH_LIST_CALL_LIMIT` to the assigned daily limit. Do not assume Google approved the full request until the Console shows it.
3. Set the Functions runtime value `YOUTUBE_DAILY_SEARCH_LIST_CALL_LIMIT` to the same verified assignment. This controls the server-wide daily ledger and nightly live-reserve boundary.
4. Review `YOUTUBE_NIGHTLY_LIVE_SEARCH_RESERVE` and `YOUTUBE_NIGHTLY_CATALOG_SEARCH_CAP`. Defaults preserve 25% for live search and cap nightly enrichment at 100 searches; use `YOUTUBE_NIGHTLY_CATALOG_ENABLED=false` as the operational kill switch.
5. Keep `VITE_YOUTUBE_DAILY_GENERAL_DATA_UNIT_LIMIT` aligned with the assigned general quota.
6. Rebuild and deploy Hosting and Functions so the Host operational labels and backend policy reflect the approved allocation.
7. Run the host-room golden QA and a controlled multi-room search test; verify the backend `youtubeQuotaStatus`, `youtube_api_daily_usage/{PacificDate}`, nightly runtime report, and Cloud Console agree.
8. Record the approval date and assigned limits in the quota packet. Use measured adoption and cache-hit data for any later increase.

## Source Documents

- Form field guide: `docs/compliance/YOUTUBE_QUOTA_FORM_FIELD_GUIDE_2026-07-15.md`
- Reviewer narrative: `docs/compliance/YOUTUBE_AUDIT_SUBMISSION_DRAFT.md`
- Quota packet: `docs/compliance/YOUTUBE_QUOTA_EXTENSION_PACKET_2026-07-06.md`
- Email templates: `docs/compliance/YOUTUBE_QUOTA_EMAIL_TEMPLATES_2026-07-15.md`
- Evidence README: `docs/compliance/evidence/2026-07-15-youtube-form/README.md`
