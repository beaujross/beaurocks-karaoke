# Audience Backing Selection Spec

Last updated: 2026-04-04
Owner: Product / Host + Audience surfaces

Companion doc:

- `HOST_OPERATOR_UI_SIMPLIFICATION_SPEC.md`
  - source of truth for the host-side live UX simplification
  - defines queue/search/stage layout rules and host interaction budget
- `RUN_OF_SHOW_LOW_INTERACTION_SPEC.md`
  - source of truth for low-interaction runtime behavior when run of show is active
  - defines build vs preflight vs live ownership and blocker handling

## Goal

Reduce host workload for song matching without turning the audience request flow into raw YouTube chaos.

The desired product shape is:

- audience searches for the song identity first
- audience may optionally choose from ranked backing versions
- unknown backing versions may be allowed into the queue without host approval
- host feedback after a performance improves future ranking
- `bouncerMode` remains about queue admission, not backing resolution

## Current State

The current system already has most of the primitives needed:

- audience requests canonicalize first via `resolveSongCatalog`
- audience can attach a direct YouTube backing URL in `guest_backing_optional`
- unresolved requests become `review_required`
- host review already ranks candidates using:
  - room-local trusted catalog
  - room-local YouTube index
  - global track records
- host can already give a YouTube backing `Prefer` / `Avoid`
- the stage panel already shows a `Last Backing Review` card after a performance

Important current implementation behavior:

- `bouncerMode` currently sets every new audience request to `pending`
- `resolutionStatus` separately determines whether backing is resolved or needs review
- explicit backing preference is mostly room-local today
- successful performances update global `tracks` usage / success signals

## Product Model

Split this into two independent axes.

### 1. Backing Policy

This controls what the audience can do about backing selection.

- `canonical_only`
  - audience searches songs only
  - system uses existing trusted / approved backing if found
  - unresolved requests may still go to host review

- `canonical_plus_approved_backings`
  - audience searches songs first
  - for each canonical song, show only approved / trusted backing versions
  - audience cannot pick unknown live YouTube results

- `canonical_plus_audience_youtube`
  - audience searches songs first
  - for each canonical song, audience can expand and choose from ranked YouTube backing versions
  - unknown backing handling is controlled by a separate policy

### 2. Queue Admission Policy

This controls whether the host must admit the request into the queue.

- `open_queue`
  - accepted requests enter the queue immediately as `requested`

- `bouncer_mode`
  - accepted requests enter as `pending`
  - host admits them later

This should remain independent from backing selection.

### 3. Unknown Backing Policy

This controls how unproven YouTube backing results behave.

- `require_review`
  - unknown backing stays `review_required`
  - host must choose / confirm a backing before play

- `auto_queue_unverified`
  - unknown backing is allowed into the queue immediately
  - backing is marked unverified, but host does not have to intervene

- `block_unknown`
  - audience cannot choose unknown backing versions
  - only trusted / approved options are selectable

Recommended default for flexible rooms:

- backing policy: `canonical_plus_audience_youtube`
- unknown backing policy: `auto_queue_unverified`
- queue admission: `open_queue`

## Recommended User-Facing Settings

Replace the current host-facing "guest backing" wording with clearer settings.

### Host Settings Copy

- `Audience backing access`
  - `Song requests only`
  - `Song requests + approved backing choices`
  - `Song requests + YouTube backing search`

- `Unknown backing results`
  - `Host review required`
  - `Allow in queue as unverified`
  - `Hide unknown results`

- `Approve audience requests before they enter the queue`
  - existing `bouncerMode`

### Backward Compatibility

Keep the current underlying request mode enum working for now:

- `canonical_open`
- `playable_only`
- `guest_backing_optional`

But move the host UI to the clearer settings model above.

Internally, `guest_backing_optional` should evolve toward `canonical_plus_audience_youtube`.

## Queue State Model

The queue already has two useful dimensions:

- `status`
  - queue admission / workflow
- `resolutionStatus`
  - backing resolution state

Keep that split.

### Status

- `pending`
  - request exists, but bouncer or host gating has not admitted it yet

- `requested`
  - request is admitted into queue

- `assigned`
  - prepared for upcoming performance

- `performing`
  - active on stage

- `performed`
  - finished

### Resolution Status

Keep existing:

- `resolved`
- `review_required`

Add:

- `audience_selected_unverified`
  - audience chose a backing that is allowed to queue
  - not yet trusted or preferred

- `rejected_backing`
  - chosen backing was actively rejected by host or quality rules

### Resulting Matrix

- trusted backing, open queue
  - `status=requested`
  - `resolutionStatus=resolved`

- trusted backing, bouncer on
  - `status=pending`
  - `resolutionStatus=resolved`

- unknown backing, host review required
  - `status=requested` or `pending` depending on bouncer
  - `resolutionStatus=review_required`

- unknown backing, auto-queue allowed
  - `status=requested` or `pending` depending on bouncer
  - `resolutionStatus=audience_selected_unverified`

This keeps `bouncerMode` from being overloaded as a backing-quality workflow.

## Audience UX

### Search Flow

Keep canonical song search as the main audience search path.

Do not make the primary audience search box pure YouTube-first.

Reasons:

- canonical song identity keeps dedupe stable
- lyrics and song history remain attached to one song record
- host review stays about backing choice, not song identity cleanup

### Result Presentation

For each song result, show backing availability immediately:

- `Host favorite`
- `Worked here`
- `Approved`
- `Unverified`
- `Needs host review`
- `Avoid`

If the room allows backing choice, let the audience expand:

- `More backing versions`

Inside that panel, show ranked YouTube backing versions with:

- video title
- channel name
- duration
- trust badge
- host preference icon
- short reason label

### Manual URL Entry

De-emphasize or remove the raw audience YouTube URL field from the primary request flow.

Manual URL entry should be:

- hidden behind an advanced path
- or host-only

The audience should choose from ranked backing versions, not paste URLs.

## Host UX

### Post-Performance Review Prompt

There is already a persistent fallback surface:

- `Last Backing Review` in the stage panel

Add a lightweight host toast after performance completion for YouTube-backed songs:

- title: `Rate this backing for next time?`
- actions:
  - `Prefer`
  - `Avoid`
  - `Skip`

Rules:

- only show for YouTube-backed performances
- show once per performance
- suppress duplicates using the same performance key pattern already used for success marking
- if ignored, the `Last Backing Review` card remains available in the stage panel

### Search Result Badges

Host and audience YouTube results should both surface:

- room favorite
- room recent
- globally proven
- unverified
- avoided

This should influence sort order and reduce guesswork before queueing.

## Ranking Model

Use the existing ranking stack as the base.

Current useful signals already exist:

- room-local trusted catalog
- room-local YouTube index
- global track `usageCount`
- global track `successCount`
- global track `failureCount`
- `approvalState`
- `qualityScore`
- title / artist text match

Recommended sort priority:

1. `host_favorite`
2. `room_recent`
3. `global_approved`
4. `globally proven`
5. `audience_selected_unverified`
6. raw live YouTube result

Hard demotion:

- anything explicitly avoided by the room
- anything with strong failure history

## Storage Model

Keep two levels of reputation.

### Room-Local Preference

Stored today in:

- `host_libraries/{roomCode}.trustedCatalog`
- `host_libraries/{roomCode}.ytIndex`

This should continue to power:

- host favorite for a canonical song
- room recent success
- room avoid / thumbs-down behavior
- room-specific ranking and badges

This is where explicit host preference belongs by default.

### Global Confidence

Stored today in:

- `tracks/{trackId}`

Current global signals already include:

- `usageCount`
- `successCount`
- `failureCount`
- `approvalState`
- `lastSuccessfulRoomCode`
- `lastSuccessfulAt`

This should continue to power:

- globally proven backing confidence
- cross-room ranking improvements
- canonical track reuse

### What Should Not Be Global Yet

Do not immediately make host thumbs-down global.

Reasons:

- too easy to abuse
- too subjective across venues and host styles
- difficult to moderate

Room-local thumbs-down is safer.

Global confidence should grow mainly from repeated successful performance usage, not a single host opinion.

## Proposed Data Additions

### Room Configuration

Add normalized room-level backing settings:

- `audienceBackingMode`
  - `canonical_only`
  - `canonical_plus_approved_backings`
  - `canonical_plus_audience_youtube`

- `unknownBackingPolicy`
  - `require_review`
  - `auto_queue_unverified`
  - `block_unknown`

Keep `bouncerMode` as-is, but re-label it in UI.

### Queue Song Document

Possible additions:

- `selectedBackingVideoId`
- `selectedBackingTitle`
- `selectedBackingChannel`
- `selectedBackingTrust`
  - `host_favorite`
  - `room_recent`
  - `global_approved`
  - `unverified`

- `selectedBackingSourceDetail`
- `backingFeedbackPromptShownAt`
- `backingFeedbackDecision`
  - `prefer`
  - `avoid`
  - `skip`

### Global Track Reputation

Optional later additions:

- `globalConfidenceScore`
- `globalRoomSuccessCount`
- `globalRoomFailureCount`

These should be derived from observed use, not direct thumbs votes.

## Recommended Rollout

### Phase 1

- rename host-facing guest-backing language
- preserve current behavior
- add clearer settings copy
- add post-performance toast for `Prefer` / `Avoid`

### Phase 2

- expose trusted / approved backing badges in audience search
- replace raw guest URL entry with `More backing versions`
- let audience choose from approved / room-known versions

### Phase 3

- add `unknownBackingPolicy=auto_queue_unverified`
- support `audience_selected_unverified`
- make unknown YouTube choices queue without forcing host review

### Phase 4

- refine ranking and badges using room-local + global confidence
- consider global confidence scoring across rooms

### Phase 5

- apply `HOST_OPERATOR_UI_SIMPLIFICATION_SPEC.md`
- simplify live host queue review to one obvious next action
- move advanced curation out of the live review path
- reduce queue/search density on smaller host viewports

## File Targets

Likely implementation touch points:

- `src/lib/requestModes.js`
  - request/backing policy normalization

- `src/apps/Mobile/SingerApp.jsx`
  - audience result rendering
  - backing-version expansion UI
  - request payload fields
  - replacement for raw guest URL entry

- `src/apps/Host/HostApp.jsx`
  - post-performance backing feedback toast
  - room settings copy and state
  - ranking / preference wiring

- `src/apps/Host/components/StageNowPlayingPanel.jsx`
  - keep persistent fallback review surface
  - possibly add richer badge state for last performance

- `src/lib/songRequestResolution.js`
  - ranking changes
  - unverified / avoided weighting

- `functions/index.js`
  - room settings persistence and normalization
  - any added global-confidence writebacks

## Decisions

Recommended decisions for implementation:

1. Keep canonical song search as the primary audience search flow.
2. Replace "guest backing" wording with "audience YouTube search" wording.
3. Keep `bouncerMode` focused on queue admission only.
4. Allow unknown YouTube backing to queue via `audience_selected_unverified` when room policy permits.
5. Keep explicit thumbs-up / thumbs-down room-local for now.
6. Use repeated successful performance usage as the main global trust signal.

## Implementation Decisions Locked

These decisions should be treated as the Phase 1 implementation contract unless a later product decision explicitly changes them.

### Source Of Truth And Migration

Keep the current `requestMode` plus `allowSingerTrackSelect` model working as the compatibility layer for existing rooms.

Add new room-level settings for the clearer model:

- `audienceBackingMode`
- `unknownBackingPolicy`

Migration mapping for existing rooms:

- `canonical_open`
  - `audienceBackingMode=canonical_only`
  - `unknownBackingPolicy=require_review`

- `playable_only`
  - `audienceBackingMode=canonical_plus_approved_backings`
  - `unknownBackingPolicy=block_unknown`

- `guest_backing_optional`
  - `audienceBackingMode=canonical_plus_audience_youtube`
  - `unknownBackingPolicy=require_review`

That keeps old behavior stable while the UI moves to clearer language.

### Resolution Status Contract

Allowed `resolutionStatus` values for the new model:

- `resolved`
- `review_required`
- `audience_selected_unverified`
- `rejected_backing`

Playable immediately:

- `resolved`
- `audience_selected_unverified`

Host intervention required before play:

- `review_required`
- `rejected_backing`

### Badge Contract

Audience-facing backing badges:

- `Host favorite`
- `Worked here`
- `Globally proven`
- `Approved`
- `Unverified`
- `Avoid`
- `Needs review`

Rules:

- `Avoid` should not appear in audience-facing approved lists
- `Avoid` may still appear in host review surfaces at the bottom
- `Unverified` should only appear when `audienceBackingMode=canonical_plus_audience_youtube`
- `Needs review` is a host-facing workflow state, not a promoted audience badge

### Sort Contract

Default sort precedence for backing candidates:

1. `host_favorite`
2. `room_recent`
3. `global_approved`
4. `globally_proven`
5. `unverified`
6. raw live result

Demotions should apply for:

- room-local avoid signals
- high failure history
- weak title or artist match
- non-playable candidates

### Toast Contract

The post-performance host toast should layer on top of the existing fallback panel, not replace it.

Rules:

- only show after a completed YouTube-backed performance
- show once per performance key
- actions are `Prefer`, `Avoid`, and `Skip`
- `Skip` suppresses the toast for that performance only
- the persistent `Last Backing Review` card remains available as fallback

### Automatic Success Tracking

Successful YouTube-backed performances should continue to auto-increment success signals even when the host does not explicitly vote on the backing.

That means:

- room-local `ytIndex` continues to learn from successful plays
- global `tracks` success and usage history continues to update from completed performances

### Bouncer Interaction Matrix

`bouncerMode` affects queue admission only. It does not decide whether a backing is trusted, unverified, or review-required.

| Queue admission | Backing outcome | Result |
|---|---|---|
| `open_queue` | trusted backing | `status=requested`, `resolutionStatus=resolved` |
| `open_queue` | unknown backing with auto-queue allowed | `status=requested`, `resolutionStatus=audience_selected_unverified` |
| `open_queue` | unknown backing with review required | `status=requested`, `resolutionStatus=review_required` |
| `bouncer_mode` | trusted backing | `status=pending`, `resolutionStatus=resolved` |
| `bouncer_mode` | unknown backing with auto-queue allowed | `status=pending`, `resolutionStatus=audience_selected_unverified` |
| `bouncer_mode` | unknown backing with review required | `status=pending`, `resolutionStatus=review_required` |

### Room-Local Vs Global Write Rules

Phase 1 storage rules:

- thumbs up writes room-local preference
- thumbs down writes room-local avoid state
- successful play writes room-local success and global track success
- no global thumbs-up or global thumbs-down write path in this phase

This avoids letting one room's explicit opinion immediately reshape every other host's ranking.

### Quota And Caching Guardrail

When the audience requests backing candidates, search in this order:

1. trusted catalog for the canonical song
2. room `ytIndex`
3. cached live YouTube results for the canonical song
4. fresh live YouTube search

Fresh YouTube search should be avoided when room-local trusted or indexed options already satisfy the request.
