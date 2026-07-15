# BeauRocks Program Closeout Scorecard

Date: 2026-07-14
Production baseline: Firebase Hosting release `1784078708909000` (version `5bc48c15cd873eac`), source checkpoint `fbe64d8`, and coordinated Functions/rules/index release
Parent roadmap: `docs/reviews/2026-07-11-original-plan-program-roadmap.md`

## Executive Readout

The six-sequence refinement program has shipped its bounded product slices: catalog/navigation, background audio, room setup, BeauBucks boundaries, game lifecycle simplification, and executive evidence. The application now has a substantially clearer contract across Host, Audience, TV, data, and provider capabilities.

Program closeout does not mean every long-term workstream is finished. The correct closeout posture is:

- close and preserve the production-accepted interaction slices;
- keep BeauBucks balance authority on the legacy room balance until the published canary threshold is met;
- treat catalog themes, game recap expansion, and additional providers as later product work;
- finish the YouTube submission's human-owned evidence fields;
- create a clean Git checkpoint matching what is already live.

## Status By Workstream

| Workstream | Status | Production evidence | Remaining closeout |
| --- | --- | --- | --- |
| Host catalog and canonical songs | Foundation closed | navigation remains visible; album-forward browse; readiness filtering; canonical song separated from backing; alternatives and rankings share canonical identity | measure indexed/canonical reuse over real events; add themes only above readiness threshold |
| Background audio and Apple capability | Closed | upload start/pause/recover/delete; Host/TV truth agreement; Storage CORS; Apple connection boundary | no blocker; monitor event recovery rate and audible-start failures |
| Room setup simplification | Foundation closed | five decision domains and one effective-behavior resolver/provenance preview across quick setup and Mission Setup | measure first-time launch, exception edits, and preset undo behavior before another redesign |
| BeauBucks and event economics | Guarded canary | ledger contract, reconciliation, server-authoritative spend boundary, idempotent replay, operator health panel | readiness remains below `12` accepted operations, `3` guests, and all `3` spend kinds; legacy balance must remain authoritative |
| Games and crowd interaction | Lifecycle slice closed | one lifecycle registry/presentation contract, collision preflight, three timing bundles, compact two-action launcher recovery | Pop Trivia and voice-mode recap completeness remain future mechanics work, not release blockers |
| Persona, brand, and design governance | Closed for this program | CTO/CPO/CMO/persona scorecards and branded 10-slide PDF with current screenshots | continue as a gate on every new slice |
| YouTube event readiness | Product closed; submission nearly ready | compliant fallback, preflight, Quotas API evidence, cooldown capture, permanent-delete capture | Console screenshot, contact/legal confirmation, and approval of the proposed request amount |
| Deployment and QA | Released and source-attributed | checkpoint `fbe64d8`; Hosting release `1784078708909000`; coordinated Functions, ruleset `1e8e01b7-b77a-4d9a-9e29-635b7fc1b605`, and ready index `CICAgPigw5IK`; production golden, cross-surface, charts, authenticated-host, and direct-arrival smokes green | retain evidence and run intentional real-event persona acceptance |
| Discovery and public charts | Production foundation released | server-owned sanitized Global/Song/Public Room projections, canonical-song grouping, account chart identity, `/charts`, Discover teaser, Admin repair/rebuild, approved-host launch preflight, and desktop/mobile production smoke | verify one real qualifying member result, guest exclusion, and public-to-private cleanup during controlled manual QA; do not seed synthetic chart history |

## YouTube Request Sizing

Proposed request: `1,000 Search Queries calls/day`.

Observed production ledger for period `202607`, read on 2026-07-14:

- `27` actual `search.list` calls;
- `26` actual `videos.list` calls;
- `94` total metered YouTube Data API calls across recorded sources;
- `13` rooms represented;
- `17` total YouTube method calls for the highest recorded single room.

This recent monthly aggregate is an observed baseline, not a full historical peak trace. The established five-hour, 150-person planning envelope models `120`, `300`, and `750` live searches for low, medium, and high engagement. A `1,000/day` request covers the high envelope with roughly 33% contingency. The paired validation work remains well below the assigned `10,000` general-data-unit bucket.

## Closeout Gates

### Gate 1: Human-owned YouTube submission fields

- capture the Google Cloud Console presentation screenshot showing the assigned Search Queries and general-data limits;
- confirm `hello@beaurocks.app` as the audit/legal contact;
- confirm the legal operator/product name used on Terms, Privacy, and deletion pages;
- approve or adjust the proposed `1,000 Search Queries/day` request;
- perform one final narrative read-through against Hosting release `ac2b07c988fe1f57`.

### Gate 2: Source-control reproducibility

- review the accumulated program diff for credentials and disposable QA artifacts;
- retain evidence, contracts, tests, and release manifests that explain the live behavior;
- exclude local credentials, transient browser state, and disposable room identifiers that are not intentional evidence;
- run `git diff --check`, unit, lint, build, rules, and callable gates at the checkpoint;
- commit and push one intentional program checkpoint, then record its commit SHA next to the live Hosting and Function release identifiers.

### Gate 3: BeauBucks migration hold

Do not change balance-read authority until all published readiness conditions pass:

- at least `12` accepted canary spend operations;
- at least `3` distinct guests;
- reaction, profile-change, and avatar-unlock coverage;
- at least one safe replay;
- zero operation/ledger gaps;
- untruncated evidence and exact reconciliation;
- explicit opening-balance policy and compensating entries.

Current production evidence remains intentionally below that threshold. This is a safe guardrail, not an unfinished deployment.

### Gate 4: Public chart launch

- record a fresh `launch_v1` chart-era boundary; do not seed historical performances;
- include only signed-in member performances recorded by an approved room owner under the versioned qualification contract;
- keep guests room-only and keep raw performance history self-readable;
- group song charts by canonical song regardless of backing rendition;
- publish night aggregates only for approved public directory listings;
- verify public-name and anonymous identity modes without adding a room-entry prompt;
- prove retry idempotency and public-to-private cleanup in emulator tests;
- deploy Functions, Firestore rules, and Hosting together, then smoke `/charts`, Discover, profile identity, and one real qualifying result.

## Success Measurement For The Next Real Events

Capture these measures without adding new Host controls:

- percentage of song intents resolved from curated, room, account, global, or canonical indexes before live YouTube search;
- live `search.list` calls per room and per event day;
- embeddable acceptance rate and non-embeddable rejection count;
- background-audio audible-start success, recovery action rate, and Host/TV truth mismatches;
- first-time room launch completion, advanced-exception opens, and setup undo/edit rate;
- game launch collisions prevented, launcher recovery actions, and audience join-to-first-action completion;
- BeauBucks accepted, duplicate, insufficient, and ledger-gap counts by spend kind.

These measures determine later slices. They should not reopen the stable contracts merely to manufacture activity.

## Deferred Product Work

The following are legitimate roadmap extensions, not closeout blockers:

- weak-theme internal curation queue and additional ready themes;
- Spotify or new playback providers after policy/licensing/capability review;
- BeauBucks refunds, expirations, generalized game costs, and balance migration;
- deeper Pop Trivia and voice-game recap mechanics;
- further room-setup visual reduction after observed host-behavior data;
- broader provider/catalog schemas.
- shareable singer/song/night chart detail pages, weekly seasons, and richer chart filters until the base projection has real-event evidence.

## Recommended Immediate Sequence

1. Complete the three intentional chart persona checks during controlled manual QA: one qualifying member result, one guest result, and one public-to-private transition.
2. Capture the Google Cloud Console quota screenshot, confirm contact/legal identity and the `1,000/day` request amount, and submit the packet.
3. Run the next real event with the guarded contracts and collect the success measurements above.
