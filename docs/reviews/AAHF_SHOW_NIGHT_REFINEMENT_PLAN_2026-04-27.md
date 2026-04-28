# AAHF Show-Night Refinement Plan

Date: April 27, 2026  
Event: May 1, 2026  
Scope: small tweaks and visual refinements only; no structural rebuilds

## Goal

Make the AAHF kickoff feel like one coherent festival experience across:

- audience join and request flow
- host run-of-show board and show slides
- Public TV takeover visuals

This brief folds in production smoke findings, before/after review screenshots, and operator-ready priorities for the final days before the event.

## Screenshot Review Set

### Live Audience Flow

- [audience-join-route-live.png](../../public/print/screenshots/review/audience-join-route-live.png)
- [audience-identity-live.png](../../public/print/screenshots/review/audience-identity-live.png)
- [audience-house-rules-live.png](../../public/print/screenshots/review/audience-house-rules-live.png)
- [audience-browse-live.png](../../public/print/screenshots/review/audience-browse-live.png)
- [audience-queue-live.png](../../public/print/screenshots/review/audience-queue-live.png)

### Host Run-Of-Show Before / After

- [host-run-of-show-generic.png](../../public/print/screenshots/review/host-run-of-show-generic.png)
- [host-run-of-show-aahf.png](../../public/print/screenshots/review/host-run-of-show-aahf.png)

### Public TV Before / After

- [tv-intro-generic.png](../../public/print/screenshots/review/tv-intro-generic.png)
- [tv-intro-aahf.png](../../public/print/screenshots/review/tv-intro-aahf.png)
- [tv-announcement-generic.png](../../public/print/screenshots/review/tv-announcement-generic.png)
- [tv-announcement-aahf.png](../../public/print/screenshots/review/tv-announcement-aahf.png)

### Metrics

- [visual-review-metrics.json](../../public/print/screenshots/review/visual-review-metrics.json)

Key measured outputs:

- Public TV takeover headline size is `256px` in both generic and AAHF visual scenarios.
- Host run-of-show meta headings are small (`10px` to `12px`) because they are operator labels, not room-facing slide headlines.

## Findings

### Audience

The live `AAHF` room now lands in the streamlined singer shell and correctly tells the story `join -> browse -> queue`.

What improved:

- the join landing now feels less procedural and more like a live room handoff
- the browse screen now has one dominant CTA
- queue view is much easier to parse
- the festival identity remains visible without burying the task

What still hurts:

- the house-rules modal still interrupts momentum even though the copy is shorter
- the join route still looks more like product chrome than a festival arrival surface

### Host Run-Of-Show

The before/after comparison on the host run-of-show board is weak.

The generic BeauRocks version and the AAHF version are visually almost identical:

- same layout language
- same conveyor styling
- same visual weight
- no obvious festival takeover feeling

Interpretation:

- the room theme is not materially carrying through the host run-of-show board yet
- this is acceptable operationally for May 1, 2026, but it is not strong enough if the goal is a true festival-branded control surface

### Public TV

The Public TV before/after comparison is much stronger.

What works:

- AAHF colors shift the entire tone of the slide
- headline size is large enough for room readability
- the AAHF badge makes the slide feel event-specific

What still needs refinement:

- some subhead/body copy still reads like internal software direction instead of event presentation
- the background and lower information rails are still more product-like than show-like

## Grades

### Audience

- Join landing: `B+`
- Identity screen: `B+`
- House-rules interruption: `C`
- Browse/search first screen: `A-`
- Queue screen: `A-`
- Overall audience production flow: `B+`

### Host / TV Visuals

- Host run-of-show board festival branding: `C`
- Public TV intro slide festival branding: `B+`
- Public TV announcement slide festival branding: `B+`
- Text size / distance readability on TV: `A-`
- End-to-end “festival moment” feeling across all screens: `B-`

## Suite Review

### CTO

The product is now operationally safer than it was before the streamlined shell was turned on for `AAHF`.

CTO read:

- keep scope tight
- do not restructure host or TV systems this week
- invest in defaults, copy, and presentation polish
- add a daily config verification step so `AAHF` cannot silently drift back to classic behavior

CTO take on the new visual requirement:

- valid and worth doing
- should stay in theme, copy, and presentation layers
- should not turn into a new rendering system or slide architecture change

### Product Manager

The audience journey is now mostly correct, but the room still teaches guests some unnecessary friction.

PM read:

- the house-rules step remains the biggest conversion leak
- the browse-first singer shell is finally working
- the host board is functionally good enough, but it does not reinforce the event identity strongly
- Public TV is the clearest place to create emotional lift without destabilizing the product

PM take on the visual requirement:

- this matters because the event is taught by ambient screens, not just by the guest phone
- run slides and TV visuals are part of onboarding in the room

### CMO

The product now carries the AAHF brand better on the guest phone and on TV than it does on the host run-of-show surface.

CMO read:

- the join and singer screens are now much closer to the poster promise
- the TV slides can plausibly feel like festival moment graphics
- the host board still feels like software first and branded event second

CMO take on the visual requirement:

- correct requirement
- overdue requirement
- should have been elevated earlier because live room screens are part of the campaign, not just support surfaces

## Challenge To CMO

Why are you not pushing harder to make this a real festival brand moment?

If the event is positioned as a festival kickoff, then the standard cannot stop at:

- “the posters are branded”
- “the QR works”
- “the app is functional”

The actual room experience is made of:

- posters
- phone flow
- host slides
- Public TV graphics
- stage typography and pacing

Right now the Public TV layer is starting to feel like AAHF, but the host run-of-show surface still looks mostly like generic product UI. If this is meant to be a brand-defining event on May 1, 2026, the CMO should be pressing harder on:

- more visual takeover in room-facing surfaces
- more event-language and less system-language
- more consistency between poster, app, and TV
- stronger judgment of readability and atmosphere, not just correctness

That pressure is healthy. It does not require a rebuild. It requires sharper standards.

## Final-Day Plan

### P0 - April 28, 2026

- keep `AAHF` locked to `audienceShellVariant: streamlined`
- soften the house-rules modal
- tighten join-page copy so it sounds live, not procedural

### P1 - April 29, 2026

- reduce friction and competition around `Search + Add Song`
- sharpen queue-state confidence copy
- make Public TV subhead/body copy read more like event copy and less like operator notes

### P1 - April 30, 2026

- refresh walkthrough and poster screenshots from the live streamlined room
- capture final run-of-show and TV proof images for show-night ops

### P0 - May 1, 2026

Run a production smoke that checks:

- QR path
- join flow
- house-rules step
- streamlined browse/queue flow
- `AAHF` shell config
- host run-of-show visual readiness
- Public TV intro / announcement readability

Required command:

- `npm run qa:release:aahf:prod`

What this gate now enforces:

- the poster QR asset still resolves to `https://app.beaurocks.app/?room=AAHF`
- the live `AAHF` room still uses `audienceShellVariant: streamlined`
- the live `AAHF` run-of-show takeover copy is still current
- the direct app arrival path still lands on join -> rules -> browse in production

## Recommended Next Tweaks

These are the highest-value safe changes before show night:

1. Rename the rules CTA from `Let's go` to `Agree and Continue`.
2. Compress the rules copy into 2 short lines.
3. Replace join-page “checking room” tone with event-ready wording once the room is confirmed.
4. Tighten Public TV subhead text so it sounds like show language, not internal product explanation.
5. If time allows, add one stronger AAHF-specific visual cue to the host run-of-show board so the board no longer looks identical before and after theme application.
