# Public Vibe Index v2 Evidence Integrity

Date: 2026-07-17  
Status: trusted evidence writers and client lockout deployed; TTL activation in progress; evidence not consumed  
Owner lens: CTO, Chief Product Officer, Chief Marketing Officer

## Executive outcome

`vibe_v2` will earn the right to publish a score from recent, entity-bound, server-verified activity. It will not turn plan status, official listing status, self-declared room features, or raw lifetime counters into numerical reputation.

The bounded implementation now includes `functions/lib/publicVibeIndexEvidenceV2.js` and `functions/lib/publicVibeEvidenceLedger.js`. The first produces only an internal eligibility snapshot and minimal public-safe status; the second creates deterministic, server-verified evidence records. Trusted check-in, review, and public-recap workflows can write the ledger, but nothing reads it for scoring yet. This slice does not calculate a number, alter `vibe_v1`, change discovery, change SEO, or enable the scheduler.

## Current evidence gaps

The existing `vibe_v1` inputs are useful product signals but are not yet a defensible reputation dataset:

- Host recap insights scan a bounded set of room documents and count lifetime recap presence. They do not enforce a 30-day window or an immutable session identity.
- `checkin_totals` increments for every authenticated request. A single account can submit repeatedly, and the aggregate does not preserve uniqueness, event attendance, or freshness.
- Reviews are idempotent only for `uid + target + eventId`, while `eventId` is currently client-supplied and not verified against attendance. Changing it can create additional reviews.
- Public recap publication stamps discovery metadata such as `hostRecapCount` and `recap_ready`; those fields are presentation state, not an independent evidence ledger.
- Schedule, capability, official, elevated, and paid-plan fields can explain a listing but must not numerically reward a customer for buying or self-describing features.

Because of these gaps, `vibe_v1` remains rollout-off and all current production listings remain `not_enough_data`.

## Implemented v2 contract

Every qualified evidence record must have:

- an allowed evidence type: verified room recap, authenticated check-in, or verified review;
- an exact target type and target ID;
- a stable session ID and one-way source key;
- a trusted source collection and server-verification stamp;
- an occurrence time inside the trailing 30-day window;
- an authenticated actor for participant evidence;
- an actor who is not an owner of the scored entity.

The model rejects unsupported, duplicate, self-attributed, stale, future-dated, cross-entity, anonymous, missing-session, and unverified evidence. Participant evidence is deduplicated per type, session, and actor. Recaps are deduplicated per session.

Shadow-score eligibility currently requires at least:

- 2 verified sessions;
- 5 unique authenticated participants;
- 2 active days inside the 30-day window.

These are launch hypotheses, not final marketing promises. They can change while the model is shadow-only.

## Implemented evidence infrastructure

The local implementation introduces the server-only ledger:

`public_vibe_evidence/{deterministicEvidenceId}`

- `evidenceType`
- `targetType`, `targetId`
- `sessionId`
- one-way `actorKey` for internal deduplication; raw account UIDs are not stored
- `sourceCollection`, plus a one-way `sourceKey`; raw source IDs are not stored
- `occurredAt`, `verifiedAt`
- `expiresAt` with a 90-day retention horizon
- `verificationMethod`
- `revokedAt`, `revocationReason`

Firestore rules deny every client read and write, including moderators, because individual evidence can reveal attendance. A later aggregate preview callable may expose bounded diagnostics to administrators without returning actor or source identifiers.

Deterministic SHA-256 IDs make ingestion idempotent by evidence type, target, verified session or occurrence, and actor where applicable. Replayed check-ins, updated reviews, and republished recaps do not add evidence.

Participant identity and source-document identity are reduced to separate, stable, namespaced SHA-256 keys before persistence. The ledger retains enough continuity to reject replay, count unique participation, and trace a known source without storing the account UID or a source ID that may embed it. Every participant record explicitly carries server-verified authenticated provenance. Every record also receives a Firestore timestamp 90 days after verification; production must enable a collection-group TTL policy on `expiresAt`. Firestore TTL is asynchronous, so expired records may remain briefly before deletion and must still be excluded by the 30-day scoring window.

Participant evidence is written only when all of the following hold:

- the account is non-anonymous;
- the room session is approved and public;
- the account has a room membership record;
- the requested target is a verified relationship of that session;
- the actor is not an owner of that target;
- check-ins occur inside the event window, or reviews occur within 30 days after it;
- an optional recurring occurrence belongs to that session and is not cancelled.

Public recap publication fans out actor-free evidence to the verified room session, venue, event, and hosts associated with the listing. The existing recap artifact and discovery metadata continue to publish normally.

## Recommended migration slices

1. Completed locally — evidence writers stamp verified session/attendance provenance from trusted room, check-in, and review workflows without consuming it.
2. Next — evidence backfill preview reports how many current records qualify, fail, or collide; it writes nothing.
3. Shadow aggregation: persist internal `vibe_v2_shadow` snapshots and compare stability against real event outcomes. Keep public output unchanged.
4. Adversarial QA: repeat check-ins, fabricated event IDs, owner reviews, stale sessions, ownership changes, deleted evidence, and replayed requests.
5. One-target acceptance: admin + App Check + exact server canary, with audit and rollback.
6. Public decision: CTO security signoff, CPO explanation/usability signoff, and CMO claim-language signoff before any numeric display or SEO exposure.

## Success gates

- 0 client-write paths to the evidence ledger.
- 100% of qualified evidence has trusted provenance, stable session attribution, and a server timestamp.
- Duplicate or replayed requests do not increase qualified evidence.
- Owners cannot improve their own participant count.
- Paid or elevated status produces no numerical difference for identical evidence.
- Public summaries reveal no actor IDs, source IDs, raw counts, or integrity diagnostics.
- Raw account UIDs never persist in the evidence ledger, and TTL is enabled on `expiresAt`.
- A score cannot publish until the evidence threshold, canary, audit, rollback, and cross-functional signoffs all pass.

## Verification evidence

- Focused Vibe and ledger tests: 21 passed.
- Full unit suite: 290 files and 1,032 tests passed.
- Directory callable emulator: 42 checks passed.
- Public recap Firestore + Storage emulator: artifact publication and three-way evidence fan-out passed; replay remained at three records.
- Full Firestore and Storage rules suite: 111 checks passed, including denial for anonymous users, authenticated users, and moderators.
- Repository-wide lint and production build passed.
- Syntax and patch-integrity checks passed; only line-ending warnings remain.

## Deployment gate

The controlled production release on 2026-07-17 included Firestore rules plus only `createDirectoryCheckin`, `submitDirectoryReview`, and `publishPublicRoomRecap`, followed by the `public_vibe_evidence.expiresAt` TTL policy. Hosting, scoring, backfill, and Vibe rollout mode were not changed.

Production verification confirmed all three revisions active on release hash `bdb16990ceafba337defb72300954b2d74403787`, unauthenticated writer requests rejected with HTTP 401, unauthenticated ledger reads rejected with HTTP 403, no post-deploy service errors, and anonymous discovery unchanged at 114 `not_enough_data` listings with zero published scores and zero raw-data leaks. The scheduler continued to log `mode: off` and `rollout_disabled`. Firestore accepted the TTL policy and initially reported `CREATING`; activation is asynchronous by design.
