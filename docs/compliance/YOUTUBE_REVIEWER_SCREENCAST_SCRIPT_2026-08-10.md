# YouTube API Reviewer Screencast Script

Last reviewed: 2026-08-10
Project: `beaurocks-karaoke-v2` (`426849563936`)
API Client: `BeauRocks Karaoke`
Production commit: `c63d1da`
Production Hosting release: `1786409192112000`
Production Hosting version: `8e3285f7dfc65739`

## What YouTube Asked To See

Record one concise English-language screencast showing the complete user-visible workflow:

1. A Host initiates a karaoke backing-track search.
2. BeauRocks displays the YouTube result and its verification state.
3. A verified result is saved or selected for the room.
4. The Host adds it as a performance and starts that performance.
5. The end result appears on Public TV through YouTube's supported embedded player.

The recording should also explain, without opening source code or exposing credentials, where `search.list`, `videos.list`, and `playlistItems.list` are used.

Target length: **4 to 6 minutes**. Keep the browser and narration in English.

## Before Recording

- Use a disposable room with no real guest names, emails, messages, or event data.
- Sign in before recording so the password and password manager never appear.
- Close email, Cloud Console, developer tools, password managers, and unrelated tabs.
- Disable desktop notifications.
- Record at 1440 x 900 or larger with browser zoom between 90% and 100%.
- Prepare these tabs:
  - `https://host.beaurocks.app`
  - the disposable room's Public TV window
  - `https://beaurocks.app/karaoke/privacy`
  - `https://beaurocks.app/karaoke/terms`
- Choose a real song/artist query that is not already in the disposable room library.
- Leave YouTube search on its default **Verified for TV Only** setting.
- Do not enable `?qaYoutube=1`; internal QA controls must not appear in reviewer evidence.
- Confirm the selected result says **Verified for Public TV** before adding it as a performance.

## Word-For-Word Walkthrough

### 0:00-0:20 — Identify The Client

On screen:

- Show the `host.beaurocks.app` address bar and the signed-in Host panel.

Narration:

> This is BeauRocks Karaoke, project number 426849563936. It is a browser-based live karaoke application with separate Host, Audience, and Public TV surfaces. This walkthrough shows the complete Host-initiated YouTube search, verification, room-library, queue, and embedded playback workflow.

### 0:20-0:45 — Show The YouTube Disclosure

On screen:

- In Host Admin, select **Open Media Setup**. If Apple Music is connected, the same button may say **Media + Apple Music**.
- Select **Open Curator**.
- Pause on **Room Library Curator**, the YouTube API Services disclosure, YouTube Terms link, and Google Privacy link.

Narration:

> The product identifies its use of YouTube API Services and links to the YouTube Terms of Service and Google Privacy Policy. BeauRocks does not request access to the Host's YouTube account or channel for this workflow.

### 0:45-1:20 — Initiate A Search

On screen:

- Point out the three-step **Search, Verify, Play** explanation.
- Keep **Verified for TV Only** selected.
- Enter the prepared real title-and-artist query in **Search verified YouTube karaoke...**.
- Select **Search** once and wait for results.

Narration:

> A Host starts discovery only when the room needs a backing. BeauRocks uses `youtube.search.list` for title-and-artist discovery. Repeated queries may be served from compliant client, server, or durable cache layers instead of spending another live search call.

### 1:20-2:00 — Explain Results And Verification

On screen:

- Pause on one result.
- Point to **Verified for Public TV**.
- Point to **Live YouTube search** or **Cached YouTube search**, whichever actually appears.
- Point to the verification-freshness badge.

Narration if the badge says **Live YouTube search**:

> This result was discovered through a Host-initiated YouTube API search. BeauRocks then uses `youtube.videos.list` to confirm current playability and embeddability before calling it ready for Public TV.

Narration if the badge says **Cached YouTube search**:

> This repeated query was served from a recent cache instead of issuing another live search. BeauRocks still shows the result's verification state and freshness. Known video IDs are refreshed through the lower-cost `youtube.videos.list` path when required.

Then say:

> A legacy playable flag by itself is not enough. Unknown results are labeled Needs verification. Non-embeddable results remain available only for review or opening on YouTube and are not presented as playable inside Public TV.

Do not change the setting just to manufacture an external-only result. The visible **Verified for TV Only** control and your narration are sufficient.

### 2:00-2:35 — Save The Verified Result

On screen:

- Select **Add** on the verified search result.
- Show the item in the room library.
- Pause on its readiness, provenance, and freshness labels.

Narration:

> Selecting Add stores temporary YouTube metadata for room reuse, including the video ID, title, channel, thumbnail, verification state, provenance, and timestamps. BeauRocks does not download or store YouTube audiovisual content. Temporary metadata is refreshed or pruned under the documented retention policy.

### 2:35-3:10 — Add And Start The Performance

On screen:

- Select **Add Performance** on the verified room-library item.
- Return to Tonight's Lineup or the live queue.
- Show the queued performance.
- Use **Start performance** or **Start Next**, depending on the visible Host control.

Narration:

> The verified backing is added to the live performance queue. The Host remains in control of when the performance begins; a search result does not automatically take over the Public TV screen.

### 3:10-3:50 — Show The End Result

On screen:

- Switch to the Public TV tab.
- Show the song and singer information.
- Let the supported YouTube embedded player render for several seconds so YouTube branding and the video result are visible.

Narration:

> This is the final end-user result. Public TV uses YouTube's supported embedded player. The video remains hosted and delivered by YouTube while BeauRocks manages the surrounding live-event queue, singer, room, and timing experience. BeauRocks does not download, restream, or alter the YouTube media.

### 3:50-4:20 — Explain Playlist Indexing

On screen:

- Return to Room Library Curator.
- Briefly show the Host playlist URL field, but do not submit a large playlist during the recording.

Narration:

> Hosts may also preload a Host-supplied YouTube playlist. BeauRocks uses `youtube.playlistItems.list` to enumerate that playlist and `youtube.videos.list` to verify entries before they become TV-ready. This is a Host-directed preparation path, not an automated crawl.

### 4:20-4:50 — Close With Quota And Data Controls

On screen:

- Show the room-library reuse and quota/cooldown guidance.
- Optionally show the public Privacy and Terms tabs, with the address bar visible.

Narration:

> BeauRocks reduces live API usage through verified room-library reuse, canonical backing reuse, caching, known-ID refresh, and quota cooldowns. It does not rotate projects or keys to evade quota. Public Privacy, Terms, and data-deletion pages are available without signing in.

### 4:50-5:05 — Final Statement

Narration:

> This completes the workflow from a Host-initiated search through verification, room reuse, queueing, and the final YouTube embedded playback result. Thank you for reviewing the BeauRocks Karaoke quota request.

## Optional Opening Title Card

Use this for three seconds:

> BeauRocks Karaoke — YouTube Data API Client Workflow  
> Project `426849563936`  
> English reviewer screencast — August 2026

## Recording Acceptance Checklist

- [ ] English narration is audible and understandable.
- [ ] The production domain is visible at least once.
- [ ] The Host visibly initiates a real title-and-artist search.
- [ ] The recording states that `search.list` performs discovery.
- [ ] A result's readiness, provenance, and freshness are visible.
- [ ] The recording states that `videos.list` verifies known IDs.
- [ ] The selected result says **Verified for Public TV**.
- [ ] The result is added to the room library and then as a performance.
- [ ] The Host explicitly starts the performance.
- [ ] Public TV visibly renders the YouTube embedded player and final song result.
- [ ] `playlistItems.list` is explained briefly.
- [ ] The recording says BeauRocks does not download YouTube media.
- [ ] No passwords, API keys, private guest data, internal QA controls, or unrelated tabs appear.
- [ ] The video link can be opened by a reviewer without requesting access.

## Delivery

Suggested filename:

`beaurocks-youtube-api-client-workflow-2026-08.mp4`

Upload it as an email attachment if it fits, or use a stable Google Drive link set to **Anyone with the link can view**. Open the link in a private browser window before replying to confirm the reviewer will not encounter a sign-in or access-request screen.

Use the **Reviewer Screencast Follow-Up** draft in `docs/compliance/YOUTUBE_QUOTA_EMAIL_TEMPLATES_2026-07-15.md` for the reply.
