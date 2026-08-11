# YouTube Quota Submission Email Templates

Last reviewed: 2026-08-10

The initial request is submitted through Google’s Audit and Quota Extension Form, not by unsolicited email. Use these drafts only for your internal record or when a Google/YouTube reviewer opens an email thread.

## Reviewer Screencast Follow-Up

Subject: `Re: YouTube Data API quota increase — BeauRocks Karaoke — Project 426849563936`

> Hello YouTube API Services Team,
>
> Thank you for the follow-up. I have prepared an English-language screencast demonstrating the complete BeauRocks Karaoke YouTube API Client workflow you requested.
>
> Video: [PASTE REVIEWER-ACCESSIBLE VIDEO LINK]
> Duration: [MM:SS]
> Project ID: beaurocks-karaoke-v2
> Project number: 426849563936
>
> The walkthrough shows:
>
> - a Host initiating a karaoke title-and-artist search;
> - the result's live or cached search provenance, embeddability verification, and verification freshness;
> - a verified result being saved to the temporary room library;
> - the verified backing being added to the live performance queue and explicitly started by the Host;
> - the final song result rendered on Public TV through YouTube's supported embedded player; and
> - the Host-directed playlist indexing path.
>
> In the walkthrough I also identify the API methods used: `search.list` for Host-initiated discovery, `videos.list` for known-video details and embeddability/playability verification, and `playlistItems.list` for Host-supplied playlist indexing.
>
> BeauRocks does not download, restream, or alter YouTube audiovisual content. Videos remain hosted and delivered by YouTube. Repeated discovery is reduced through temporary cache and verified-index reuse, and non-embeddable or unverified results are not presented as playable inside Public TV.
>
> Public compliance URLs:
>
> Privacy Policy: https://beaurocks.app/karaoke/privacy
> Terms of Service: https://beaurocks.app/karaoke/terms
> Data deletion: https://beaurocks.app/karaoke/data-deletion
>
> Please let me know if you need a different file format, an additional workflow, or further supporting information to complete the compliance review.
>
> Best,
> [FULL LEGAL NAME]
> BeauRocks Karaoke
> hello@beaurocks.app

## Submission Record

Subject: `YouTube Data API audit and quota extension submitted — BeauRocks Karaoke — Project 426849563936`

> Hello,
>
> This note records submission of the YouTube Data API Audit and Quota Extension Form for BeauRocks Karaoke.
>
> Project ID: beaurocks-karaoke-v2
> Project number: 426849563936
> Requested Search Queries allocation: 5,000 calls/day
> Requested Search Queries peak: 120 calls/minute
> General API quota request: no change from 10,000 units/day
> Submission date: [DATE]
> Google case/reference ID: [CASE ID]
> Submitting Google account: [CLOUD-OWNER ACCOUNT]
>
> The submission includes the public legal URLs, API-client screenshots, quota-assignment evidence, cooldown behavior, temporary data-retention controls, and permanent room-deletion evidence.
>
> BeauRocks contact: hello@beaurocks.app

## Reviewer Follow-Up

Subject: `Re: YouTube Data API audit and quota extension — BeauRocks Karaoke — Project 426849563936`

> Hello YouTube API Services team,
>
> Thank you for reviewing the BeauRocks Karaoke submission for project 426849563936.
>
> BeauRocks is a live karaoke and event companion web application. We use search.list for backing-track discovery, videos.list to validate known tracks for playability and embeddability, and playlistItems.list for host-directed playlist indexing. We do not download or alter YouTube media, upload videos, or use multiple projects or keys to avoid quota limits.
>
> Current Host access is a limited, selectively approved testing cohort. Approved testing access is complimentary while an invitation is active; no card or subscription is started and there are no automatic charges. Paid Host plans are not currently available, any future paid access will require explicit opt-in, and YouTube content itself is not sold.
>
> We requested 5,000 Search Queries calls/day with a 120-calls/minute peak. This supports a controlled public-launch capacity of five same-day high-engagement event-equivalents (approximately 3,750 uncached live searches) plus 1,250 calls of reserve, or approximately 13 medium-engagement events with contingency. The application reduces live demand through multiple cache layers, verified indexed and canonical backing reuse, known-ID refresh, host-provided URLs, and quota cooldown behavior. A bounded 23:35 Pacific worker may use a small portion of otherwise-unused allowance for first-party-demand songs that lack a fresh verified backing; it skips active rooms and cannot cross the configured live-search reserve. We will monitor measured production adoption before requesting any further increase.
>
> Public URLs:
>
> Privacy: https://beaurocks.app/karaoke/privacy
> Terms: https://beaurocks.app/karaoke/terms
> Data deletion: https://beaurocks.app/karaoke/data-deletion
>
> Please let me know if you need another screenshot, a live walkthrough, or updated demo access instructions.
>
> Best,
> [FULL LEGAL NAME]
> BeauRocks Karaoke
> hello@beaurocks.app

## Demo Access Follow-Up

Subject: `Re: BeauRocks Karaoke review access — Project 426849563936`

> Hello,
>
> The demo account and password were provided through the secure audit form. For security, I have not repeated the password in email.
>
> Login URL: https://host.beaurocks.app
> Demo username: beaujross+qa-host-20260407b@gmail.com
>
> After signing in, open Host Admin, select Open Media Setup (or Media + Apple Music when connected), and then select Open Curator. Room Library Curator demonstrates YouTube discovery, explicit Public TV readiness, result provenance, verification freshness, known-backing reuse, quota-aware fallback, and disclosure links. Audience and Public TV surfaces can be opened from the room controls.
>
> The YouTube Data API flows do not request access to the reviewer’s YouTube account or channel.
>
> If the original form credentials need to be rotated, please reply and I will provide a new credential through an agreed secure channel.
>
> Best,
> [FULL LEGAL NAME]
> BeauRocks Karaoke
> hello@beaurocks.app

## Status Follow-Up

Subject: `Status follow-up — YouTube Data API audit and quota extension — Project 426849563936`

> Hello YouTube API Services team,
>
> I am following up on the Audit and Quota Extension Form submitted on [DATE] for BeauRocks Karaoke, project 426849563936.
>
> Requested Search Queries allocation: 5,000 calls/day
> Requested Search Queries peak: 120 calls/minute
> Google case/reference ID: [CASE ID]
>
> Please let me know whether additional compliance evidence, screenshots, or demo access is needed.
>
> Best,
> [FULL LEGAL NAME]
> BeauRocks Karaoke
> hello@beaurocks.app
