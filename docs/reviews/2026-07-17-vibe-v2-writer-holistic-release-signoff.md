# Vibe v2 Writer Holistic Release Signoff

Date: 2026-07-17
Decision: ship the protected evidence writers; keep scoring and public claims off
Scope: CTO, Chief Product Officer, and Chief Marketing Officer review

## Executive outcome

The writer slice is production-safe and remains inside the larger Discovery and Beau Rocks Index plan. It establishes trustworthy, private evidence collection without changing what a guest, host, venue owner, search crawler, or discovery visitor sees. It does not publish a numerical score, alter discovery ranking, run a backfill, or deploy Hosting.

The adversarial review found and closed two release-blocking gaps before deployment:

1. Raw account and source-document identifiers would have persisted in attendance-linked evidence. They are now separate, namespaced SHA-256 actor and source keys.
2. Participant records did not explicitly carry the authenticated provenance required by the v2 eligibility model. Trusted writers now stamp that fact.

Every record has a 90-day `expiresAt` timestamp. Firestore TTL is configured on that field; the scoring contract independently rejects evidence outside its 30-day window because TTL deletion is asynchronous.

## CTO signoff

- Firestore clients, including moderators, cannot read or write `public_vibe_evidence`.
- The three writers require an authenticated account; anonymous production requests return HTTP 401.
- Participant evidence requires an approved public session, verified room membership, a real session-target relationship, an eligible event window, and a non-owner actor.
- Private sessions never create Vibe evidence.
- Deterministic IDs make replay and repeated updates idempotent.
- Actor UID and source document ID are not persisted in the ledger.
- Evidence writes are additive and fail open, so a ledger outage does not break the legacy check-in, review, or recap workflow.
- No errors appeared in the three updated services after deployment.

CTO decision: approved for protected evidence collection; numeric scoring remains blocked pending shadow evaluation.

## Chief Product Officer signoff

- No new prompt, consent step, host configuration, or audience task was introduced.
- Existing check-ins and reviews without verified session context continue to work; they simply do not qualify as Vibe evidence.
- Public recap publication keeps its existing artifact and discovery behavior.
- Owners cannot increase their own participant signal.
- Paid plan, official listing status, and self-declared capabilities do not improve eligibility.
- The public fallback remains plain `not_enough_data`, avoiding false precision or extra mental load.

CPO decision: approved because the slice improves trust without adding host or audience workload.

## Chief Marketing Officer signoff

- No unsupported Beau Rocks Index number or comparative claim was released.
- Anonymous discovery remains 114 listings, zero published Vibe scores, 114 `not_enough_data`, and zero raw-data leaks.
- Evidence identifiers, counts, sources, and integrity diagnostics remain absent from public responses and SEO.
- The design still supports the planned growth flywheel: verified activity can later support differentiated venue, host, event, and room-session trust signals after shadow validation.

CMO decision: approved as infrastructure, not as a public reputation launch.

## Release evidence

- Firestore ruleset: `1e19d784-9a36-4257-a670-2e76b34b8d2c`
- Function release hash: `bdb16990ceafba337defb72300954b2d74403787`
- Active revisions:
  - `createdirectorycheckin-00121-jop`
  - `submitdirectoryreview-00121-dob`
  - `publishpublicroomrecap-00040-les`
- Focused Vibe and ledger tests: 21 passed
- Full unit suite: 290 files and 1,032 tests passed
- Directory callable integration: 42 passed
- Firestore and Storage rules: 111 passed
- Public recap Firestore and Storage integration: passed
- Full lint: passed with existing warnings
- Production build: passed; 134 prerendered routes and 131 social cards generated
- Patch integrity: passed with line-ending warnings only
- Scheduler: `mode: off`, `rollout_disabled`
- Hosting deployment: none

Firestore TTL reference: https://firebase.google.com/docs/firestore/ttl

## Non-blocking repository debt

The holistic gate still reports existing React hook/purity warnings, several large application chunks, an older Browserslist dataset, and a Firebase CLI dependency-age warning. None originated in this evidence slice, none failed a gate, and none justify expanding this controlled release. They remain separate stability/performance maintenance work.

## Planned next slice

The read-only evidence backfill preview was completed and deployed on 2026-07-18 as `previewPublicVibeEvidenceBackfill`. It:

1. scan a bounded sample without writing;
2. report aggregate qualification, rejection, replay, and collision counts;
3. return no actor keys, source keys, or individual attendance records;
4. separate results by venue, host, event, and room session;
5. provide CTO/CPO/CMO evidence for threshold tuning;
6. leave `vibe_v1`, discovery, SEO, and scheduler rollout unchanged.

Production reports revision `previewpublicvibeevidencebackfill-00001-vof` active on hash `4f96965abf4941a0ccafa7780e379a0d112b58c8`. No-token and App-Check-only production requests are rejected. The authorized aggregate run remains an operator gate because approved admin QA credentials are not loaded in the current environment.

Only after real aggregate results are reviewed should the plan advance to internal shadow snapshots. Public numbers remain a later, separately approved decision. The broader staged launch plan is documented in `docs/reviews/2026-07-18-public-operational-readiness-roadmap.md`.
