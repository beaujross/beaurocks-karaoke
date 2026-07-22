# Beau Rocks Public Operational Readiness Roadmap

Date: 2026-07-18
Owner lenses: CEO, CTO, Chief Product Officer, Chief Marketing Officer
Decision: stage public access; do not make every differentiation idea a launch blocker

## Executive position

Beau Rocks is operating as a controlled private-event product with production infrastructure, but it is not yet ready for an unrestricted commercial launch. The shortest credible path is:

1. make public Discovery trustworthy;
2. make a host's first night simple and recoverable;
3. prove content-source and live-night reliability;
4. then open self-serve hosting and monetization;
5. publish numerical Beau Rocks Index claims only after shadow evidence proves they are stable.

The Vibe v2 evidence writer and protected aggregate preview are supporting infrastructure. They are not a reason to delay a public Discovery beta, and they must not publish a number until the later shadow gate.

## Launch stages

| Stage | Customer promise | Required slices |
| --- | --- | --- |
| Current: controlled private events | Beau Rocks-assisted nights and invited testing | Existing production stack plus operator QA |
| Public Discovery beta | Find real karaoke nights; follow hosts and venues; request or claim listings | Slice 2 and the relevant parts of 8 |
| Public host beta | Approved hosts can create and run reliable nights without Beau Rocks assistance | Slices 3, 4, 5, and the relevant parts of 8 |
| Commercial launch | Venues and hosts can pay, operate, reconcile, and get support | Slices 6 and 8 |
| Public Beau Rocks Index | A defensible activity/vibe signal appears in Discovery and SEO | Slice 7 after sufficient shadow data |

## Remaining slices in order

### Slice 1 — Evidence observation and authorized readiness audit

Status: infrastructure complete; authorized production aggregate run pending.

Delivered:

- server-only, pseudonymous Vibe v2 evidence;
- active 90-day Firestore TTL;
- revoked, inactive, expired, stale, duplicate, anonymous, cross-entity, and self-attributed evidence rejection;
- admin + App Check protected `previewPublicVibeEvidenceBackfill`;
- aggregate-only output with a 1,000-record hard cap and explicit truncation;
- no-write assertions and production authorization verification.

Closeout:

- load the approved directory-admin QA credentials into the operator environment;
- run `VIBE_ROLLOUT_MODE=evidence-preview node scripts/qa/public-vibe-index-rollout.mjs`;
- archive only aggregate results;
- observe enough real public sessions to evaluate thresholds instead of backfilling unverifiable attendance.

Success:

- zero identifiers or individual evidence in the response;
- zero writes;
- collision/rejection rates are explainable;
- at least five targets accumulate enough data for meaningful shadow comparison.

This slice blocks shadow scoring, not the Public Discovery beta.

### Slice 2 — Public Discovery accuracy and supply flywheel

Goal: a person searching for karaoke can trust what the map and list show, while venues and hosts maintain the supply.

Required:

- map-first Discovery with a persistent list toggle and preserved navigation;
- correct time-of-day, timezone, recurrence, cancellation, and ended-event behavior;
- strict public/private separation and a clear private-room code/passcode join path;
- venue-owner recurring-night creation and claiming;
- independent karaoke-host profiles, schedules, and follow links;
- listing submission for venues that do not use Beau Rocks;
- duplicate detection, ownership transfer, moderation, stale-listing reporting, and claim escalation;
- fun-signal filters and icons sourced from verified room/night settings without exposing private configuration;
- venue, host, event, and room-session canonical URLs with useful structured data.

Public-beta gates:

- zero private listings in anonymous responses;
- at least 95% schedule accuracy in a manually sampled launch market;
- cancelled/ended nights disappear or change state within the documented window;
- every card has one clear primary action;
- submission and claim flows can be completed on mobile;
- every public listing has a visible correction/report path.

### Slice 3 — Host setup and reusable night templates

Status: technical implementation deployed; credentialed production lifecycle
canary and moderated usability thresholds remain before Public Host beta.

Goal: reduce host mental load without removing advanced control.

Required:

- one canonical concept for a reusable night template; eliminate overlapping preset/configuration language;
- a short guided path: identity and access, experience, review and launch;
- safe defaults for room privacy, requests, scoring, BeauBucks, games, background music, and Discovery;
- advanced controls behind progressive disclosure;
- reliable empty-field editing, validation, save states, and unsaved-change recovery;
- explain effective behavior, not implementation primitives;
- duplicate a successful night and preview what guests and TV will see.

Host-beta gates:

- median first-room setup under three minutes in moderated testing;
- at least 85% of approved test hosts finish without assistance;
- no destructive default;
- no field that silently restores deleted text;
- one obvious launch action and one obvious way back to the host panel.

### Slice 4 — Content-agnostic canonical catalog and playback resilience

Goal: market Beau Rocks as an at-home party game and event interaction layer, not as a supplier of licensed karaoke content.

Required:

- canonical song identity separated from backing-track/provider candidates;
- rankings attach to the canonical song regardless of backing track;
- provider capability and embeddability checks before selection;
- YouTube quota telemetry, alerts, quota-increase operating procedure, and compliant cached metadata/index behavior;
- graceful search degradation when YouTube quota is exhausted;
- reliable Apple Music authorization, playlist selection, audible playback confirmation, and blob-lifecycle cleanup;
- Spotify library browsing and linking appropriate to Spotify's permitted playback model;
- local/host-provided media and additional provider candidates in the same source-neutral catalog;
- explicit source availability and fallback behavior for hosts.

Host-beta gates:

- at least 95% playable-candidate success in the supported golden-path catalog;
- no dead-end navigation when browsing a category;
- quota exhaustion produces a useful catalog, not an empty search;
- background music failure is visible, recoverable, and does not create unhandled console promises;
- legal/marketing copy never implies Beau Rocks supplies licensed songs.

### Slice 5 — Cross-surface live-night reliability

Goal: a host can run the night while the host panel, TV, and audience stay synchronized.

Required:

- run-of-show recovery after refresh, reconnect, or device handoff;
- deterministic stage/performance identity across host, TV, and audience;
- queue and catalog navigation available during every nested workflow;
- games matrix covering trivia, Would You Rather, pop-up trivia, bingo, brackets, reactions, and transitions;
- background audio, intermission, and Auto DJ arbitration;
- clear degradation when Apple, Spotify, YouTube, network, or a display device fails;
- event-level telemetry and a concise host incident panel.

Host-beta gates:

- three representative multi-hour events without a severity-one failure;
- recoverable device/network interruption in under 60 seconds;
- no duplicate charges, performances, or irreversible queue loss;
- host can always identify what is playing, what is next, and which automation owns the stage.

### Slice 6 — BeauBucks and commercial event economics

Goal: separate engagement points from premium/contribution value and make money movement auditable.

Required:

- BeauBucks as the premium or contribution currency; ordinary engagement points remain non-monetary;
- explicit event funding modes: playful/free, prepaid admission allocation, host grant, and contribution/donation;
- immutable transaction ledger, idempotency, reconciliation, refunds, and chargeback handling;
- clear display of who receives value and whether a vote is playful or contributes money;
- venue/host permissions, limits, fraud controls, reporting, and support tooling;
- legal/accounting review of donation, stored-value, tax, and payout language before enabling money-like behavior.

Commercial-launch gates:

- zero negative balances or replayed spends in adversarial tests;
- 100% reconciliation between payment, grant, spend, refund, and payout records;
- every paid action has an understandable confirmation and receipt path;
- rollback and customer-support procedures are tested.

### Slice 7 — Shadow Index, charts, and public reputation

Goal: turn verified first-party activity into differentiated growth without manufacturing credibility.

Required:

- internal `vibe_v2_shadow` snapshots with no public consumer;
- threshold and stability evaluation by venue, host, event, and room session;
- moderation, revocation, ownership-change, dispute, and rollback paths;
- account-required global leaderboard eligibility at performance time;
- seeded song discovery may invite a singer to claim the first score, but must not invent performances;
- public-safe Index bands/labels before considering exact numbers;
- SEO/AI structured data that distinguishes first-party Beau Rocks activity from copied directory facts.

Public-Index gates:

- sufficient multi-night evidence across multiple independent targets;
- stable bands across reruns and ownership changes;
- no paid-plan or self-declared-feature score advantage;
- documented CMO claim language, CPO explanation tests, and CTO abuse review;
- one-target canary and rollback before any wider publication.

### Slice 8 — Operations, accessibility, legal, support, and release discipline

Goal: make public access supportable, observable, and reversible.

Required:

- source-control alignment for every production deployment;
- environment inventory and least-privilege operator roles;
- App Check enforcement plan, secret rotation, dependency/security update cadence, and container scanning decision;
- SLO dashboards for join, queue, playback, Discovery, callable errors, provider failures, and quota;
- alerting, incident severity definitions, rollback runbooks, backups, retention, and restoration drills;
- load tests for launch-market Discovery and representative concurrent rooms;
- mobile, keyboard, screen-reader, contrast, reduced-motion, and poor-network acceptance;
- Terms, privacy, account deletion/export, content/provider disclosures, payment terms, and support escalation;
- launch communications that say private testing/private events until each stage is actually open.

Stage gate:

- no unresolved severity-one or launch-blocking severity-two issue;
- named on-call owner and tested rollback;
- support intake and status communication are operational;
- production code is committed and traceable;
- CEO/CTO/CPO/CMO go/no-go checklist signed for the specific stage being launched.

## Immediate next actions

1. Run the authorized aggregate evidence preview when the admin QA credentials are loaded.
2. Begin Slice 2 with a production-shaped Discovery schedule/privacy matrix and mobile venue/host submission and claim audit.
3. In parallel, run the existing host setup and Apple Music golden paths because those are blockers for the public host beta, not the earlier Public Discovery beta.
4. Keep Vibe scoring, public Index claims, self-serve payments, and unrestricted host access off until their stage gates pass.

## Public-readiness definition

“Fully operational” should be declared per launch stage, not as one giant finish line. Public Discovery can open before public hosting, commercial payments, or a numerical Index. The complete commercial product is ready only when a stranger can discover a real night, an approved host can set it up and run it without Beau Rocks assistance, provider failures degrade safely, money reconciles, and the team can detect, support, and roll back failures.
