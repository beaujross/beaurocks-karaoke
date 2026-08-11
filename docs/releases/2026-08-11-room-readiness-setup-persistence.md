# Room readiness and setup persistence production release

Date: 2026-08-11

Status: Deployed and verified

## Release identity

- Production source commit: `dfa383a623e20698875e9079255234ab50bd777b`
- Firebase project: `beaurocks-karaoke-v2`
- Targets: Firebase Functions and Firebase Hosting
- Hosting version: `c534399b68061693`
- Hosting release: `1786441929431000`
- Firebase Hosting URL: `https://beaurocks-karaoke-v2.web.app`
- Production Host bundle: `HostApp-CwwbECcV.js`

## Shipped behavior

- Reframed the post-launch flow around room readiness, with Room Set presented as a core step instead of optional fine print.
- Reworked Room Set choices into stable, graphical controls that do not resize when selections change.
- Added validated `performanceMode` persistence for karaoke, sing-along, and lip-sync room formats.
- Prevented browser-only `blob:` media URLs from entering shared room state and cleared active media before local object URLs are revoked.
- Added focused source, unit, and callable coverage for the new setup and persistence behavior.

## Verification

- Full unit suite: 386 files, 1,397 tests passed.
- Full Functions validation: lint and all callable families passed.
- `updateRoomAsHost` callable integration: all 42 checks passed, including `performanceMode` and Apple Music background-source persistence.
- Production build: passed.
- Client bundle budgets: passed; Host application 1,093.4 kB / 1,100.0 kB.
- Functions deploy: completed successfully before Hosting.
- Hosting deploy: completed successfully.
- Authenticated production core-night smoke: passed on rerun, including Host login, room creation, setup persistence, Host/Audience/Public TV synchronization, WYR completion, no intermission flash before performance, host and audience requests, Pop Trivia, and private room cleanup.

The first core-night attempt encountered a transient rapid prepare/start collision and left the WYR reveal visible. The deployed callable returned successfully and the unchanged full rerun passed the WYR-clear checkpoint and every subsequent check. No release code was changed between those two runs.

## Follow-up watch items

- The Host bundle remains close to its budget and should be reduced before adding another large Host-only feature.
- The build reports stale Browserslist data and large-chunk advisories; neither blocked this release.
- Continue monitoring rapid run-of-show prepare/start transitions because the first production smoke exposed a timing collision even though it did not reproduce.

## Worktree scope

The unrelated untracked file `docs/reviews/2026-08-10-discovery-host-growth-executive-plan.md` was not staged, committed, or included in this release.
