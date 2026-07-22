# Public Brand, Charts, and Product Story Audit

Date: 2026-07-21

## Executive read

BeauRocks already has the right product story in its architecture: a karaoke night is one coordinated room expressed across the host console, public TV, singer phones, recaps, discovery listings, and public charts. The visual system also has a recognizable core—dark room-like surfaces, cyan and pink energy, warm award accents, bold condensed display type, and compact operational UI.

The main gap is not a missing brand. It is that the same system is described differently from surface to surface. Marketing leads with a room-wide party game, Discover leads with trustworthy listings, the product leads with live room operations, and Charts previously looked like a generic data table. Charts can be the bridge: the public proof that energy created in a real room becomes a durable song, singer, and karaoke-night story.

The recommended public narrative is:

> Find the room. Pick the song. Move the crowd. Take the crown.

## Surface map

### Public acquisition

- `/` (`ForFansPage`) establishes the room-wide party-game promise and routes people by role.
- `/for-hosts` turns that promise into an operator workflow and waitlist.
- `/for-venues` focuses on trustworthy listings, cadence, and ownership.
- `/for-performers` focuses on finding repeat-worthy rooms and building a routine.
- `/demo` and `/auto-demo` explain how the host, TV, and audience surfaces move together.

### Public utility and SEO

- `/discover` is the primary directory and blends rooms, recurring nights, events, and venues.
- `/karaoke/:region` and `/karaoke/us/:state/:city` provide indexable geographic landing pages.
- `/venues/:id`, `/events/:id`, `/hosts/:id`, and `/performers/:id` are public entity pages.
- `/charts` is an indexable community proof surface.
- Static venue cards, sitemap generation, canonical routing, Open Graph metadata, and JSON-LD already exist.

### Product surfaces

- `SingerApp` is the phone-level participation surface: join, request, react, perform, and view room standings.
- `HostApp` is the operating deck: setup, queue, playback, games, moments, moderation, and recap control.
- `PublicTV` is the shared room stage: now playing, participation prompts, leaderboards, awards, and recaps.
- `RecapView` turns the live night into a lasting artifact.

### Existing chart data

- `public_chart_members` ranks singers by cumulative qualified score.
- `public_chart_songs` keeps the single best qualified performance for each underlying song.
- `public_chart_nights` ranks approved public nights by cumulative qualified score.
- A public song identity intentionally ignores which Apple, YouTube, upload, or custom backing version was used.
- Guests remain visible inside their live room but do not enter the public charts.

This foundation is privacy-aware and moderation-aware. Public projections omit private user IDs, use a hashed member key, respect anonymous chart identity, and can be rebuilt after result moderation.

## Naming system

`canonical song` should remain an engineering and operations term. It accurately describes the durable identity in storage, but it asks the public to understand data modeling before they understand the game.

Use this public vocabulary:

| Internal concept | Public language | Use |
| --- | --- | --- |
| Canonical song | Song | Default label everywhere |
| Canonical grouping | One song, one leaderboard | Explain why different backing versions compete together |
| Backing rendition | Backing version | Explain choice without provider jargon |
| Best song result | Song crown / top score | Emotional headline and compact stat label |
| Best performer | Crown holder / song champion | Identity attached to the current top score |
| Synthetic low threshold | Opening score | Transparent launch-state label |
| Member aggregate | Singer momentum / chart points | Avoid implying it is a single best vocal score |
| Night aggregate | Night momentum / night points | Avoid implying smaller and larger rooms are directly equal |

“Song record” is useful explanatory language, but “song crown” is the stronger repeatable game mechanic. The recommended pairing is: “Every song has a record. Beat it to take the crown.”

## Current strengths

1. The room is the unifying product object. Marketing and product both repeatedly frame TV, phones, and host controls as one shared moment.
2. The palette is recognizable. Cyan communicates live participation and system state, pink communicates performer energy, and gold already feels natural for awards and first place.
3. The underlying chart trust boundary is stronger than the old visual treatment suggested. Qualification, approved-host gating, identity privacy, reporting, moderation, and projection repair already exist.
4. Directory SEO has useful primitives: canonical paths, sitemap entries, social cards, entity-specific JSON-LD, and geographic landing pages.
5. The browse catalog already supplies a curated, understandable set of popular karaoke songs, which is a much better launch source than an unrelated hard-coded chart list.

## Friction and inconsistency

### Story

- The old Charts hero led with account qualification rather than the emotional payoff.
- “Canonical song” appeared in customer-facing chart copy and SEO descriptions.
- The chart tabs looked equivalent even though they rank different measures.
- Empty charts communicated absence, not a challenge waiting to be claimed.
- Discover only teased member rankings, so an empty singer chart made the whole system appear inactive even when songs could still create a compelling entry point.

### Visual language

- Marketing uses a cinematic dark stage, but directory cards become more utilitarian and charts previously collapsed into simple rows.
- Product surfaces carry stronger live-state and award moments than the public site. The public site should reuse their visual grammar without pretending to be the control UI.
- Rank, score, verification, live state, and crown state do not yet share a single cross-surface component contract.
- Several public entity pages use an `h2` for the visible entity title. Their JSON-LD is strong, but a consistent single visible `h1` per indexable detail page would improve semantic clarity and page hierarchy.

### Data semantics

- Singer `rankScore` is cumulative, so it rewards both participation and performance.
- Night `rankScore` is cumulative, so it also reflects room volume.
- Song `bestScore` is a single-performance high score.
- The current public song projection stores only the champion. It cannot honestly render the top three performances for one song yet.

Those measures are all valid, but their labels should state what they reward. A later ranking revision could add weekly windows, normalized momentum, or separate “most active” and “highest average” views without changing the song-crown mechanic.

## Implemented first pass

- Charts now open on Songs, the easiest mechanic to understand and the best bridge from browse catalog to live performance.
- The hero uses “Every song has a score to beat” and “One song, one leaderboard.”
- A three-step story explains song choice, room energy, and the crown.
- The top three entries use a podium treatment; ranks four through ten remain compact rows.
- Ten deterministic opening scores come from the existing `Popular Right Now` browse catalog.
- Opening scores are deliberately low (9–24), clearly labeled, and presentation-only.
- A real public song result replaces the matching opening score even when its stored song ID differs but normalized title and artist match.
- Discover falls back to the top three song challenges when no public singer leaders exist.
- The public SEO description no longer exposes “canonical songs.”

The opening-score choice is intentional. Writing fake performances or fake singers into Firestore would contaminate moderation, counts, public night aggregates, and trust. Presentation-only opening scores create the arcade high-score effect while preserving a clean evidence boundary.

## Cross-surface design grammar

### Color roles

- Cyan: live, connected, eligible, participatory.
- Pink: performer, reaction, crowd energy, primary score.
- Gold: crown holder, verified winner, first place, earned permanence.
- Ember/orange: conversion and invitation, used sparingly.
- Deep navy/ink: the room and shared-stage foundation.

### Reusable visual objects

1. **Song identity block** — art, title, artist, and optional backing-version context.
2. **Score lockup** — large number, explicit metric label, and qualification state.
3. **Rank disc** — consistent rank treatment for lists and compact surfaces.
4. **Crown mark** — reserved for a current best, never used for an opening score.
5. **Live pulse** — reserved for an active or joinable room, not general decoration.
6. **Trust line** — approved host, qualified result, opening score, anonymous singer, or reported state.

The same objects can appear at different scales:

- Public TV: full-screen crown change and top-three moment.
- Singer app: personal challenger card and “score to beat.”
- Host app: operational confirmation that a result qualified and projected.
- Recap: crown won, defended, or narrowly missed.
- Marketing charts: public podium and top ten.
- Venue/event listings: latest crown moment as social proof, only when evidence-backed.

### Motion language

Use motion for a state change, not ambient noise:

- a crown lifts from the old holder to the new holder;
- the former champion moves into the challenger rail;
- a score counter resolves once, then rests;
- a live-room pulse indicates a currently joinable session;
- opening scores should not animate like earned wins.

## Recommended data evolution

### Phase 1: launch state (implemented)

Keep opening scores client-side, deterministic, transparent, and limited to ten popular catalog songs.

### Phase 2: real challenger ladders

Add a sanitized top-three projection per song, for example:

`public_chart_song_leaders/{songId}/leaders/{resultId}`

Each record should contain only public-safe fields: result ID, member key, display name, identity visibility, avatar URL when allowed, score, applause tie-break value, qualified night label, and timestamp. Update this projection in the same server transaction that updates `public_chart_songs`, and rebuild it in the existing moderation flow.

Do not expose or directly query raw `performances` from the public client.

### Phase 3: flywheel

- Add “songs near you” and “crowns won at this venue” to public listings.
- Give singers a “three crowns within reach” module based on songs they have performed or browsed.
- Give hosts a post-performance crown cue for Public TV.
- Add weekly crown changes to recaps and share cards.
- Add an evidence-backed ItemList JSON-LD snapshot for real chart leaders; do not include opening scores as achievements.

### Phase 4: ranking clarity

- Rename cumulative singer and night totals to “momentum” in UI, or add a clearly documented formula.
- Add weekly and all-time windows once there is enough density.
- Consider separate “top score,” “most performed,” and “crowd favorite” song views only when each has enough real data.

## SEO priorities

1. Keep `/charts`, `/discover`, geographic pages, and approved entity pages indexable.
2. Use “karaoke high scores,” “top karaoke songs,” “karaoke leaderboard,” and local karaoke intent naturally; avoid technical identity vocabulary.
3. Give every indexable venue, event, host, and performer page one visible `h1` aligned with its metadata title.
4. Create a dedicated social card for Charts rather than reusing the generic clean marketing image.
5. Once real chart density exists, add server-generated chart summaries and ItemList structured data.
6. Keep sessions, account pages, submission flows, and moderation noindex as they are today.

## Product story by moment

The cleanest cohesive story is chronological:

1. **Find it** — Discover and venue/event pages make a night trustworthy.
2. **Join it** — The singer app connects a phone to the shared room.
3. **Shape it** — Requests, reactions, games, and host decisions move one TV moment.
4. **Perform it** — Any backing version still belongs to one song leaderboard.
5. **Win it** — A qualified performance can take the song crown.
6. **Keep it** — Charts, profiles, listings, and recaps preserve what happened.

Every major page should own one of those verbs. Repeating this sequence across acquisition copy, demo choreography, product empty states, recaps, and release materials will make BeauRocks feel like one system rather than several capable applications sharing a logo.
