# Project History and Lessons Learned

Last updated: 2026-04-16

## 2026-04-16 Run Of Show Admin Simplification and Full Deploy Notes

Scope delivered:
- Simplified the admin run-of-show surface from `build/review/run` into `build/preflight/run`.
- Removed the separate review mode and replaced it with a shared repair queue for approvals, critical blockers, and risky items.
- Moved slot assignment into preflight.
- Moved low-frequency live controls behind `More Controls`.
- Deployed the full Firebase project from the current workspace to `beaurocks-karaoke-v2`.

Validation evidence captured:
- `npm run build`: pass.
- `npx vitest run tests/unit/runOfShowDirector.test.mjs`: pass.
- `npm run qa:host:run-of-show`: pass.
- `npm run qa:host:run-of-show:app`: pass.
- `npx firebase-tools emulators:exec --project demo-bross --only firestore "node tests/integration/runOfShowActions.test.cjs"`: pass.
- `npx firebase-tools emulators:exec --project demo-bross --only firestore "node tests/integration/runOfShowSlotSubmissions.test.cjs"`: pass.
- `npx firebase-tools deploy --non-interactive`: pass.

Important operational notes:
- In this repo, `npx firebase-tools deploy --non-interactive` deploys `storage`, `firestore`, `functions`, and `hosting` to the default Firebase project in `.firebaserc`, currently `beaurocks-karaoke-v2`.
- A full deploy from a dirty worktree ships all currently modified deployable surfaces, not just the feature under discussion.
- The run-of-show browser QA now assumes:
  - `Preflight` owns slot assignment
  - `More Controls` reveals the live adjustment panel
  - the old standalone `review` screen no longer exists

Lessons learned and process changes:

1. Treat UX phase names as test contracts.
- Lesson: when the product flow changed from `review` to `preflight`, the Playwright checks broke even though the product behavior was correct.
- Change adopted: whenever host workflow labels or mode boundaries change, update the browser QA in the same pass.

2. Keep behavior coverage below the UI layer.
- Lesson: browser smoke tests are useful for reachability and layout, but they are the first thing to go brittle during UX simplification.
- Change adopted: preserve the underlying run-of-show behavior checks in unit and Firestore-backed integration tests so UI smoke can stay focused on workflow reachability.

3. Record the meaning of `deploy all` before running it.
- Lesson: “deploy all” is ambiguous in conversation but concrete in this repo: it means the whole Firebase config for the default project.
- Change adopted: before any future full deploy, confirm `.firebaserc`, `firebase.json`, and the current git worktree so there is no confusion about blast radius.

## 2026-03-10 Audience Join Recovery and QA Account Notes

Scope delivered:
- Hardened audience join so it waits for a real auth UID, warms App Check before the first `room_users` write, and retries once on the auth/App Check permission-denied path.
- Deployed the audience join fix to Firebase Hosting project `beaurocks-karaoke-v2`.
- Recovered production smoke capability without using super-admin by creating a fresh dedicated QA host account and granting normal host approval records.

Validation evidence captured:
- `npm run build`: pass.
- `npx firebase-tools deploy --only hosting`: pass.
- Production `host-room-hands-off` smoke with the dedicated QA host account:
  - host login: pass
  - host room creation: pass
  - audience join: pass
  - later audience performance/Pop Trivia progression: still failing and treated as a separate bug

Important operational notes:
- The audience join permission error was resolved in production; later audience-surface progression failures were not part of the same defect.
- A dedicated non-superadmin QA host account is sufficient for production smoke when it has normal host approval records.
- Do not rely on memory for the QA account. Keep the current email and password in a real secret store and keep `QA_ALLOWED_HOST_EMAILS` synchronized with that account.

Lessons learned and process changes:

1. Document the QA account recovery path, not just the happy path.
- Lesson: the runbook described how to pass QA credentials into the smoke runner, but not how to recover when the team forgets which dedicated QA account is active.
- Change adopted: the QA runbook now includes a concrete recovery/provisioning path based on Firebase Auth export plus `host_access_approvals` records.

2. Separate join permission failures from post-join UI-state failures.
- Lesson: a single audience smoke failure can hide multiple defects if the investigation stops at the first visible symptom.
- Change adopted: treat "audience can join" and "audience advances into active performance state" as separate checkpoints during production smoke triage.

## 2026-03-08 Host Quick-Start and Production Smoke Notes

Scope delivered:
- Removed the duplicate/inert create-room CTA from Host Dashboard landing.
- Changed new-room post-create flow to land on the live deck instead of full admin.
- Added a live-deck quick-start banner with direct actions for Public TV, join-link copy, and Room Setup.
- Added progress tracking to that quick-start checklist so actions mark complete as the host uses them.
- Renamed ambiguous `Rooms` navigation to `Room Manager` in host chrome and admin header.
- Deployed the host UX changes live to Firebase Hosting project `beaurocks-karaoke-v2`.

Validation evidence captured:
- `npx eslint src/apps/Host/HostApp.jsx src/apps/Host/hooks/useHostLaunchFlow.js src/apps/Host/components/HostTopChrome.jsx`: pass.
- `npm run build`: pass.
- `npx firebase-tools deploy --only hosting --non-interactive`: pass.
- Hosting URL deployed: `https://beaurocks-karaoke-v2.web.app`

Production QA findings:
- A dedicated low-privilege QA host account was created in production Auth and granted host approval access for smoke testing.
- Automated authenticated production smoke could sign in, but full host-access automation was blocked by App Check enforcement on `getMyHostAccessStatus`.
- Direct callable verification confirmed the remaining blocker was App Check, not missing host approval records or broken auth credentials.
- The existing hands-off Playwright host script is stale against the current host/marketing shell and also mis-read `SETUP` from quick-start copy as a room code.

Important operational notes:
- Do not store QA host passwords in repo markdown. Keep credentials out-of-band and rotate or remove the QA account after testing.
- Host-access automation on production now depends on a browser session obtaining a valid App Check token before host-access callables can succeed.
- Backend host approval alone is sufficient for host workspace access, but the production marketing/host-access surface still cannot be smoke-tested headlessly unless App Check is satisfied in automation.

Lessons learned and process changes:

1. Land first-run hosts in the surface they actually operate from.
- Lesson: dumping a newly created room into full admin makes the room feel abstract and configuration-heavy.
- Change adopted: new rooms should open on the live deck, with admin linked as a secondary action.

2. Keep onboarding guidance inside the live experience.
- Lesson: quick-start guidance is more useful as a lightweight checklist on the live deck than as a forced admin detour.
- Change adopted: put first-run setup prompts in a dismissible banner with direct action links and completion feedback.

3. Use explicit navigation labels when surfaces are conceptually different.
- Lesson: `Rooms` was too vague once the app had both live-deck and admin surfaces.
- Change adopted: use `Room Manager` where the destination is the room-chooser/landing workspace.

4. Treat production App Check as a first-class QA dependency.
- Lesson: a valid production Auth account plus correct Firestore approval records are still insufficient for automated smoke coverage when App Check gates the host-access callables.
- Change adopted: any future production smoke plan must include an App Check-compatible automation path, not just QA credentials.

5. Keep golden-path QA scripts aligned with current UI contracts.
- Lesson: the legacy host hands-off script assumed older host-access routing and weak room-code extraction rules, which produced false failures after the quick-start UX changes.
- Change adopted: update Playwright golden paths whenever host landing copy, navigation, or room-code presentation changes.

## 2026-02-11 Overnight Execution Retrospective

Scope delivered:
- WS1 Fame UX improvements.
- WS2 shared user-meta component extraction.
- WS3 room-user data consistency hardening.
- WS4 onboarding bootstrap callable integration.
- WS5 capability gating across client and backend.
- WS6 pass-through plus markup invoice and QBSE hardening.

Validation evidence captured:
- `npm run build`: pass.
- `npm run lint`: repository has pre-existing lint failures; treat as baseline debt and track delta on touched files.
- `npm run test:rules`: blocked in local environment because Java runtime is missing.

Primary risks observed during execution:
- Existing repo-wide lint debt can mask newly introduced regressions.
- Encoding drift (BOM/mojibake) can silently corrupt UI copy and slow patching.
- Large cross-cutting backend diffs increase review and rollback friction.

Primary lesson themes:
1. Baseline repo health before feature execution.
2. Protect encoding and file format consistency during edits.
3. Add targeted backend tests for monetization and entitlement logic.
4. Keep large changes split into reviewable workstream commits.

Lessons learned and process changes:

1. Baseline lint debt before implementation.
- Lesson: Running full lint only at the end made it harder to separate pre-existing failures from new regressions.
- Change adopted: Run a scoped baseline lint snapshot before coding and track only delta errors for touched files.

2. Enforce encoding hygiene from first edit.
- Lesson: UTF-8 BOM and mojibake issues caused avoidable rework in UI copy and patch flow.
- Change adopted: Verify UTF-8 without BOM for touched files and run a quick text-sanity scan before final validation.

3. Add focused tests for high-risk backend logic.
- Lesson: Capability enforcement and invoice math changes are high-impact and should not rely only on manual checks.
- Change adopted: Add targeted tests for:
  - capability denied and allowed paths for gated callables,
  - rate-card to line-item invoice math,
  - QBSE CSV field mapping consistency.

4. Ship in smaller, auditable increments.
- Lesson: Large cross-cutting diffs reduce review clarity and slow rollback decisions.
- Change adopted: Keep one commit per workstream with explicit acceptance checks and rollback notes.

5. Record validation blockers explicitly.
- Lesson: Environment blockers (for example missing Java for rules emulator tests) can be missed if not documented during handoff.
- Change adopted: Every delivery entry must include pass, fail, and blocked validations with exact blocker text.

Follow-up actions queued:
- Add function-level tests for capability gating and rate-card invoice math.
- Add a repository script to detect BOM and common mojibake patterns in staged files.
- Add preflight checklist for lint baseline, encoding checks, and validation tool prerequisites.

Working agreement for next overnight run:
1. Capture baseline validation and known debt list before first code edit.
2. Verify encoding (UTF-8 without BOM) before opening final PR/delivery summary.
3. Ship one workstream per commit with explicit acceptance checks.
4. End with a delta-only lint check on touched files and a blocked-tests section.
