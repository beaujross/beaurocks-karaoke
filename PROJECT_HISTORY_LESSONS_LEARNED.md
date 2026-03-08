# Project History and Lessons Learned

Last updated: 2026-03-08

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
