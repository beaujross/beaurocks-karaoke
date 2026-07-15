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

## Follow-on slice: venue, host, night identity and private admission

Status: implemented and verified locally on 2026-07-14; not included in the production release evidence above.

This slice separates four concepts that were previously easy to conflate:

1. **Venue identity** is the durable place people can follow, even when its host changes.
2. **Host identity** is the entertainer people can follow across different venues.
3. **Night-series identity** is the recurring experience, such as a venue's weekly karaoke night.
4. **Room session identity** is one live BeauRocks occurrence and remains the interactive application handoff.

Weekly Host launches now publish a stable `nightSeriesId` plus explicit venue and host links. The public venue page can show upcoming interactive BeauRocks room sessions, while host and venue follow lists remain independent. Session-specific mechanics are no longer merged into the durable host or venue identity.

### Discoverability is separate from admission

Room visibility determines whether a room can be found; join policy determines what is required after it is found.

| Visibility | Admission mode | Public map/search | Exact-code path | Audience entry |
| --- | --- | --- | --- | --- |
| Public | Open guest | Yes | Yes | Room code and display name |
| Public | Account required | Yes | Yes | Room code and signed-in account |
| Public | Guest passcode | Yes | Yes | Room code plus separate guest passcode |
| Private | Open guest | No | Yes | Exact room code and display name |
| Private | Account required | No | Yes | Exact room code and signed-in account |
| Private | Guest passcode | No | Yes | Exact room code plus separate guest passcode |

The room code is a locator, not the private admission secret. The marketing Join flow may resolve an exact private room code, but it never receives or places a guest passcode in a URL. The audience application collects that passcode directly when required.

Guest passcodes are normalized and hashed with a per-room salt. Only the salted hash is stored in `room_private_access`; raw passcodes are never written to the room or directory projection. Firestore rules deny all client reads and writes to that collection, including host and moderator clients. Hosts create or rotate the passcode through callable-only room operations.

### Public experience projection

Discover cards may now surface safe, host-configured signals such as karaoke, trivia, bingo, competitive scoring, first-timer boost, fair rotation, audience voting, Would You Rather, and guest-passcode entry. These signals are a public projection, not a copy of the complete room configuration. They support map/list filtering without exposing secrets or increasing audience setup load.

### Verification for this follow-on slice

- Focused unit tests: 27 passed.
- Audience join callable integration: passed, including missing, incorrect, correct, and returning-member passcode cases.
- Host provisioning callable integration: 5 checks passed.
- Directory callable integration: 36 checks passed.
- Host room update callable integration: 35 checks passed.
- Full Firestore and Storage rules suite: passed.
- Changed-file lint: zero errors; existing Hook warnings remain in the large Host and Audience applications.
- Production Vite build: passed, including 133 prerendered marketing routes.
- Whitespace validation: passed.

### Next bounded discovery slice

1. Build the recurring occurrence engine so a night series owns multiple dated occurrences and never ages out silently.
2. Add a search-first Add or Claim Venue fork, with duplicate detection and explicit owner/host team roles.
3. Add follow notifications for venue, host, and night series independently.
4. Define stale-session archival and cancellation behavior.
5. Run manual QA for public/open, public/passcode, private/open, and private/passcode journeys before deployment.

## Follow-on slice: recurring night occurrences

Status: implemented and verified locally on 2026-07-14; not deployed.

The recurring schedule is now a three-level model:

1. `night_series` is the durable weekly identity tied to a venue, host, and canonical event or BeauRocks room session.
2. `night_occurrences` contains deterministic dated occurrences, cancellation state, and audit metadata.
3. The canonical `karaoke_events` or `room_sessions` record projects only the next scheduled occurrence for simple map, list, venue, host, and exact-code reads.

This avoids duplicate map pins while preserving actual occurrence history. Occurrence IDs are deterministic from the series and venue-local date, so rerunning the generator is idempotent. Weekly times are calculated in the venue timezone and retain the same local wall time across daylight-saving transitions.

### Generation and lifecycle contract

- Host weekly-room publication creates or refreshes the series immediately.
- Moderator approval of an independent weekly event enters the same engine.
- A six-hour scheduled function can bootstrap compatible legacy weekly records, generate a rolling twelve-week window, and advance the public next-occurrence projection only after its rollout controls are explicitly enabled.
- A host can use **Skip This Week** in the room browser. Only that occurrence is cancelled; the following week becomes the next public projection.
- Reinstatement is supported by the callable without shifting the underlying cadence.
- Scheduled occurrences older than ninety days are archived. Cancelled occurrences retain their cancellation state and audit history.
- Making a room private preserves its canonical session, exact-code entry path, and private recurring schedule while removing it from public discovery.
- Permanent room deletion removes its series and occurrence records as part of the existing room purge.

`night_series` and `night_occurrences` are not public collections. Firestore rules deny all direct client reads and writes; public and Host clients consume only safe projections or use host-authorized callables.

### Verification for the occurrence slice

- Recurrence planner and time-window unit tests: passed, including daylight-saving behavior, deterministic IDs, cancellation, and stale archival.
- Focused recurrence, discovery-card, and Host launch tests: 25 passed.
- Host provisioning callable integration: 5 checks passed with series and occurrence assertions.
- Directory callable integration: 36 checks passed with Host cancellation/reinstatement, independent moderated recurrence, public hiding, private exact-code preview, and private-series continuity.
- Full Firestore and Storage rules suite: passed.
- Changed-file lint: zero errors; existing Hook warnings remain.
- Production Vite build: passed with 133 prerendered marketing routes.

### Release-candidate controls

The scheduled occurrence roller is disabled by default. Deploying the function does not authorize it to scan or mutate production series.

Runtime controls:

- `DIRECTORY_OCCURRENCE_ROLL_MODE=off|canary|all` defaults to `off`.
- `DIRECTORY_OCCURRENCE_CANARY_SERIES_IDS` is a comma-separated allowlist, capped at 25 IDs. Canary mode will not fall back to an all-series query if the list is empty.
- `DIRECTORY_OCCURRENCE_BOOTSTRAP_ENABLED` defaults to `false` and is ignored outside `all` mode.
- `DIRECTORY_OCCURRENCE_ARCHIVE_ENABLED` defaults to `false` and is ignored outside `all` mode.
- Bootstrap and normal roll limits are independently bounded by `DIRECTORY_OCCURRENCE_BOOTSTRAP_LIMIT` and `DIRECTORY_OCCURRENCE_SERIES_LIMIT`.

Every scheduled invocation emits a structured `roll skipped`, `roll completed`, or `roll failed` log with rollout mode, duration, scan counts, failures, and mutation gates. Canary runs address the allowlisted series documents directly; they neither bootstrap legacy listings nor archive old occurrences.

### Pre-deployment gate

1. Freeze this connected slice and review the complete diff. Do not mix unrelated product work into the release candidate.
2. Run `npm run ops:audit:directory-occurrences -- --project <project-id> --report artifacts/directory-occurrence-preflight.json` with application-default credentials. The command is read-only.
3. Resolve invalid anchors, invalid timezones, invalid end times, duplicate series references, missing series documents, and active series with missing sources. If a collection reaches the audit scan limit, increase the bounded limit and confirm coverage.
4. Run the automated unit, directory callable, rules, lint, and production-build gates.
5. Manually verify:
   - public/open, public/account, and public/passcode admission;
   - private/open and private/passcode exact-code admission;
   - private rooms never appear on the public map or list;
   - passcodes never appear in room, listing, preview, logs, or browser network payloads;
   - map and list cards show the same next occurrence;
   - Skip This Week advances exactly seven venue-local days and Reinstate restores it;
   - after-midnight and daylight-saving fixtures retain their venue-local start time;
   - an approved independent weekly event produces one map pin, not one per occurrence.
6. Deploy indexes, rules, and functions while roll mode remains `off`; deploy hosting only after those surfaces are healthy.
7. Smoke-test exact-code join, public discovery, Host launch, and Skip This Week with the scheduler still off.
8. Enable `canary` for one or two reviewed series, observe at least two scheduled invocations, and compare source projections and generated occurrences before and after each run.
9. Move to `all` with bootstrap and archival still false. Enable bootstrap only after the production audit is clean. Enable archival last, after reviewing the stale-occurrence sample.

Rollback is to restore `DIRECTORY_OCCURRENCE_ROLL_MODE=off` and redeploy only the scheduled function configuration/code. The occurrence writes are idempotent; cancellation history must not be deleted during rollback.

### Next bounded discovery slice

Build the search-first **Add or Claim Venue** fork. The flow should search canonical venues before creation, route an existing venue to a moderated claim, prevent duplicate creation, and establish explicit owner, manager, and host team roles without adding decisions to the audience journey.
