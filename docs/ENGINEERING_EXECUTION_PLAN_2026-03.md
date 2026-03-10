# Engineering Execution Plan (March 2026)

Last updated: 2026-03-09

## Purpose

Turn the current codebase from founder-operated momentum into a safer production system that another experienced developer could reason about, deploy, and extend.

This plan is intentionally narrow. For the next 30 days, prioritize:

1. Host-night reliability
2. Production safety and rollback clarity
3. Smaller ownership boundaries in critical code paths
4. Repeatable QA that does not depend on tribal knowledge

## Core Product Contract

The release-critical contract for this repo is:

1. Host can authenticate and open/create a room.
2. TV can attach to the room and show a valid join path.
3. Audience can join from phone without dead ends.
4. Host and audience requests synchronize across host, TV, and audience.
5. Lyrics/media/performance flow remains stable through an active song.

Everything else is secondary until this path is boringly reliable.

## Operating Rules

- No deploy without the canonical core-night smoke passing.
- No new client-owned critical workflow when a backend-owned workflow is feasible.
- No business rule duplication across React effects and Cloud Functions.
- No net-new large-file growth in `src/apps/Host/HostApp.jsx` or `functions/index.js`.
- If an operational requirement matters twice, document it.

## Mandatory Release Gate

Primary gate for production-facing changes:

```powershell
npm run qa:release:core-night
```

Supporting checks for launch-sensitive work:

```powershell
npm run lint
npm run build
npm run test:unit
npm run test:callables
npm run qa:p0
```

## Workstreams

### WS1: Core Night Reliability

#### EX-01: Freeze and document the core-night contract

- Outcome: one canonical release contract for host, audience, TV, and queue sync.
- Primary targets:
  - `docs/releases/HOSTING_RELEASE_CHECKLIST.md`
  - `docs/qa/HANDS_OFF_QA_DUAL_TRACK_RUNBOOK_2026-03-04.md`
  - `README.md`
- Exit criteria:
  - release-critical flow is explicitly named
  - "nice to have" checks are separated from blocking checks
  - another developer can tell what blocks a deploy
- Status: completed 2026-03-09

#### EX-02: Add a single "core-night release" command

- Outcome: one command that expresses the real production release gate.
- Primary targets:
  - `package.json`
  - `scripts/qa/run-host-room-hands-off-secure.mjs`
  - `scripts/qa/host-room-hands-off-golden-playwright.mjs`
- Exit criteria:
  - one command runs the required smoke
  - failure output points at likely operator action
  - release docs reference the same command
- Status: completed 2026-03-09 via `npm run qa:release:core-night`

#### EX-03: Expand smoke evidence for the active performance path

- Outcome: release smoke proves more than login/create/join.
- Primary targets:
  - `scripts/qa/host-room-hands-off-golden-playwright.mjs`
  - `scripts/qa/lib/roomCode.js`
  - `src/apps/Mobile/SingerApp.jsx`
  - `src/apps/TV/PublicTV.jsx`
- Exit criteria:
  - smoke verifies request propagation to active performance state
  - smoke verifies Pop Trivia on audience and TV during a performing song
  - failure screenshots and errors are still readable
- Status: completed 2026-03-09 via `npm run qa:release:core-night` on room `8SAJ`

### WS2: Operational Safety

#### EX-04: Canonical production ops runbook

- Outcome: a second operator can deploy and verify production without asking for oral history.
- Primary targets:
  - `docs/APP_CHECK_CUTOVER_RUNBOOK.md`
  - `docs/releases/HOSTING_RELEASE_CHECKLIST.md`
  - `docs/qa/HANDS_OFF_QA_DUAL_TRACK_RUNBOOK_2026-03-04.md`
- Exit criteria:
  - App Check, QA identity policy, and rollback steps are documented
  - production smoke prerequisites are explicit
  - secrets are referenced by name, never by value

#### EX-05: Production diagnostics for stuck async states

- Outcome: pending/failed automation states are discoverable and recoverable.
- Primary targets:
  - `functions/lib/popTrivia.js`
  - `functions/lib/lyrics/resolveLyricsForSong.js`
  - `functions/index.js`
  - `scripts/ops/overnight-product-intelligence.mjs`
- Exit criteria:
  - critical async pipelines define pending, failed, retry, and recovery behavior
  - production diagnostics can identify rooms/songs stranded in bad states
  - runbooks tell the operator what to inspect first
- Status: completed 2026-03-09 via async pipeline audit tooling and overnight integration; local audit path verified, live Firestore scan requires admin credentials

### WS3: Ownership Boundaries

#### EX-06: Continue extracting host access and room-launch logic from `HostApp`

- Outcome: host auth/access/launch logic stops living inside one giant component.
- Primary targets:
  - `src/apps/Host/HostApp.jsx`
  - `src/apps/Host/missionControl.js`
  - `src/apps/Marketing/hooks/useDirectorySession.js`
  - `src/apps/Marketing/hooks/hostAccessState.js`
- Exit criteria:
  - host access state logic is pure/shared where possible
  - room launch orchestration is isolated from large render paths
  - changes to host approval do not require reading unrelated host UI code
- Status: completed 2026-03-10 via `useHostLaunchFlow` + `useHostRoomEntry`; production release gate passed on room `43UU`

#### EX-07: Split high-risk Cloud Functions domains out of `functions/index.js`

- Outcome: lyrics, Pop Trivia, and host-access rules become separately owned modules.
- Primary targets:
  - `functions/index.js`
  - `functions/lib/lyrics/*`
  - `functions/lib/popTrivia.js`
  - new domain modules under `functions/lib/`
- Exit criteria:
  - `functions/index.js` becomes registration/composition oriented
  - entitlement logic is not duplicated across callables and triggers
  - domain tests can run without importing the whole file

#### EX-08: Centralize AI policy and entitlement decisions

- Outcome: AI usage rules are obvious, consistent, and testable.
- Primary targets:
  - `functions/lib/lyrics/aiAccess.js`
  - `functions/lib/geminiClient.js`
  - `src/lib/firebase.js`
  - `tests/unit/lyricsAiAccess.test.cjs`
  - `tests/integration/hostAccessGuardrails.test.cjs`
- Exit criteria:
  - whitelist, super-admin, paid entitlement, and demo bypass rules are explicit
  - "secret exists" never acts as authorization
  - fallback behavior under quota/provider failure is documented and tested

### WS4: Public Launch Discipline

#### EX-09: Draw a clean line between incubation policy and public policy

- Outcome: temporary exceptions do not quietly become the product model.
- Primary targets:
  - `functions/index.js`
  - `src/apps/Host/HostApp.jsx`
  - `docs/marketing/AI_FEATURE_MATRIX.md`
  - `docs/billing-iap.md`
- Exit criteria:
  - temporary whitelist/bypass logic is isolated and named
  - public entitlement policy is documented separately from incubation exceptions
  - host-facing copy does not misrepresent who has access to paid AI paths

#### EX-10: Prune or mark superseded docs

- Outcome: planning docs stop competing with each other.
- Primary targets:
  - `BACKLOG.md`
  - `docs/TECH_RISKS_PRIORITIES.md`
  - `docs/releases/*`
  - `docs/marketing/*`
- Exit criteria:
  - one primary backlog exists
  - architecture/runbook docs are clearly current or clearly historical
  - developers can find the active source of truth quickly

## Suggested Order

Week 1:
- EX-01
- EX-02
- EX-04

Week 2:
- EX-03
- EX-06

Week 3:
- EX-05
- EX-07
- EX-08

Week 4:
- EX-09
- EX-10

## Success Criteria By April 2026

- Production deploys have one agreed release gate.
- A low-privilege QA host can run the main smoke without operator improvisation.
- Host access, App Check, lyrics, and Pop Trivia flows have clear ownership boundaries.
- `HostApp.jsx` and `functions/index.js` are smaller or at least no longer accumulating new cross-domain logic.
- Another experienced developer can read the runbooks and operate the system safely.
