# Refinement Execution Plan

Date: 2026-07-06

## Goal

Finish the current Apple Music, YouTube quota, canonical backing, and host-simplicity refinement line without expanding scope.

This plan is designed to be executable without additional product input. When tradeoffs appear, default to:

- preserving one obvious host control path
- protecting event-day YouTube live search capacity
- preferring known embeddable YouTube backing tracks before live search
- keeping Apple Music host-owned and background/setup-oriented
- proving behavior with focused tests and production evidence

## Current Strategic Direction

The product direction remains:

1. YouTube is the primary karaoke backing source.
2. Apple Music is the host's source for background music, full-song fallback, song identity, and playlist-driven vibe.
3. The host should not manage separate start/stop controls for background sources.
4. Known YouTube tracks should become a durable ranked backing catalog tied to canonical songs.
5. The YouTube quota-extension packet should describe real deployed behavior, not future intent.

## Non-Negotiable Product Rules

- The BG button remains the single runtime start/stop control for background music.
- Apple Music setup can include `Connect`, `Use for BG`, and `Play Now`, but must not add separate Apple pause/resume controls.
- YouTube karaoke backing stays available from host and audience flows.
- Broader YouTube search and pasted YouTube URLs are allowed only when the result can play inside BeauRocks.
- Non-embeddable or unknown-playback YouTube tracks cannot be promoted as canonical ranked backing candidates.
- Host-facing UI should favor larger controls, clear labels, and less explanatory text.
- Admin/config surfaces may configure defaults; Live Deck/runtime surfaces own show-time operations.

## Slice 1: Integration QA And Complexity Pass

### Purpose

Confirm that the new Apple Music, YouTube, known-backing, and background-music layers are wired together without increasing host mental load.

### Files And Surfaces To Inspect

- `src/apps/Host/HostApp.jsx`
- `src/apps/Host/components/AutomationControls.jsx`
- `src/apps/Host/components/HostTopChrome.jsx`
- `src/apps/Host/components/HostQueueTab.jsx`
- `src/apps/Host/components/AddToQueueFormBody.jsx`
- `src/apps/Host/components/QueueYouTubeSearchModal.jsx`
- `src/apps/Host/hooks/useQueueMediaTools.js`
- `src/apps/Host/hooks/useQueueSongActions.js`
- `src/apps/Host/hooks/useQueueTabState.js`
- `src/apps/Host/queueSongReviewActions.js`
- `src/apps/Mobile/SingerApp.jsx`
- `src/apps/TV/PublicTV.jsx`
- `src/lib/playbackSource.js`
- `src/lib/songRequestResolution.js`

### Flow Checklist

Review these flows in code and, where feasible, in the browser:

1. Host starts built-in background music with no Apple playlist configured.
2. Host connects Apple Music, selects a playlist with `Use for BG`, then starts/stops it through the shared BG control.
3. Host uses `Play Now` from Apple setup and still sees BG as the durable runtime control.
4. Host queues a normal karaoke performance with a YouTube backing.
5. Host queues or reviews a request where a `Known backing` is available.
6. Host pastes a YouTube URL into the add/review flow.
7. Host switches between karaoke-focused YouTube search and broader embeddable YouTube search.
8. Audience searches or requests a song without seeing host-only Apple Music controls.
9. Public TV shows Apple background playback clearly without implying Apple is the karaoke backing.
10. Public TV shows YouTube karaoke backing or known backing labels clearly during performances.

### Specific Things To Verify

- There is no second Apple-specific pause/resume/stop control competing with BG.
- `Use for BG` reads as setup, not playback.
- `Play Now` is secondary and does not imply a separate durable music mode.
- The selected Apple playlist title appears near existing background controls where helpful.
- Host review labels use shared source language:
  - `Apple Music full song`
  - `YouTube karaoke backing`
  - `Known backing`
- Audience surfaces do not expose Apple Music account/library concepts.
- YouTube URL paste remains quick and does not force the host through search.
- Broad YouTube search is available but visually lightweight.
- Embeddability failures are blocked or clearly unavailable.
- Catalog health is visible without becoming another control panel.

### Commands

Run targeted source scans:

```powershell
rg -n "Apple Music|Use for BG|Play Now|BG|Known backing|YouTube karaoke backing|embeddable|sourceDiscovery" src/apps src/lib
rg -n "pause|resume|stop|start" src/apps/Host src/apps/TV src/apps/Mobile
```

If the app can build locally, run a dev server and inspect the main host/mobile/TV surfaces. Do not block the entire refinement line on visual QA if local env setup is unavailable; record the limitation and continue with static and test verification.

### Fix Policy

Make narrow fixes only:

- remove duplicate controls
- rename unclear labels
- route actions through existing BG or queue paths
- reduce explanatory copy
- enlarge controls only where it improves scanability without layout churn

Do not add new user-facing modes unless an existing flow is broken without one.

### Acceptance Criteria

- A host can explain background music in one sentence: choose the source in setup, use BG to start/stop.
- YouTube karaoke backing remains obvious and available.
- Known backings appear as helpful suggestions, not a new workflow.
- Audience and TV labels are source-clear without exposing host setup complexity.
- No duplicate runtime music controls remain.

## Slice 2: Focused Test Stabilization

### Purpose

Make sure the broad change set did not break existing behavior, especially around host controls, queue review, playback source labels, YouTube indexing, and canonical backing persistence.

### Test Priority Order

1. Syntax and function load checks.
2. Focused unit tests for changed utilities and host flow helpers.
3. Integration tests for callables and Firestore persistence.
4. Broader affected test groups.
5. Build/typecheck only after focused tests are stable.

### Commands

Run in this order:

```powershell
node --check functions/index.js
npm run test:unit -- tests/unit/playbackSource.test.mjs
npm run test:unit -- tests/unit/queueSongReviewActions.test.mjs
npm run test:unit -- tests/unit/songRequestResolution.test.mjs
npm run test:unit -- tests/unit/backingTrackRanking.test.mjs
npm run test:unit -- tests/unit/backingCandidatesServer.test.mjs
npm run test:unit -- tests/unit/youtubeIndexMaintenance.test.mjs tests/unit/youtubeIndexMaintenanceServer.test.mjs
npm run test:unit -- tests/unit/hostBackgroundMusicControlsSource.test.mjs tests/unit/appleQueueIntentSource.test.mjs
npm run test:callables:media-catalog
npm run test:unit -- tests/unit/curatedKaraokeIndexSource.test.mjs tests/unit/hostRunOfShowControls.test.mjs
npm run lint
```

If a command does not exist or the local environment lacks a dependency, use the nearest existing package script and document the limitation.

### Failure Triage Rules

Fix failures in this order:

1. Broken behavior from current changes.
2. Test expectations that are stale because labels or source metadata intentionally changed.
3. Existing unrelated failures only if they block the targeted suite.

Do not widen the feature scope while fixing tests.

### Expected High-Risk Areas

- source label changes in `src/lib/playbackSource.js`
- queue review action payloads in `src/apps/Host/queueSongReviewActions.js`
- canonical backing candidate writes in `functions/lib/backingCandidates.js`
- YouTube index refresh/backfill in `functions/lib/youtubeIndexMaintenance.js`
- callable behavior in `functions/index.js`
- Host component prop contracts after UI simplification

### Acceptance Criteria

- Focused unit tests pass.
- Callable/media catalog integration tests pass.
- Any remaining broad-suite failures are documented as pre-existing or unrelated.
- No test fix reintroduces duplicate host controls or weakens embeddability guards.

## Slice 3: Host UX Polish

### Purpose

Make the refined flows easier to operate live: larger, clearer, less text-heavy, and with fewer decisions at show time.

### UX Principles

- Prefer clear action labels over explanatory paragraphs.
- Prefer existing controls over new controls.
- Runtime controls belong in Live Deck/top host surfaces.
- Setup/configuration belongs in Media Setup/Admin surfaces.
- Important labels should be readable at a glance on a laptop during a loud room.
- Text must fit on mobile and desktop without overlap.

### Files To Inspect

- `src/apps/Host/HostApp.jsx`
- `src/apps/Host/components/AutomationControls.jsx`
- `src/apps/Host/components/HostTopChrome.jsx`
- `src/apps/Host/components/HostQueueTab.jsx`
- `src/apps/Host/components/AddToQueueFormBody.jsx`
- `src/apps/Host/components/QueueYouTubeSearchModal.jsx`
- `src/apps/Mobile/SingerApp.jsx`
- `src/apps/TV/PublicTV.jsx`

### Polish Checklist

Apple Music setup:

- `Connect` is obvious.
- `Use for BG` is the primary playlist action.
- `Play Now` is secondary.
- Paste URL/ID is available as fallback, not the first thing a host sees.
- Selected playlist state is visible but compact.
- No Apple-specific stop/pause/resume appears.

YouTube request/search:

- Karaoke-focused mode remains the default.
- Broader embeddable search is easy to toggle but does not dominate the UI.
- Paste URL is quick and direct.
- Non-embeddable results have a clear unavailable state.
- Source labels are concise and consistent.

Known backing:

- `Known backing` is visually positive but not overexplained.
- Host can accept it with the same normal queue/review action path.
- Ranking detail stays behind the scenes unless needed for diagnostics.

TV:

- Apple background playback is clearly background.
- YouTube backing is clearly performance media.
- Labels are large enough for a room display.
- Avoid overlapping overlays and small explanatory copy.

### Implementation Guardrails

- Do not introduce new color systems or broad layout rewrites.
- Do not create nested cards.
- Do not add another player UI.
- Keep touch targets large enough for live use.
- Keep labels stable for tests.

### Acceptance Criteria

- The host can operate the media flow with minimal reading.
- The largest remaining text is action-oriented.
- Existing functionality remains present.
- The UI has fewer visible concepts than the underlying system.

## Slice 4: Deploy And Evidence Capture

### Purpose

Move from repo-ready to submission-ready for YouTube quota/audit work.

### Pre-Deploy Checklist

- Focused tests from Slice 2 are passing or documented.
- Compliance docs match implemented behavior.
- Public legal routes exist:
  - `/karaoke/terms`
  - `/karaoke/privacy`
  - `/karaoke/data-deletion`
- YouTube disclosure surfaces exist on relevant host/audience search surfaces.
- No known code blocker remains for the quota-mitigation story.

### Deploy Commands

Use the repo's existing deployment scripts. Start with build validation:

```powershell
npm run build
npm run deploy:hosting
```

If functions changed and are ready for production:

```powershell
npx firebase-tools deploy --only functions
```

If Firestore rules changed:

```powershell
npx firebase-tools deploy --only firestore:rules
```

Only deploy functions/rules when their related tests have passed.

### Production Verification URLs

Verify without login where applicable:

- `https://beaurocks.app/karaoke/terms`
- `https://beaurocks.app/karaoke/privacy`
- `https://beaurocks.app/karaoke/data-deletion`

Verify host/audience/TV surfaces using a test room:

- host media setup
- host YouTube search/index flow
- audience request/search flow
- public TV playback display
- quota exhaustion fallback if practical to simulate
- room permanent-delete path

### Screenshot Packet

Capture:

- Google Cloud Console YouTube Data API quota page for the live project
- Terms page
- Privacy page
- data deletion page
- host YouTube search/index surface with disclosure
- audience YouTube request/search surface
- quota exhaustion fallback state
- Room Library Curator catalog health/status strip
- indexed track management surface
- known backing suggestion in host review
- Apple Music selected BG playlist state
- TV showing Apple Music background playback
- TV showing YouTube karaoke backing/performance source
- room permanent-delete path

### Submission Packet Update

Update or confirm:

- `docs/compliance/YOUTUBE_QUOTA_EXTENSION_PACKET_2026-07-06.md`
- `docs/compliance/YOUTUBE_AUDIT_SUBMISSION_DRAFT.md`
- `docs/compliance/YOUTUBE_AUDIT_PACKET_CHECKLIST.md`
- `docs/compliance/YOUTUBE_SUBMISSION_BLOCKERS.md`

### Acceptance Criteria

- Production legal URLs are live and accurate.
- Screenshots match the written submission narrative.
- Google Cloud quota evidence is captured from the live project.
- The packet is ready to submit without describing unshipped behavior.

## Slice 5: Production Feedback Loop

### Purpose

Use real event behavior to improve ranking, quota usage, and host simplicity after the next party.

### Data To Review After Each Event

YouTube usage:

- live YouTube searches performed
- searches avoided by cache
- searches avoided by room/global/account index
- searches avoided by canonical backing candidates
- quota exhaustion or cooldown events
- direct pasted YouTube URLs
- non-embeddable blocked results

Backing quality:

- `Known backing` suggestions shown
- known backings accepted
- known backings rejected
- host/co-host good-track signals
- bad-track signals
- completed performances
- skipped performances
- singer overrides

Apple Music:

- Apple connection success/failure
- playlist selected for BG
- BG started/stopped through shared BG path
- Play Now usage
- fallback to built-in background tracks
- TV display correctness for Apple background

Host simplicity:

- moments where host switched search mode
- pasted URL usage
- repeated failed searches
- manual corrections after known backing suggestions
- any duplicate or confusing control seen in screenshots/session review

### Reports To Produce

After a high-usage event, produce:

1. Event media recap:
   - total performances
   - YouTube-backed performances
   - Apple full-song/fallback performances
   - background source timeline
   - top accepted known backings
   - top rejected/failed backings

2. YouTube quota recap:
   - live search count
   - indexed/cache/canonical reuse count
   - known-ID refresh count
   - quota fallback incidents
   - recommended reserve changes

3. Catalog learning recap:
   - canonical songs with new backing candidates
   - candidates promoted by host feedback
   - candidates demoted by host feedback
   - candidates removed for non-embeddability

4. UX friction recap:
   - controls that caused hesitation
   - labels that were unclear
   - flows that took too many clicks
   - opportunities to remove or merge UI

### Ranking Adjustment Rules

Adjust ranking conservatively:

- host/co-host feedback outweighs audience feedback
- completed performances are stronger positive signals than simple selection
- skips and bad-track signals demote heavily
- YouTube view count remains a weak prior only
- non-embeddable or unknown-playback candidates stay ineligible for in-app ranking promotion

### Operational Cadence

Before event:

- confirm legal/YouTube compliance surfaces are live
- ensure YouTube key is configured
- ensure Apple Music token function is healthy
- check catalog health/status
- test BG start/stop with selected Apple playlist or built-in fallback

During event:

- use BG as the only background start/stop control
- use YouTube URL paste when the host already has the right track
- use broad YouTube search only when karaoke-focused search is too narrow
- mark good/bad tracks when obvious, but do not require extra host work

After event:

- run event recap
- review quota and fallback events
- inspect newly learned canonical candidates
- prune or demote bad candidates
- update the next slice plan based on real friction, not imagined edge cases

### Acceptance Criteria

- Each event makes the catalog smarter.
- Each event reduces future repeated live search for the same songs.
- Host feedback improves rankings without adding a required workflow.
- Production evidence improves the YouTube quota-extension case.
- UX changes are driven by observed host friction.

## Autonomous Execution Order

Execute in this order:

1. Slice 1: static integration and complexity pass.
2. Slice 2: focused tests and behavior stabilization.
3. Slice 3: narrow UX polish only where Slice 1 or tests reveal friction.
4. Slice 4: deploy and evidence capture once code is stable.
5. Slice 5: event feedback loop after production usage.

## Stop Conditions

Pause and report instead of continuing if:

- a production deploy requires credentials or account access unavailable in the local environment
- test failures indicate a real data-loss or payment/security issue
- Apple Music API behavior contradicts the planned host-owned setup model
- YouTube compliance docs require a legal/business answer not present in the repo
- a proposed fix would add a new host-facing mode or duplicate runtime music control

## Definition Of Done

This refinement line is done when:

- host background music has one runtime control
- Apple Music setup is useful and compact
- YouTube backing search remains quick and embeddability-safe
- known backings are reused before live search
- canonical backing candidates accumulate host-quality signals
- focused tests pass
- production screenshots and quota evidence are captured
- the YouTube quota-extension submission packet is ready to file
