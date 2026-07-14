# Public Discovery Flow Audit

Date: 2026-07-14
Scope: marketing discovery, maps, scheduled visibility, privacy, BeauRocks-hosted rooms, independent karaoke listings, claims, and moderation.

## Executive assessment

The product already has the right primitives for a trustworthy karaoke directory: canonical venues, karaoke events, BeauRocks room sessions, authenticated submissions, ownership claims, moderation, reviews, follows, check-ins, and geo landing pages. The primary gap was not missing infrastructure; it was that public behavior was inconsistent across callables and the public path to contribute a listing was too hard to discover.

This pass makes the intended model explicit:

1. A venue using BeauRocks publishes a discoverable room from Host setup. Public rooms may appear in Discover; private rooms do not.
2. A venue or host not using BeauRocks creates a free account and submits a venue or recurring karaoke night. It appears only after moderation.
3. A private BeauRocks room remains absent from public maps and search, but a guest who already has its exact room code can use the separate join-preview path.

## Architecture and data flow

Public Discover reads a server-curated result from `listDirectoryDiscover`; it does not assemble unrestricted client-side collection reads. The callable combines:

- `venues`: the durable physical or virtual venue identity.
- `karaoke_events`: a scheduled or recurring karaoke night.
- `room_sessions`: a specific BeauRocks-powered room, optionally linked to a venue.
- official registry records: curated BeauRocks listings with elevated trust signals.

Map geo pages use `listDirectoryGeoLanding`. Independent submissions enter `directory_submissions` as `pending`; moderator approval writes the canonical venue, event, or room-session record. Claim requests enter the claim moderation queue and, when approved, assign ownership on the canonical entity.

Host publication is separate from the independent submission queue. Room provisioning or a later visibility change upserts an approved `room_sessions` listing tied to the room and host. Making the room private removes it from public discovery.

## Visibility and privacy contract

| Record | Public map/search | Exact room-code preview | Publication path |
| --- | --- | --- | --- |
| Approved public venue | Yes | Not applicable | Moderated submission or moderator tooling |
| Approved private venue | No | Not applicable | Owner/moderator only |
| Approved public event | Yes | Not applicable | Moderated submission or moderator tooling |
| Approved private event | No | Not applicable | Owner/moderator only |
| Public BeauRocks room session | Yes | Yes | Host setup / room visibility control |
| Private BeauRocks room session | No | Yes, when the guest already knows the exact code | Host setup / room visibility control |
| Pending or rejected submission | No | No | Submission moderation queue |

The exact-code preview is deliberately not a discovery API. It supports an invited guest joining a private room without revealing that room through search, map, or geo landing pages.

## Time contract

Discover sends the viewer's IANA timezone to the callable. Server filtering now uses that timezone and respects a declared end time.

- **Now:** active listings plus listings starting within one hour. Ended listings are excluded.
- **Tonight:** the viewer's local karaoke service night, defined as 5:00 PM through 2:00 AM. After-midnight listings remain part of the prior evening.
- **This week:** active or upcoming listings in a rolling seven-day window.
- **All times:** the broad directory, including venues and records without a concrete start time.

When an event has no end time, filtering assumes a six-hour duration. This is a compatibility fallback, not a replacement for collecting an accurate end time.

## Map and location contract

A listing needs a valid latitude and longitude to receive a map pin. Text-only location data may still appear in list results and can be geocoded during submission. Empty Host coordinate fields no longer coerce to `(0,0)` in either the client payload or the backend upsert path.

Public venue and event visibility is enforced in both the general Discover callable and geo landing callable. That prevents callable responses from bypassing Firestore's direct-read privacy rules.

## Venue-owner journeys

### Path A: run the night with BeauRocks

1. Enter Host setup and create or select the room.
2. Choose Public discovery rather than Private.
3. Add the venue and scheduled start; the browser timezone is attached automatically.
4. Launch the room. BeauRocks creates the linked public room-session listing.
5. Change the room to Private to remove it from public discovery.

### Path B: list an independent karaoke night

1. Open **For Venues** or the visible **List Your Karaoke Night** action on Discover.
2. Create or sign into a full BeauRocks account.
3. Submit a venue page or karaoke night/event with real location, timezone, and schedule.
4. The submission remains private while pending.
5. A moderator approves it into the public directory.

### Claim an existing venue

Open the existing venue entity page and use its ownership action. Claims remain moderated so a public listing cannot be silently taken over. The contribution CTA now says **Add Or Claim A Venue**, but the next UX slice should distinguish “add new” from “claim existing” before opening a form.

## Changes completed in this pass

- Removed the accidental suppression of non-official public Host room sessions.
- Applied public visibility filtering consistently to venues, events, and room sessions.
- Prevented private venue/event leakage through geo landing callables.
- Added viewer-timezone-aware Tonight filtering with after-midnight carry.
- Made Now, Tonight, smart ranking, and This Week aware of event end times.
- Prevented blank Host coordinates from becoming a `(0,0)` pin.
- Attached the Host browser timezone automatically without adding setup workload.
- Added a clear two-path venue journey and a prominent Discover contribution CTA.
- Added listing timezone input and clearer independent-listing language.
- Added unit, source-contract, and emulator integration regression coverage.

## Remaining risks and next slice

These are not safe to hide inside a filtering patch and should be treated as the next bounded discovery slice:

1. **Recurring occurrence engine:** recurrence is stored as schedule metadata plus a next occurrence. A scheduled job or deterministic read model must expand and roll occurrences forward so recurring nights never silently age out.
2. **Expiration and stale-room policy:** define when ended room sessions leave All Times and when abandoned public rooms are archived. Time filters are correct, but the broad directory intentionally preserves legacy records today.
3. **Add-versus-claim fork:** search for an existing venue first, then route the owner to Claim or Create New. This prevents duplicates and makes the Yelp-like contribution model understandable.
4. **Moderation operations:** publish ownership, response-time, duplicate-resolution, and abuse-escalation SLAs. A submission flow without an operating queue is not a complete marketplace loop.
5. **Venue-local display:** filters use viewer time by design; entity cards should also label the venue timezone when viewer and venue timezones differ.

## Success measures

- Zero private or pending records returned by public Discover or geo callables.
- Zero blank-coordinate `(0,0)` pins.
- At least 95% of scheduled public events include timezone, start, and end data.
- Median independent-submission moderation time under two business days.
- Fewer than 2% duplicate venue creation rate after the add-versus-claim fork.
- No recurring approved night disappears because its stored next occurrence became stale.
- Track conversion separately for **Use BeauRocks To Run It**, **List An Independent Night**, and **Claim Existing Venue**.

## Release evidence

- Focused unit/source-contract tests: 22 passed.
- Directory callable emulator integration: 36 passed.
- Changed-file lint: zero errors; existing Host hook warnings remain.
- Production build: passed, including 133 prerendered marketing routes.
- Host deep-link probe: lands on `run_of_show / show.timeline` before interaction.
- Production functions: four scoped updates deployed with zero errors (`listDirectoryDiscover`, `listDirectoryGeoLanding`, `upsertHostRoomDiscoveryListing`, and `provisionHostRoom`).
- Production hosting: Firebase version `cd2ec8a90951c7bc`; both the public and Host domains return the built `index-CwfGgLTq.js` entrypoint.
- Production callable probe: `listDirectoryDiscover` returned `ok: true` with an explicit viewer timezone.
