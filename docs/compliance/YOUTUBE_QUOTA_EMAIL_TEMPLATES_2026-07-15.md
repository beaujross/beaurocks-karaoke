# YouTube Quota Submission Email Templates

Date: 2026-07-15

The initial request is submitted through Google’s Audit and Quota Extension Form, not by unsolicited email. Use these drafts only for your internal record or when a Google/YouTube reviewer opens an email thread.

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
> After signing in, open Screens + Playback and then Room Library Curator. That surface demonstrates YouTube discovery, known backing reuse, embeddability checks, quota-aware fallback, disclosure links, and content-agnostic alternatives. Audience and public TV surfaces can be opened from the room controls.
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
