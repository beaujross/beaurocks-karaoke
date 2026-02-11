# Project History and Lessons Learned

Last updated: 2026-02-11

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
