# Public Host technical-readiness signoff

Date: 2026-07-18

## Decision

The Host setup and operational-console technical slice is deployed.

This is a technical-readiness signoff, not approval for unrestricted Public Host
beta. Credentialed production create/launch/end QA, moderated first-room testing,
and the roadmap reliability gates in Slices 4 and 5 remain required.

## Shipped behavior

- Host setup remains one guided three-step path: room identity, guest entry, and
  points/rewards.
- Night type, operating model, guest access, Discovery, requested room code,
  and event-credit choices recover after an accidental refresh for seven days.
- Recovery is scoped to the signed-in host so shared browsers cannot leak one
  host's setup choices to another.
- Guest passcodes, claim codes, and promo-code values are never persisted in the
  browser recovery payload.
- Intentionally empty room names and room codes stay empty instead of silently
  restoring deleted text.
- Advanced configuration stays behind progressive disclosure.
- Effective behavior remains summarized from the compiled preset and room
  settings before launch.
- Top-level host navigation clears stale Admin state and restores the canonical
  Queue, Show, Games, or Audience workspace section.
- The browser release gate now follows the current Queue/Add/Catalog rail and the
  intended in-modal Admin-to-Queue handoff.
- QA checks report per-check progress and support opt-in fail-fast diagnostics.

## Release evidence

- Scoped ESLint: zero errors.
- Focused canary/navigation regression suite: 9 tests passed.
- Full unit suite: 293 files, 1,052 tests passed.
- Firestore and Storage rules suite: passed.
- Production Vite build: passed.
- SEO output: 134 prerendered routes and 131 social cards.
- Combined local Host release browser gate: 25 checks passed.
- Full HostApp browser path: 17 checks passed with no unexpected page errors,
  including explicit room-closeout reachability through its disclosure.
- Audience event-profile and branding browser gates passed.
- Live marketing golden path: 9 checks passed.
- Live production assets: `/assets/index-BviCIukw.js` and
  `/assets/HostApp-B8qwZ99N.js`, HTTP 200.
- Hosting release: `1784417860185000`.

## Credentialed production canary status

- The first 2026-07-18 secure canary successfully authenticated the approved
  low-privilege QA host and opened room `YCW7`.
- It then stopped before testing automation behavior because the QA runner was
  waiting for retired Flow-menu copy and the former `Auto Stage Playback`
  location. This was a test-contract failure, not evidence that the production
  automation controls failed.
- The runner now uses stable feature hooks for Flow automation and the Queue
  `Stage Start` control. The correction is deployed in hosting release
  `1784415835155000`.
- The second canary passed login, room open, all core automation controls, share
  link, Public TV QR/room code, and audience join. It then exposed a real
  navigation collision: the open Flow menu remained above Queue/Add and Admin,
  preventing both song entry and failure cleanup.
- Top-level Queue, Show, Games, Audience, and Admin navigation now dismisses all
  transient top menus before switching workspaces. The runner also targets only
  visible responsive controls.
- The canary no longer treats an already-open room as newly created. It returns
  to Room Manager, selects Create Room, requests a unique `QA......` code,
  verifies that new code, and only then begins the lifecycle.
- The navigation and room-isolation corrections are deployed in hosting release
  `1784417860185000`.
- The third canary created isolated room `QAR1SC77` and passed authentication,
  all core automations, share-link generation, Public TV room/QR rendering,
  audience join, host song request, TV synchronization, automatic transition to
  active performance, audience performance state, and audience/TV pop trivia.
- It then stopped in the QA transition from pop trivia to SONGS because the
  responsive audience shell contains two trivia close variants and the runner
  inspected the hidden variant first. The application had already rendered and
  accepted the trivia answer correctly.
- Failure cleanup reached Admin but did not open the disclosure containing Room
  tools, leaving the close button hidden. The runner now opens the containing
  disclosure before requiring the visible closeout control.
- The runner now targets only the visible trivia close, SONGS navigation,
  request tab, and request-form controls. Future failures capture Host, Audience,
  and TV screenshots separately.
- The runner now closes the room and generates its private recap as a required
  final lifecycle check. If an earlier check fails after room creation, it makes
  a bounded best-effort closeout attempt before browser teardown.
- A fresh credentialed run is still required before this production lifecycle
  gate can be marked passed. Rooms `YCW7` and `QAR1SC77` remain pre-cleanup
  test artifacts and may be closed from Room Manager independently of the next
  run.

## Security and stability guardrails

- Recovery keys require a sanitized Firebase host UID scope.
- Empty or unavailable auth scope disables recovery persistence.
- Recovery payloads are versioned, size-bounded, and expire after seven days.
- Malformed or stale values are removed without blocking room setup.
- No callable, database rule, payment, BeauBucks-spend, or public Vibe Index gate
  was widened by this hosting release.

## Remaining Public Host beta gates

1. Re-run `npm run qa:golden:host-room-hands-off:secure` with the approved
   low-privilege QA host credentials. The current canary verifies login, room
   creation, core automation controls, host and audience requests, synchronized
   TV/audience behavior, pop trivia, and room close/private recap. Keep the
   setup edit-to-blank and refresh-recovery checks in the focused setup canary.
2. Moderate first-room setup tests and meet the roadmap thresholds: median under
   three minutes and at least 85% completion without assistance.
3. Complete Slice 4 catalog/playback proof: at least 95% playable-candidate
   success, quota-exhaustion degradation, and provider/background-audio recovery.
4. Complete Slice 5 live-night proof: three representative multi-hour events
   without a severity-one failure and interruption recovery under 60 seconds.
5. Keep BeauBucks commercial spend and public numerical Vibe Index publishing
   behind their existing canaries.

## Next slice

Advance to the combined Content + Live Night reliability closeout (roadmap
Slices 4 and 5), starting with a measurable playable-candidate matrix and the
credentialed production room lifecycle canary.
