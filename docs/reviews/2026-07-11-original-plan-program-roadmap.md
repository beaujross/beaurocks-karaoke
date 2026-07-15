# BeauRocks Original Plan Ã¢â‚¬â€ Current Program Roadmap

Date: 2026-07-11

## North Star

BeauRocks is a content-agnostic, at-home party game and live-event interaction system. It should reduce host and audience mental workload while helping both groups delight each other through digital participation. Karaoke is an important use case, not a licensing-dependent definition of the platform.

## Program Outcomes

1. A host can configure and run a night without understanding internal primitives.
2. An audience member can join, choose, vote, play, reward, and react without instruction.
3. Songs, games, credits, media, and room behavior have canonical data contracts instead of competing representations.
4. Media sources remain interchangeable at the product layer while their legal and playback capabilities remain explicit.
5. BeauRocks branding, design quality, and interaction language remain consistent across Host, Audience, TV, Admin, and Marketing.

## Workstream Map

### A. Host Catalog and Content-Agnostic Media Ã¢â‚¬â€ Active

Completed foundation:

- category drill-down no longer traps Host navigation;
- album-forward collection browsing;
- TV-ready versus review-needed filtering;
- canonical song identity separated from backing rendition identity;
- worldwide and weekly performance ranking keyed by canonical song;
- alias and merge redirects for canonical songs;
- unified song results with recommended and alternate renditions;
- capability-first labels: TV Karaoke, Apple Sing-Along, Room Upload, External Playback, Review Needed;
- canonical result enrichment before rendering;
- curated collection readiness scoring and ready-song badges.

Next bounded outcomes:

- add host-oriented themes only when verified backing coverage meets the readiness threshold;
- expose weak-theme coverage as an internal catalog curation queue, not Host clutter;
- measure canonical/indexed reuse versus live YouTube fallback;
- keep Spotify or other providers behind policy, licensing, and capability review.

Success measures:

- one canonical song appears once;
- recommended backing queues in one action;
- alternatives are available within two actions;
- zero non-embeddable tracks labeled TV-ready;
- increasing share of searches resolved without live YouTube search.

### B. Apple Music and Background Audio Reliability Ã¢â‚¬â€ Next Reliability Track

Goal: Apple Music playlists and uploaded/background audio behave as one understandable room-audio system.

Current implementation evidence:

- one canonical truth state covers selected, ready, starting, deferred, playing, paused, disconnected, and failed;
- the same status appears in Apple Music and uploaded-background views;
- recoverable states expose one contextual action: connect, retry Apple, or start upload;
- deferred and playing states remain informational so Host actions do not fight automation;
- existing shared BG start/stop ownership remains intact.
- Apple playing claims with heartbeat evidence become actionable when confirmation goes stale;
- a redacted QA snapshot and transition-only diagnostic log support live verification without exposing authorization data.

Required outcomes:

- connect, authorize, select, start, pause, resume, duck, and restore reliably;
- make background-versus-performance ownership explicit;
- provide truthful readiness and failure states;
- preserve content-agnostic fallback to uploads and other approved sources.

Success measures:

- selected background source becomes audible without manual recovery;
- active performance cannot accidentally compete with background audio;
- recovery path is visible and requires no page reload.

### C. Room Setup and Preset Simplification Ã¢â‚¬â€ Product Priority

Goal: replace primitive-heavy setup with a small set of decisions about tonight.

Required outcomes:

- one canonical settings contract across provisioning, presets, mission setup, event profiles, and direct edits;
- distinguish operating style, crowd experience, economics, media, and advanced exceptions;
- eliminate competing meanings of preset, recipe, template, scene, and room configuration;
- show effective behavior and provenance without exposing implementation fields.

Success measures:

- first-time host can launch a safe night without opening advanced settings;
- equivalent setup paths produce equivalent effective room behavior;
- lower preset undo and exception-edit rates;
- fewer duplicated controls across setup and live operations.

### D. BeauBucks and Event Economics Ã¢â‚¬â€ Planned Product/Data Slice

Goal: separate participation rewards from premium or donation-linked value.

Required model:

- participation points remain lightweight engagement feedback;
- BeauBucks become the explicit spendable event currency;
- issuance, purchase, grant, spend, refund, expiration, and donation attribution use an auditable ledger;
- room presets can express free-play, included-value, fundraiser, and controlled-premium policies;
- canonical performance/song identity can receive attributed support regardless of backing rendition.

Success measures:

- balances reconcile from the ledger;
- hosts and guests can explain what a BeauBuck represents;
- paid entry and donation flows cannot be confused with free participation points;
- event economics can change without changing game mechanics.

### E. Games and Crowd Interaction Ã¢â‚¬â€ Planned Audit and Simplification

Scope:

- trivia;
- Would You Rather;
- Pop Trivia companion mode;
- prompt rounds and other established game primitives.

Required outcomes:

- one registry of modes and capabilities;
- clear distinction between standalone game, between-song moment, and performance companion;
- consistent Host launch, Audience response, TV reveal, scoring, and recap lifecycle;
- presets choose coherent bundles rather than exposing every primitive.

Success measures:

- host can identify when and why to launch each mode;
- audience always knows the required action;
- no collision between active game, performance companion, applause, and queued room moments.

Current evidence (2026-07-12):

- a shared lifecycle registry classifies standalone, between-song, and performance-companion modes without changing existing game payloads;
- Host launches pass through one compatibility guard with actionable collision guidance;
- Audience and TV now derive phase, required audience action, reveal owner, and next step from the same presentation contract;
- Pop Trivia remains explicitly tied to the active-performance companion lifecycle;
- focused lifecycle checks pass (47 tests), the full regression suite passes (242 files / 867 tests), and the production hosting build and release completed successfully.

Host bundle simplification evidence (2026-07-12):

- the Game Launchpad and queue/planner picker now share one lifecycle-derived bundle contract;
- the default view prioritizes between-song moments, while alongside-karaoke companions and full-screen rounds are separate deliberate choices;
- Pop Trivia is presented as a during-performance companion toggle and cannot be mistaken for a queued standalone break;
- existing scoring, launch payloads, Applause Meter access, and game configuration remain unchanged;
- focused bundle and lifecycle checks pass, targeted lint passes, the full regression suite passes (244 files / 872 tests), and the production hosting build and release completed successfully.

Persona QA and evidence checkpoint (2026-07-12):

- deterministic current-state evidence now covers room setup, Host catalog/browse, and lifecycle-based game bundles;
- an authenticated production run validated real room creation, Host Trivia launch, TV Trivia display, and return-to-karaoke recovery;
- the run isolated a P1 audience gap: an unjoined game-first arrival sees actionable Trivia controls before membership, then receives Ã¢â‚¬Å“Rejoin the roomÃ¢â‚¬Â without a visible join path;
- the deck-ready executive progress narrative and measured next-slice definition are recorded in `docs/reviews/2026-07-12-executive-progress-evidence.md`.
- targeted QA tooling lint passes and the full regression suite passes (245 files / 874 tests).

Audience game-first membership closure (2026-07-12):

- active game and light-mode controls now wait for resolved room-user membership;
- new visitors receive a compact name and rules flow, then return directly to the same live round;
- existing joined guests and deterministic demo fixtures bypass the gate;
- the authenticated production acceptance path passed room creation, Host Trivia launch, singer join, singer vote, TV Trivia display, and return to karaoke;
- focused checks and targeted lint pass, the full regression suite passes (247 files / 881 tests), and the production hosting release completed successfully.

Background-audio runtime reliability closure (2026-07-12):

- local/uploaded playback now becomes `playing` only after the Host media element confirms playback; browser blocks and media failures remain actionable `blocked` or `error` states;
- Host start, upload selection, skip, automatic advance, pause, and post-performance restore share one operation-guarded runtime path;
- selecting a local upload clears the Apple auto-play preference, while selecting Apple invalidates pending local starts and clears stale local evidence;
- Host and TV expose the same redacted QA state and capability contract;
- capability language is explicit: uploads play on the Host device, Apple requires a connected MusicKit session, YouTube remains embeddable stage media, and Spotify remains discovery or external handoff only;
- the secured `updateRoomAsHost` callable accepts only a constrained `local_upload` playback observation and rejects malformed or provider-spoofed payloads;
- focused background checks pass (23 tests), all 33 callable integration checks pass, targeted lint passes, the full unit suite passes (254 files / 899 tests), and the hosting plus targeted Functions releases completed successfully;
- authenticated production acceptance in room `A6M6` passed Host and TV `playing/host_playback` evidence, Trivia launch, singer join and vote, TV display, and return to karaoke.

Room setup effective-behavior closure (2026-07-13):

- one versioned resolver now merges setup layers in runtime order and records field-level provenance without mutating the source payloads;
- quick provisioning and Mission Setup both use the same five Host-facing domains: operating style, crowd experience, Points + BeauBucks, media + catalog, and advanced exceptions;
- quick creation summarizes the exact preset/economy payload it provisions, while Mission Setup summarizes the live-room baseline, mission plan, event-profile context, and last-write-wins tonight overrides;
- equivalent authoring paths produce the same stable behavior key and plain-language summaries while preserving different source labels;
- the media domain remains content-agnostic across BeauRocks/local files, YouTube, and Apple catalog discovery, with explicit embeddability and background-audio capability language;
- existing save/apply callables, defaults, and room runtime writes were not changed by the resolver or preview integration;
- focused setup/launch checks pass, targeted lint has zero errors, the full unit suite passes (255 files / 905 tests), and the production build plus Hosting release completed successfully;
- authenticated production acceptance created room `Z8M2`, verified all five setup domains before provisioning, then passed Host Trivia launch, singer join and vote, TV Trivia display, shared `playing/host_playback` evidence, and return to karaoke;
- production QA now follows the actual Host recovery path when room-list indexing lags: Existing Rooms, Open by room code, then Open Room.

BeauBucks shadow-ledger reconciliation closure (2026-07-13):

- one deterministic report now compares a single canary room's shadow entries with its legacy room-user balances by user and currency;
- every mismatch is classified as opening history, a missing shadow event, duplicate/idempotency conflict, currency mismatch, or an unsupported legacy spend;
- authoritative grant-marker evidence is checked separately from ledger totals, so known missing events are not mislabeled as unexplained opening history;
- the legacy room balance remains authoritative; global `users.pointsBalance` is clearly optional super-admin context and is never treated as the room balance;
- canonical song/performance attribution remains separate from backing-track metadata;
- access requires Host ownership plus an allowlisted room/host, or super-admin access, and all evidence queries have a 250-document cap;
- Advanced Diagnostics exposes only an on-demand report and states that the shadow ledger is not live money;
- full lint passes with no errors, the complete unit suite passes (258 files / 916 tests), the production build passes, and the Firestore callable integration gate includes byte-for-byte no-write assertions;
- the targeted Function and Hosting releases completed successfully, and authenticated production acceptance in canary room `A6M6` rendered the report with explicit legacy authority and `Shadow is not live money` guidance;
- the broader Admin Workspace smoke separately exposed a pre-existing/stale Media navigation assertion that stayed on Night Setup; the isolated reconciliation gate is green and that navigation issue remains outside this accounting slice.

Server-authoritative canary spend boundary implementation (2026-07-13):

- `spendAudienceRoomCredits` now owns server pricing and the room-balance transaction for paid reactions, paid profile changes, and paid avatar unlocks in allowlisted canary rooms;
- reaction costs come from the shared server table, profile pricing comes from the server-owned edit count, and avatar pricing/eligibility comes from the server avatar catalog;
- profile identity mutation and paid avatar ownership are atomic with their debit; reaction display/attribution keeps the current buffered event pipeline after the debit is accepted;
- each client action carries a strict operation ID, and ambiguous responses retain that same ID for the next identical attempt so a retry replays the stored result instead of charging twice;
- accepted, duplicate, insufficient-balance, and explicit `legacy_fallback` outcomes are covered by Firestore-emulator integration tests;
- typed `reaction_spend`, `profile_change_spend`, and `avatar_unlock_spend` shadow debits are written in the same transaction as accepted balance changes;
- non-canary rooms never enter the new route, and removing the server allowlist makes an already-open canary client receive `legacy_fallback` before it performs the current legacy mutation;
- legacy `room_users.points` remains the balance-read authority and global `users.pointsBalance` remains unchanged by room spends;
- stability evidence is green: full lint has zero errors, the complete unit suite passes (260 files / 924 tests), the production build passes, and both BeauBucks emulator callables pass;
- the two targeted Functions and Hosting release completed successfully; production acceptance in `A6M6` charged one 2-credit reaction, replayed the same operation as a duplicate with no second debit, matched the room balance delta and `reaction_spend` shadow entry, and left global points unchanged.

Next bounded slice after production acceptance:

- exercise paid reaction, profile, and avatar paths in canary rooms and reconcile every resulting operation, shadow debit, and legacy balance;
- add operator visibility for spend-operation outcomes and retry/insufficient counts without exposing accounting internals to the audience;
- define the convergence threshold and opening-balance policy required before any balance read can move away from legacy storage;
- keep refunds, expirations, generalized game costs, and balance-authority migration out of scope until canary debit evidence is clean.

Spend-boundary readiness and operator evidence implementation (2026-07-13):

- the reconciliation callable now validates every accepted spend operation against its exact typed shadow debit, including account, currency, amount, lifecycle status, and before/after balance transition;
- duplicate calls increment replay telemetry only; the transaction never repeats a debit, identity/avatar mutation, or ledger write;
- Advanced Diagnostics separates canary spend-boundary health from legacy-account reconciliation and reports accepted/insufficient outcomes, distinct guests, per-kind coverage, safe replays, ledger gaps, and explicit blockers;
- the bounded readiness threshold is 12 accepted operations across 3 distinct guests, all 3 paid kinds represented, at least 1 observed replay, zero operation-ledger gaps, and untruncated evidence;
- balance reads remain legacy-authoritative even when the spend boundary passes; migration additionally requires exact account reconciliation and explicit compensating opening entries, with destructive backfill prohibited;
- emulator coverage proves paid reaction, profile-change, and avatar-unlock atomicity. Production QA will add controlled reaction/replay evidence without manufacturing persistent profile or avatar activity merely to satisfy a metric;
- refunds, expirations, generalized game costs, and the balance-authority switch remain outside this slice.
Production closeout evidence (2026-07-13):

- all stability gates passed: 261 unit-test files / 930 tests before the QA harness hardening, full lint with zero errors, production build, and both BeauBucks Firestore-emulator callable contracts;
- the two bounded Functions and Hosting deployed with zero errors;
- the production canary in `A6M6` now reports 2 accepted reaction operations from 1 dedicated QA guest, 1 persisted safe replay, 0 ledger gaps, exact debit/ledger agreement, and unchanged global balance;
- readiness remains correctly blocked only by accepted-sample, distinct-account, and required-kind coverage; balance reads remain legacy-authoritative;
- the isolated Host production smoke passed Admin Workspace load, single navigation rail, removal of the legacy rail, and the on-demand reconciliation report with its legacy/shadow disclosures;
- the smoke harness now refuses to click a transient disabled room-create action during Host hydration, with a focused regression test.

Direct Host launcher lifecycle closure (2026-07-13):

- Quick and configured game starts now share the Run of Show lifecycle preflight before any live room mutation;
- configuration-only, preview, scoring, and clear operations remain available and do not falsely claim a lifecycle slot;
- production acceptance used the intentional compact live-game summary and `Open Launcher Drawer` recovery path, then proved Trivia-to-Bingo and Bingo-to-WYR collisions are blocked without changing the live mode;
- both accepted scenarios also passed Audience, TV, interaction, and End Mode checks;
- final stability evidence is 267 unit-test files / 947 tests, full lint with zero errors and the established warning baseline, a passing production build, and a successful Hosting release;
- the next bounded slice is Sequence 6 evidence packaging: current Host timing bundles, live drawer, collision guidance, and shared Audience/TV cues, reviewed through CTO, CPO, CMO, Host, and guest personas.
### F. Persona, Brand, and Design Governance Ã¢â‚¬â€ Continuous

Every slice is reviewed from these perspectives:

- CTO: contracts, security, quota, reliability, observability, migration safety;
- Chief Product Officer: mental workload, coherent primitives, adoption, recovery paths;
- Chief Marketing Officer: content-agnostic positioning, licensing-safe claims, BeauRocks voice and visual consistency;
- Host, co-host, singer, non-singer guest, venue/operator, and remote viewer personas.

No workstream is complete if it improves one surface by transferring confusion to another.

### G. Deployment and QA Ã¢â‚¬â€ Continuous Gate

Current evidence for the catalog/canonical slice:

- production build passes;
- focused unit and Firestore callable integration suites pass;
- co-host helper catalog Playwright flow passes;
- aggregate Host fixture commands exceed the current command window without returning failing assertions and require QA-runner timing isolation.

Release rule:

- client and Functions changes affecting canonical resolver fields deploy together;
- no production deployment is implied by implementation completion;
- post-deploy smoke covers Host search, alternate backing selection, queue identity, TV playback capability, and completed-performance canonical aggregation.

## Current Sequence

1. Finish curated discovery readiness and curation visibility.
2. Close Apple/background audio reliability gaps.
3. Simplify room setup around canonical decision domains.
4. Establish the BeauBucks ledger and policy model.
5. Audit and unify games and performance-companion lifecycles.
   Completed checkpoint: lifecycle slots now drive Run of Show, direct quick launch, and configured Host starts through one room-aware preflight without changing payloads or scoring. The CTO/CPO/CMO persona review authorized a bounded compact Live Switcher; it is now deployed and production-accepted with three timing choices, a two-action recovery path, no more than two actions per compact card, and preserved collision behavior.
6. Package before/after design evidence and executive progress reporting across all workstreams. `Completed`: the BeauRocks-branded 10-slide executive plan and PDF use verified current screenshots, documented baselines, production metrics, and measured next-slice gates.

## AntiÃ¢â‚¬â€œBoil-the-Ocean Rule

Each slice must:

- change one operator or audience outcome;
- preserve established interdependencies;
- include a measurable definition of done;
- pass proportional automated and persona QA;
- update this roadmap when scope, sequence, or evidence changes.

Compact Live Switcher and Sequence 6 handoff (2026-07-13):

- persona scorecard completed across CTO, CPO, CMO, UX, Host, co-host, guest, operator, and TV-viewer lenses;
- the approved render-only compact variant shipped without changing mechanics, schemas, scoring, economy, or orchestration;
- deterministic evidence measured 3 timing choices, 2 recovery actions, 7 visible compact cards, and a 2-action maximum per card;
- authenticated production acceptance passed Trivia and Bingo Audience/interaction/TV/collision/End Mode paths on Hosting release `8a0fc00146a6f351`;
- Sequence 6 now moves to the promised 10-slide executive artifact, using real current-state evidence and clearly labeled documented baselines where historical screenshots do not exist.

Executive 10-slide artifact closure (2026-07-13):

- editable source: `docs/reviews/decks/2026-07-13-beaurocks-executive-plan.html`;
- final PDF: `docs/reviews/decks/2026-07-13-beaurocks-executive-plan.pdf`;
- verified as 10 pages at 960 ÃƒÆ’Ã¢â‚¬â€ 540 points (16:9), with zero slide-boundary violations;
- current screenshots cover room setup, catalog, compact live switching, Audience, TV, and collision guidance;
- unavailable historical screenshots are represented only as explicitly labeled documented baselines;
- the narrative preserves the content-agnostic position, canonical-song/backing model, provider capability truth, YouTube reuse/quota posture, Points/BeauBucks separation, and bounded delivery rule.

Next bounded slice: production-style event-readiness evidence for Apple/background-audio recovery and the YouTube quota-extension packet. Keep Spotify at discovery/external handoff, keep YouTube automation compliant, and avoid new provider or economy schema work in that checkpoint.

Apple/background-audio event-readiness closure (2026-07-13):

- production Hosting release `7aad694505045973` restored unblocked Background/Apple library tabs, added a truthful in-library pause/recovery path, and made active-upload deletion clear local media plus shared room state before Storage deletion;
- live Firebase Storage CORS now includes `https://host.beaurocks.app`, closing the production media-delivery failure while preserving the existing allowed origins;
- authenticated production acceptance proved disposable upload, Host `playing/host_playback`, TV agreement, pause, recovery, Apple connection-required capability, deletion, and Host/TV `off` cleanup;
- the same production persona path passed five-domain room setup, Trivia launch, Singer join/interaction, TV display, the server-rendered missing-recap fallback, End Mode, and return to karaoke;
- final stability evidence is 271 unit-test files / 960 tests, zero lint errors, a passing production build, and a successful Hosting release;
- closure evidence and hashes are recorded in `docs/reviews/2026-07-13-background-audio-event-readiness.md` and its evidence manifest.

Next bounded slice: YouTube event-scale readiness and compliant fallback. Finish the quota-extension evidence packet, add an operator preflight for indexed/curated reuse and search reserve, and prove that search-bucket exhaustion degrades to verified canonical/backing indexes plus approved content-agnostic sources. Do not scrape YouTube, rotate API projects to evade quota, imply Spotify in-app playback, or expand the economy/provider schemas in this slice.
YouTube event-scale readiness closure (2026-07-13):

- production Hosting release `3098b4aa26e1003d` added one Host preflight for known embeddable catalog, room-proven backings, content-agnostic fallbacks, and estimated Search Queries reserve;
- production acceptance observed 115 known embeddable tracks, 14 fallback files/sources, an estimated 100-search browser reserve, and a truthful watchout that three room backings still need proof;
- the preflight explicitly identifies Google Cloud Quotas as the source of truth and keeps approved quota allocations configurable without a code edit;
- Admin now closes the Audio popover and owns the foreground above persistent Host chrome, so Screens + Playback and curator Back navigation are unobstructed;
- stability evidence is 275 unit-test files / 970 tests, passing rules and full callable matrices, zero lint errors, a passing production build, a seven-check persona pass, and a passing authenticated Admin media smoke;
- closure evidence is recorded in `docs/reviews/2026-07-13-youtube-event-scale-readiness.md` and the YouTube product-audit manifest.

Next bounded slice: close the human evidence needed for the YouTube audit submission - live Google Cloud assigned-quota screenshots, controlled exhaustion/cooldown evidence, permanent-delete evidence, final business/contact details, and a measured Search Queries request. Do not add another provider/economy schema or weaken the compliant known-catalog and content-agnostic fallback posture.
YouTube submission-evidence follow-on (2026-07-13):

- authenticated Google Cloud Quotas API evidence confirms the live project assignment is 100 Search Queries/day and 10,000 general units/day, with no project override and increase eligibility enabled;
- an isolated controlled production cooldown capture proves `Fallback Ready`, known-catalog/direct-URL guidance, 14 content-agnostic fallbacks, and the Google Cloud source-of-truth caveat without consuming live quota;
- disposable QA room `26V3` was permanently deleted through the server-authorized production path on Hosting release `ac2b07c988fe1f57`; confirmation/success captures and independent absence checks cover the room, host library, 11 artifact collections, and discovery listings;
- remaining submission evidence is now bounded to the Google Cloud Console presentation screenshot and final business/contact/request fields.

Next bounded slice: capture the Google Cloud Console presentation screenshot, then complete final business/contact fields and measured Search Queries request sizing. No product/provider schema expansion is authorized by this evidence checkpoint.

Program closeout audit (2026-07-14):

- the six-sequence bounded refinement program is production-accepted through Hosting release `ac2b07c988fe1f57` and the active permanent-delete callable;
- controlled cooldown, assigned-quota API, and permanent-delete evidence are complete;
- the production usage ledger records a recent observed baseline of 27 `search.list` calls, 26 `videos.list` calls, 94 total metered YouTube API calls, 13 rooms, and 17 total calls for the highest recorded room in period `202607`;
- the proposed request is `1,000 Search Queries/day`, covering the established 750-search high-event envelope with roughly 33% contingency;
- the remaining YouTube submission gates are the Console presentation screenshot, contact/legal confirmation, request-amount approval, and final read-through;
- BeauBucks remains intentionally canary-only and legacy-balance-authoritative until its published 12-operation / 3-guest / 3-kind reconciliation threshold is met;
- the deployed program state still needs one clean Git checkpoint so production release identifiers map to a reproducible commit.

Closeout scorecard: `docs/reviews/2026-07-14-program-closeout-scorecard.md`.

Next bounded slice: package the deployed program state into a clean source-control checkpoint, then finish the human-owned YouTube submission fields. Do not reopen stable product contracts or promote the BeauBucks canary during closeout.

Production closeout and YouTube handoff (2026-07-14):

- discovery and public charts shipped through Hosting release `1784078708909000` (version `5bc48c15cd873eac`), ruleset `1e8e01b7-b77a-4d9a-9e29-635b7fc1b605`, and ready index `CICAgPigw5IK`;
- application source checkpoint `fbe64d8` and production-acceptance checkpoint `2009d0a` are pushed to `origin/main`;
- the YouTube submission packet now names the current production release and its automated preflight reports `technicalReady: true`;
- required evidence artifacts, `search.list` / `videos.list` / `playlistItems.list` call sites, the 30-day retention contract, and all three live legal URLs pass;
- remaining YouTube work is strictly human-owned: the Console quota screenshot, contact confirmation, legal identity confirmation, and approval of `1,000 Search Queries/day`;
- the remaining chart persona checks have a controlled real-event runbook and must not be satisfied by synthetic `launch_v1` performance data.

Next bounded slice: complete the human YouTube handoff and the three real-event chart persona checks. Until those inputs exist, collect event telemetry without reopening the stable provider, economy, room-setup, or leaderboard contracts.
