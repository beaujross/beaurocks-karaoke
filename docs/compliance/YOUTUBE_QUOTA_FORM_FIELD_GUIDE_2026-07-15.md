# YouTube Data API Audit And Quota Form — Field Guide

Last reviewed: 2026-08-07
Official form: https://support.google.com/youtube/contact/yt_api_form?hl=en
Google Cloud project ID: `beaurocks-karaoke-v2`
Google Cloud project number: `426849563936`

## Which Google Account To Use

Open and submit the form while signed into the personal Gmail account that owns or administers `beaurocks-karaoke-v2`. Use `hello@beaurocks.app` as the primary reviewer contact.

The Cloud-owner account proves project access. The contact email does not need to be the same account.

## Before Opening The Form

Confirm these values:

- Full legal name: `[CONFIRM]`
- Applying as: `[registered organization OR individual]`
- Organization legal name: `[exact registered name OR self]`
- Legal address: `[CONFIRM]`
- Primary contact: `[CONFIRM FULL NAME] <hello@beaurocks.app>`
- Current monetization selections: `[CONFIRM CURRENT TRUTH]`
- Upcoming event dates, expected room count, and expected attendance: `[CONFIRM]`
- Requested Search Queries allocation: `5,000/day`
- Requested Search Queries peak: `120/minute`

Do not store the demo password in this repository. Paste it directly into the Google form from the secure QA credential.

## Section 1 — Request Type

Select:

- `Complete a compliance audit to request for additional quota`

## Section 2 — Organization And Contact

Recommended entries:

- Applying: choose organization only if a registered entity owns the project; otherwise choose individual.
- Full legal name: your legal name.
- Organization legal name: exact registered entity name, or `self` when applying individually.
- Parent company: registered parent name, or `self` / not applicable as the form directs.
- Primary website: `https://beaurocks.app`
- Country/address: legal business or individual contact address.
- Category: `Media and Entertainment`
- Organization size/type:
  - `Independent Developer/Sole Proprietor` when applying individually; or
  - `Startup (fewer than 10 employees)` when applying through a registered startup.
- Primary contact email: `hello@beaurocks.app`
- Technical contact: `Same as Primary Contact`
- Business contact: `Same as Primary Contact`

## Section 3 — Business Model

### Organization Description

Paste:

> BeauRocks Karaoke is a live event and at-home party web application for karaoke hosts, venues, and participants. It coordinates song discovery, performer requests, the room queue, audience interactions, scoring, and a public display across separate Host, Audience, and TV browser surfaces. YouTube Data API Services are used only to discover karaoke backing-track candidates, validate known video IDs for playability and embeddability, and inspect host-supplied playlist items. BeauRocks provides substantial independent event-management, queueing, scoring, discovery, and audience-interaction functionality. It does not download, alter, upload, or redistribute YouTube media.

Target audiences:

- `General Public`
- `Other` — `Karaoke hosts, venue owners, private-event organizers, singers, and event audiences.`

Monetization:

- Select only what is currently true.
- Recommended current description under `Other`:

> BeauRocks is currently onboarding a limited, selectively approved Host testing cohort. Applying is free. Approved testing access is complimentary while an invitation is active: no card is required, no subscription is started, and there are no automatic charges. Paid Host plans are not currently available. If paid plans are introduced later, Hosts will see the price, included features, and terms and must explicitly opt in before any charge. YouTube content itself is not sold.

- Do not select advertising unless ads actually appear.
- If asked whether ads or sponsorships are sold on or within YouTube content/player, answer `Not applicable` unless that business model changes.

Google relationship:

- `No, I do not have a Google representative` unless a real representative exists.
- Content Owner IDs: leave blank unless BeauRocks manages YouTube Content Manager assets.
- Google Ads Customer IDs: leave blank unless BeauRocks manages its own Google Ads customer account for this use case.
- “How did you learn about the API?”: select the truthful option; `Google Developer Documentation` is appropriate only if accurate.

## Section 4 — API Client

- API client name: `BeauRocks Karaoke`
- Contains “YouTube” in the client name: `No`
- Primary access URL: `https://beaurocks.app`
- Privacy Policy: `https://beaurocks.app/karaoke/privacy`
- Terms: `https://beaurocks.app/karaoke/terms`
- Publicly accessible: `Yes`
- Demo username: `beaujross+qa-host-20260407b@gmail.com`
- Demo password: paste from the secure QA credential; never copy it into email or this repository.
- Login URL: `https://host.beaurocks.app`

Special access instructions:

> Sign in at the Host URL with the supplied QA account. The account has access to the Host workspace and sample room data. Open Screens + Playback, then Room Library Curator, to review YouTube search, known-track reuse, quota-aware fallback, disclosure links, and content-agnostic alternatives. Audience and public TV surfaces can be opened from the room controls. The YouTube Data API flows use application credentials and do not request access to a reviewer’s YouTube account or channel.

Review and personally accept the demo-account waiver shown by Google before submitting.

## Section 5 — Project And Quota

- Number of projects: `1`
- Project number: `426849563936`
- Use cases:
  - `Websites & Mobile Apps`
  - `Others` — `Live karaoke and event companion web application with Host, Audience, and TV browser surfaces.`
- Do not select `Smart TVs, Consoles & Hardware` unless a native hardware integration is introduced.
- Google OAuth 2.0 required for YouTube API use: `No`
- Extended derived-metrics/statistical-storage permission: not requested. BeauRocks follows the standard temporary refresh/deletion contract.
- Expected API volume: `1,000 to 10,000 requests per day`

Endpoints:

- `youtube.search.list`
- `youtube.videos.list`
- `youtube.playlistItems.list`

General quota:

- Select `No change / Default quota (10k quota points)`.
- Do not request `youtube.videos.insert`; BeauRocks does not upload videos.

Search Queries quota:

- Total per day: `5,000`
- Peak per minute: `120`

Detailed justification:

> BeauRocks runs live karaoke events that may serve approximately 150 participants over a five-hour show. Our modeled low-, medium-, and high-engagement envelopes are approximately 120, 300, and 750 uncached live searches per event. We request 5,000 search.list calls/day for a controlled public-launch capacity of five simultaneous or same-day high-engagement event-equivalents (3,750 calls) plus 1,250 calls of reserve, or approximately 13 medium-engagement events with contingency. The requested 120-calls/minute peak supports four short room/actor bursts at the application’s enforced 30-calls/minute callable limit and remains below the application-wide 600-calls/minute safety ceiling. Live search remains the last discovery path: the application first uses client, server, and durable query caches; room, account, curated, and canonical backing indexes; known video-ID refresh; and direct host URLs. Quota exhaustion triggers a cooldown and known-catalog/content-agnostic fallback rather than circumvention. We do not download YouTube media, rotate API projects or keys, or present non-embeddable results as playable. We will monitor production usage and request a further reviewed increase only when measured adoption justifies it.

Immediately after that paragraph, add the confirmed near-term event schedule in one factual sentence, for example: `The requested capacity also supports [COUNT] scheduled events on [DATES], with up to [ROOMS] concurrent rooms and approximately [ATTENDEES] attendees.` Do not submit the bracketed example or claim unconfirmed attendance.

## Section 6 — Upload Mapping

The live form requires uploads to be PNG/JPEG/PDF, at least 1280×720, readable, with the browser address bar visible for web pages. Capture the required presentation screenshots into:

`docs/compliance/evidence/2026-07-15-youtube-form/`

Upload:

- Privacy Policy Screenshots → `02-privacy-policy-address-bar.png`
- Homepage / policy-link context → `03-host-youtube-policy-links-address-bar.png`
- Terms documentation → `04-terms-address-bar.png`
- Conditional player/embed evidence → `05-youtube-player-address-bar.png`
- Optional dashboard evidence → `06-host-curator-address-bar.png`
- Optional architecture/supporting material → the existing quota packet or architecture overview, converted to PDF only if useful.

The older deterministic screenshots remain technical backup evidence but should not replace these address-bar captures where the current form explicitly requires browser chrome.

## Section 7 — Attestations

The submitter must personally read and check every required policy, truthfulness, data-processing, recording, and demo-account attestation. Do not delegate these acknowledgments.

Before clicking Submit:

1. Run `npm run qa:youtube:submission-preflight`.
2. Confirm the four human-owned fields.
3. Verify the screenshot files and resolution.
4. Download or save the completed submission after Google accepts it.
5. Record the submission date, case/reference ID, and submitting Google account.
