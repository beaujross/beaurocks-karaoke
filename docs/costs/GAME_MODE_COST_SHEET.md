# Game Mode Cost Sheet

Last updated: 2026-04-03
Owner: Product / Ops

## Purpose

This file gives an operator-facing view of what BeauRocks features actually cost to run.

It separates:

1. Direct marginal provider cost
2. Quota / abuse risk
3. Suggested BeauRocks pricing treatment

Use this file for:

- host plan packaging
- deciding which modes should be included vs premium
- setting soft caps and hard limits

Do not use this file as a substitute for the larger reserve model in `docs/costs/NIGHTLY_COST_MODEL.md`. That file is still useful for pricing defense and margin planning, but it mixes true provider cost with internal reserve assumptions.

## Pricing Basis

Current public pricing references used for these estimates:

- Firestore pricing: https://cloud.google.com/firestore/pricing
- Firebase Firestore billing details: https://firebase.google.com/docs/firestore/pricing
- Cloud Run functions (1st gen pricing page used by current function deployment assumptions): https://cloud.google.com/functions/pricing-1stgen
- Cloud Storage pricing: https://cloud.google.com/storage/pricing
- Gemini Developer API pricing: https://ai.google.dev/gemini-api/docs/pricing
- YouTube Data API quota costs: https://developers.google.com/youtube/v3/determine_quota_cost

Repo implementation references:

- `functions/index.js`
- `functions/lib/geminiClient.js`
- `functions/lib/entitlementsUsage.js`
- `src/apps/Mobile/SingerApp.jsx`
- `src/components/UnifiedGameLauncher.jsx`

## Measured Room Snapshot

Reference room used for the latest real-world check:

- Room: `8U3K`
- Date: 2026-04-02
- Window: about 10:09 PM to 11:34 PM PDT
- Users: 13
- Songs: 18
- Reactions: 355
- Total project metrics in room window:
  - Firestore reads: 12,190
  - Firestore writes: 2,808
  - Firestore deletes: 0
  - Function invocations: 1,545

Measured feature signals from this room:

- Total `itunesSearch` function executions in window: 116
- Total `youtubeSearch` function executions in window: 76
- Total `youtubeDetails` function executions in window: 63
- Total `youtubeStatus` function executions in window: 8
- Lyrics AI attempts visible from room song traces: 17
- Lyrics AI hits: 14
- Lyrics AI misses: 3
- Apple lyrics attempts: 17
- Apple outcomes:
  - `apple_needs_user_token`: 15
  - `apple_no_match`: 2
- Pop Trivia AI generations visible from room song traces: 1 song

Audience search note:

- Exact audience search-box query count is not currently observable from telemetry.
- What can be proved for this room:
  - 7 audience-requested songs made it into the queue
  - 11 host-requested songs made it into the queue
- Because both host and audience surfaces call `itunesSearch`, the room-level `itunesSearch` invocation count is mixed traffic.

## Attribution Status

Historical note:

- The `8U3K` measurement above predates the newer caller-source instrumentation, so parts of that room analysis are still reconstructed from mixed telemetry.

As of 2026-04-03, the repo now captures exact source attribution for the highest-value mixed-cost paths:

- `itunesSearch`
  - stored under `organizations/{orgId}/usage/{period}.analytics.itunes_search.sources.*`
  - exact when the caller provides `roomCode`
  - current source tags include:
    - `audience_request_search`
    - `audience_tight15_search`
    - `audience_top100_artwork`
    - `host_queue_search_apple`
    - `host_catalog_search_apple`
    - `host_top100_artwork`
    - `host_bingo_artwork_lookup`
    - `host_run_of_show_apple_search`

- `youtube_data_request`
  - stored under `organizations/{orgId}/usage/{period}.meters.youtube_data_request.sources.*`
  - exact by caller surface and upstream operation class
  - examples:
    - `host_queue_search_youtube_fallback_search_list`
    - `host_queue_search_youtube_fallback_videos_list`
    - `host_queue_media_duration_lookup_videos_details`
    - `host_queue_media_embed_status_videos_status`
    - `host_youtube_playlist_index_playlist_items`

- `ai_generate_content`
  - stored under `organizations/{orgId}/usage/{period}.meters.ai_generate_content.sources.*`
  - exact by feature path
  - examples:
    - `host_trivia`
    - `host_wyr`
    - `host_bingo_board`
    - `auto_pop_trivia_song`
    - `lyrics_resolver_ai_fallback`
    - `auto_lyrics_ai_fallback`

- `apple_music_request`
  - stored under `organizations/{orgId}/usage/{period}.meters.apple_music_request.sources.*`
  - exact split between:
    - `apple_music_search`
    - `apple_music_lyrics`

- Pipeline-v2 queue lyrics
  - AI token/cost payload is now persisted on the queue song as `aiLyricsUsage`
  - this removes the need to estimate Gemini lyric cost from output size for newly processed songs

Still inferred or only partially exact:

- Hosting / CDN transfer by surface remains inferred.
- Image egress fan-out for `selfie_challenge` and `doodle_oke` still needs dedicated view telemetry if we want exact per-round media cost.
- Historical rooms from before the source-tag rollout remain mixed.

## Cost Ranking

From most expensive to least expensive:

1. Karaoke with search plus AI lyrics
2. Selfie Challenge
3. Pop Trivia overlay
4. Doodle-oke
5. Mystery Bingo setup
6. Trivia / Would You Rather / standard Bingo runtime

Important distinction:

- The biggest dollar driver is usually Gemini-backed lyrics and image handling.
- The biggest operational / quota driver is YouTube search, not Firestore or Cloud Functions.

## Feature Cost Table

All figures below are rough marginal costs if usage is billable. In many real periods, free tiers will reduce actual invoice impact to zero.

| Feature | Unit | Direct marginal cost | Main driver | Quota / abuse risk | Suggested pricing treatment |
|---|---|---:|---|---|---|
| Audience request search | per search | `$0.000001` to `$0.00001` | 1 `itunesSearch` callable | Low | Include in base plan |
| Host YouTube karaoke search | per uncached search | about `$0.000003` infra | callable + tiny function/runtime cost | High: ~101 YouTube quota units if uncached | Include only in host plans with quota caps |
| AI lyrics | per song | `$0.0008` to `$0.0012` | Gemini output tokens plus resolver work | Medium | Include in paid host plan with monthly allowance and hard cap |
| Pop Trivia overlay | per song | `$0.0006` to `$0.0010` | 1 Gemini generation | Medium | Include in paid host plan; soft-cap if needed |
| Trivia runtime | per round | `$0.00001` to `$0.0001` | vote reads / writes | Low | Include in base plan |
| WYR runtime | per round | `$0.00001` to `$0.0001` | vote reads / writes | Low | Include in base plan |
| AI trivia bank generation | per generation | `$0.0004` to `$0.0008` | 1 Gemini generation | Low | Include in paid host tools |
| AI WYR bank generation | per generation | `$0.0003` to `$0.0007` | 1 Gemini generation | Low | Include in paid host tools |
| Standard Bingo board generation | per board | `$0.0003` to `$0.0007` | 1 Gemini generation | Low | Include in paid host tools or base premium tier |
| Mystery Bingo board generation | per 5x5 board | `$0.0004` to `$0.0008` plus up to 25 iTunes lookups | Gemini plus artwork fetches | Medium | Keep in paid host plan; light cap recommended |
| Doodle-oke submission | per drawing | `<$0.0001` to `$0.0005` | Firestore doc write plus client reads of embedded image data | Medium: large Firestore docs | Premium game mode, but not high-cost enough for per-use billing |
| Selfie Challenge submission | per selfie | `$0.0003` to `$0.0015` | Cloud Storage upload plus image egress | Medium to high if many viewers / submissions | Premium game mode with submission caps |

## 150-Person Room Model

This is the practical question product and ops usually care about:

"If a room has about 150 audience members, what does one show cost to run?"

The latest measured room (`8U3K`) was an early low-interaction test, so the right approach is an envelope:

- `Low interaction`: straight scale-up of the measured show
- `Likely active room`: more songs, more audience taps, more lyrics usage
- `Heavy event room`: more songs, more engagement, more feature usage

Assumptions:

- Current Firestore and Functions pricing from public pricing pages
- Gemini pricing based on current `gemini-2.5-flash`
- Hosting egress estimated from current product behavior and prior scenario assumptions
- YouTube treated mainly as quota risk, not direct per-request dollar cost
- Apple Music request cost not modeled as a direct provider line item here

| Scenario | Audience | Show shape | Backend + AI marginal cost | Hosting / storage estimate | Total marginal cost |
|---|---:|---|---:|---:|---:|
| Low interaction / first-test style | 150 | ~18 songs, ~4.1k reactions, light mode usage | `$0.08` to `$0.09` | about `$1.05` | about `$1.13` to `$1.15` |
| Likely active room | 150 | ~35 songs, ~9.2k reactions, regular lyrics use, some Pop Trivia | `$0.14` to `$0.16` | about `$1.83` | about `$1.97` to `$1.99` |
| Heavy engagement / event room | 150 | ~50 songs, ~16k reactions, heavier AI and image usage | `$0.23` to `$0.26` | about `$2.82` | about `$3.05` to `$3.08` |

Interpretation:

- For a 150-person room, the true direct provider cost is still not huge.
- Once the room is large, frontend data transfer is likely to dominate marginal cost more than Firestore.
- Backend operations plus Gemini often stay well under a quarter per show even at this audience size.

Practical planning answer:

- Budget about `$1.25` for a low-touch 150-person show
- Budget about `$2.00` for a realistic active 150-person show
- Budget about `$3.10` for a heavy high-energy 150-person show

Operational warning:

- A 150-person room can hit YouTube quota pressure before it hits meaningful cloud-dollar pressure.
- If host search behavior is messy, repeated uncached `youtubeSearch` calls can consume a large share of the default daily YouTube Data API quota.
- This is a product-control problem more than a billing problem.

## 5-Hour YouTube-First Show Model

This is the same 150-person room model, but stretched to a full show from `7:00 PM` to `12:00 AM`.

Assumptions:

- Same audience size and engagement envelopes as the 150-person room model above
- Duration scaled from the earlier `~84 minute` room envelope to a full `300 minute` show
- Search behavior treated as YouTube-first instead of iTunes-first
- `youtubeSearch` treated as the main live search path
- No special YouTube quota uplift assumed

Important implementation detail:

- In the current callable, an uncached `youtubeSearch` performs:
  - one `search.list`
  - one `videos.list`
- That is effectively about `101` YouTube quota units per uncached search.

| Scenario | Audience | Show shape | Direct provider cost | Approx. live YouTube searches | Approx. YouTube quota burn |
|---|---:|---|---:|---:|---:|
| Low engagement | 150 | light request volume, low churn, modest host search behavior | about `$4.04` to `$4.11` | about `120` | about `12,120` units |
| Medium engagement | 150 | active room, regular queue turnover, frequent host search behavior | about `$7.04` to `$7.11` | about `300` | about `30,300` units |
| High engagement | 150 | aggressive queue turnover, high search churn, repeated fallback search | about `$10.89` to `$11.00` | about `750` | about `75,750` units |

Interpretation:

- The direct cloud-dollar cost is still not extreme.
- YouTube quota becomes the operational bottleneck much faster than GCP/Firebase billing.
- With the default `10,000 units/day` YouTube quota, even the low-engagement 5-hour scenario is already over budget if uncached searches dominate.

Practical planning answer:

- If you run a 5-hour show with YouTube-first live search, budget about `$4` low, `$7` medium, and `$11` high in direct provider cost.
- Separately, plan for YouTube quota controls, caching, or approved quota increases.

Internal reserve view:

- The repo's current reserve model treats `youtube_data_request` at roughly `1 cent` per request, not true provider spend.
- Since one uncached live YouTube search is effectively two upstream API requests, the reserve-model equivalent would be about:
  - low: about `$2.40`
  - medium: about `$6.00`
  - high: about `$15.00`
- Treat these as internal protection pricing, not actual Google invoice cost.

## Suggested BeauRocks Packaging

Recommended operator treatment:

- Base / low-cost included:
  - audience search
  - trivia runtime
  - WYR runtime
  - standard bingo runtime

- Paid host plan included:
  - YouTube search
  - AI lyrics
  - Pop Trivia
  - AI trivia / WYR generation
  - standard Bingo AI board generation
  - mystery Bingo

- Premium / protected modes:
  - Selfie Challenge
  - Doodle-oke

Reasoning:

- Trivia, WYR, and standard Bingo are too cheap to meter individually.
- AI lyrics and Pop Trivia have low absolute cost, but they are frequent enough to justify host-plan gating.
- Selfie and doodle features are not ruinously expensive, but they are the easiest places for storage, moderation, and content abuse to expand.

## Suggested Pricing Floors

These are not provider-cost pass-through numbers. They are product pricing floors that preserve margin and account for moderation, support, and abuse risk.

| Feature | Suggested pricing floor |
|---|---|
| Trivia / WYR / standard Bingo | Included in base paid experience; avoid per-round pricing |
| Pop Trivia | Include in host plan; if sold separately, treat as a small premium add-on |
| AI lyrics | Include with monthly allowance; avoid per-song guest-facing pricing |
| Mystery Bingo | Small premium add-on or bundle into a higher host tier |
| Doodle-oke | Premium mode bundle or sponsor/event add-on |
| Selfie Challenge | Premium mode bundle with explicit submission caps |

Practical packaging guidance:

- Do not nickel-and-dime cheap vote modes.
- Do not sell AI lyrics per song to hosts unless absolutely necessary.
- If a feature creates or serves images, cap usage even if the raw cloud cost still looks small.
- YouTube access should be controlled primarily by quota policy, not by per-search billing.

## Internal Meter Reality Check

Current internal meter settings in `functions/lib/entitlementsUsage.js` are much higher than true provider marginal cost:

- `ai_generate_content`
  - pass-through assumption: 2 cents per request
  - host overage rate: 3 cents per request
- `youtube_data_request`
  - pass-through assumption: 1 cent per request
  - host overage rate: 1 cent per request
- `apple_music_request`
  - pass-through assumption: 1 cent per request
  - host overage rate: 2 cents per request

These values are reasonable as reserve pricing, but they should not be mistaken for direct provider cost.

## Key Repo Behaviors Behind These Estimates

- Audience song search uses `itunesSearch` only:
  - `src/apps/Mobile/SingerApp.jsx`
- Host karaoke search uses both `itunesSearch` and `youtubeSearch`:
  - `src/apps/Host/HostApp.jsx`
- `youtubeSearch` performs two upstream YouTube calls on a cache miss:
  - `search.list`
  - `videos.list`
- `youtubeDetails` and `youtubeStatus` each perform one upstream `videos.list` call.
- Pop Trivia uses one Gemini generation per song when enabled.
- Lyrics resolution can attempt:
  - canonical cache
  - Apple Music lookup
  - Gemini fallback
- Selfie Challenge uploads JPEGs to Cloud Storage and stores metadata in Firestore.
- Doodle-oke stores compressed image data inline in Firestore docs.
- Mystery Bingo can trigger one iTunes artwork lookup per tile after AI board generation.

## Operational Recommendations

1. Instrument client surface on search call origin.
   Add a caller tag so `itunesSearch` traffic can be split into host vs audience vs artwork fetch.

2. Log token usage for the newer lyrics path.
   The room study could reconstruct logical AI attempts, but not precise token counts per song.

3. Cap image modes explicitly.
   Storage and image-view egress are where small costs can unexpectedly compound.

4. Treat YouTube as a quota-managed utility.
   Quota pressure matters more than direct dollar cost.

5. Keep cheap vote modes included.
   Their direct cloud cost is too small to justify individual pricing.

## Change Log

- 2026-04-03: Added operator-facing game mode cost sheet, measured room notes for `8U3K`, and packaging guidance.
- 2026-04-03: Added usage attribution notes covering exact caller-source telemetry for iTunes, YouTube, Apple Music, Gemini, and queue lyric AI usage.
- 2026-04-03: Added a 5-hour YouTube-first show model for 150-person room planning.
