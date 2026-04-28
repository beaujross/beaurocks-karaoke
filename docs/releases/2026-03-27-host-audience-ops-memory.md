# 2026-03-27 Host + Audience Ops Memory

This note captures product and engineering lessons that should outlive the immediate implementation details.

## Audience Shell Stability

- `SingerApp.jsx` remains a high-regression file because many room states are handled through top-level conditional rendering.
- The recurring crash class has been:
  - hooks declared after render boundaries
  - derived values referenced before initialization from an early-return branch
- Treat this as an invariant:
  - no hooks after any render boundary
  - no branch may reference later-initialized render data
- Keep `tests/unit/singerAppHooks.test.mjs` aligned to the real component structure whenever the audience shell changes.

## Audience Join Requires Real Auth Bootstrap

- A wait helper is not enough if nothing actually starts auth.
- On 2026-04-14 the live matrix exposed that `waitForJoinAuthUid()` could sit on a cold session unless the audience shell explicitly called `initAuth()` on load or before join.
- Durable rule:
  - if the audience shell depends on auth state, it must bootstrap auth as part of initial room entry
  - do not assume some unrelated later flow will initialize it in time

## Session Identity Has Layers

- There are at least three useful identity layers in the audience shell:
  - current Firebase auth UID
  - auth-ready/session UID known to the shell
  - room-user identity already participating in a live takeover
- Product and QA should not assume these always become available in the same order.
- Use the weakest identity that satisfies the product need:
  - usable audience shell for most gameplay smoke
  - auth-backed UID only when seeding or account writes require it

## QA Should Follow Real Product States

- A takeover screen is not a failed join just because it bypasses the classic idle main shell.
- On 2026-04-14 the matrix initially misread a live bracket audience screen as a join failure.
- Durable rule:
  - if host, audience, or TV can validly land in a state during normal product behavior, QA should model that state directly
  - avoid overfitting automation to one happy-path shell

## Song Requests Should Stay Song-First

- The durable product decision is `song intent -> backing resolution`, not `let the audience search YouTube directly`.
- Audience Apple Music search is used to identify the intended song cleanly.
- Backing selection should be internal:
  - trusted catalog
  - room/host-curated YouTube library
  - host review for unknowns
- Unknown songs should never dead-end silently; they must surface in a clear host review lane.

## Host Review Must Have an Escape Hatch

- A host getting stuck on an unresolved request is a product failure, not just a missing convenience.
- The unresolved-review surface must always offer:
  - a direct host-search path for YouTube backing selection
  - a direct request edit path
  - optional save-to-room-library behavior
- The room YouTube library should improve with real performance outcomes, not just raw additions:
  - usage count
  - success count
  - failure count

## Auto-End Must Follow Live Playback Reality

- Auto end on finish should not trust stale request metadata if a more accurate backing duration is available at stage start.
- Capture performance-start playback duration when the singer takes the stage and schedule auto-end against that captured value.
- This matters especially when a host changes or resolves backing after the original request was created.

## Co-Host / Operator Access Is Still Split

- Room-level host access and run-of-show co-host capability are separate concerns.
- This distinction keeps surfacing in UX and support questions.
- Product copy should not imply that a co-host capability flag alone gives someone a usable operator experience.
- The recommended long-term direction remains a room-scoped mobile backstage mode that is hidden from standard audience users.

## Event Credits Should Not Depend on Shared Secrets

- Guest-first event participation is the correct default.
- Reusable shared claim codes are too weak for paid or scarce rewards such as VIP or skip-line.
- Preferred models:
  - Givebutter or ticket-linked attendee entitlements
  - promo campaign records with limits, scope, and redemption auditing
  - shared/manual codes only as a low-risk fallback for non-scarce promo points

## Event Promo Language Should Match What The System Actually Knows

- `Website check-in` and `social promo` messaging should not imply proof of an external action if the product only knows the join source.
- Durable product direction:
  - automatic bonus from official event website links
  - automatic bonus from official social links
  - automatic donation recognition from Givebutter webhook data
  - no host verification step
  - no guest-facing “claim your bonus” friction unless there is a real secure reason
- Preferred language is `automatic bonus` or `official-link bonus`, not `claim code`, `check-in proof`, or `follow us and claim`.

## Operational Playback Confidence Tiers

- Treat playback reliability in tiers:
  - trusted: known room/global backings inside BeauRocks
  - fallback: legal local uploaded media files BeauRocks can play directly
  - emergency: operator-side YouTube Premium offline crate as a manual continuity plan
- Important distinction:
  - YouTube Premium downloads may be useful operationally for the host as an emergency crate
  - they are not a clean system-level BeauRocks offline library integration path

## Host Communications Should Converge, Not Multiply

- Requiring a live host to monitor separate `Chat`, `Tell Host`, `Inbox`, and moderation surfaces is a product smell.
- Durable product direction:
  - one primary live communication destination for the host
  - source badges and source-specific actions can remain
  - the operator should not need multiple places just to stay aware of the room
- If different communication models exist temporarily, the product copy should still present a single clear primary place to look first.

## Run Of Show Direction

- The `Show` workspace should keep moving toward a studio shell:
  - moment shelf
  - master timeline
  - focused inspector
- The product should feel closer to a sequence editor than a settings form.
- `Build / Run / Review` separation is the right direction; continuing to stack forms and dropdowns will keep failing the intuition test.

## Post-Performance Moments Should Be Explicit Show Beats

- `Next Up`, leaderboard reveals, applause, donation, and support beats are not just visual leftovers after a song; they are programmable room moments.
- Hosts should be able to stage or trigger these moments intentionally, with detailed timing living in settings/admin rather than cluttering the live rail.
- The live host surface should keep simple pacing controls; exact per-beat timing belongs in the deeper settings layer.

## Live Event Room Contract (AAHF / May 1)

- Treat the May 1 event room as a persistent production room, not a throwaway rehearsal room.
- The canonical room code is `AAHF`.
- Discovery, join poster QR, and direct room entry should all converge on `/join/AAHF`.
- The audience should not be asked to re-solve room-code entry after selecting a known event from Discovery.
- Event-day operational priority is:
  - one real room
  - one join path
  - one host
  - no blank stage

## Room Browser Truthfulness Matters

- A room browser labeled `All rooms` should not silently mean `the recent capped subset`.
- If rooms are filtered, capped, pinned, or bucketed by recency/upcoming state, the product should expose that honestly.
- Durable direction:
  - no misleading fake-all lists
  - important rooms can be pinned
  - switching folders should keep the results surface obvious and nearby rather than hidden far down the page

## Host Responsive Design Should Reprioritize, Not Just Shrink

- The smallest host breakpoints fail when too many regions stay bulky, but that does not automatically mean the answer is to hide critical surfaces early.
- Durable direction:
  - preserve trust surfaces like preview in a compact form before removing them
  - tighten density and proportions at medium widths before forcing single-column collapse
  - do not assume fewer visible regions is always better for operator software

## Continuity Rule

- `Fail gracefully` in this product means the room never falls into a blank stage or dead-air state.
- Continuity should be handled inside one transition policy, not by letting Auto DJ, dead-air filler, Run Of Show, and fallback features act like separate controllers.
- Run Of Show remains the planner of record.
- Coverage / fallback behavior is a temporary bridge back into the planned flow, not a replacement runtime.
