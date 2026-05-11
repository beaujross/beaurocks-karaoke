# Host Settings Follow-Up Status

Date: 2026-05-10
Status: follow-up snapshot after the first governance and runtime cleanup tranche

## Purpose

This note records where the host-settings / admin-toggle audit work currently stands after the first round of implementation and live-surface cleanup.

Use it as the bridge between:

- `docs/reviews/2026-05-09-host-settings-ownership-model.md`
- `docs/reviews/2026-05-09-host-settings-gap-register.md`
- `docs/reviews/2026-05-09-host-settings-remediation-plan.md`

## What moved since the main audit

### Runtime ownership got a little cleaner

- `Audience + Host Layout` was consolidated into one admin cluster instead of splitting host shell layout above the main layout card.
- queue attention moved onto the `Queue` tab in top chrome instead of relying on a separate moderation inbox chip.
- the host `Room` dropdown now owns the live `Stage Start` decision (`autoPlayMedia`) alongside request mode, queue cap, queue rotation, ready check duration, host approval, first-time boost, and post-song track check.
- `Auto Stage Playback` no longer lives in the generic `Top Chrome > Automation` toggle grid.

That does not reduce raw duplication count for `autoPlayMedia`, but it does correct its control cluster.

### Governance plumbing from the audit exists now

The first host-settings governance packet is no longer only design intent. The repo now has code and docs for:

- canonical setting catalog
- permissions matrix
- persistence / save provenance model
- undo and change history
- monetization and downgrade enforcement
- audit-trail write/read model
- accessibility acceptance criteria
- asset lifecycle and rollout telemetry contracts

Key code anchors:

- `src/lib/hostSettingsCatalog.js`
- `src/lib/hostSettingsAuditTrail.js`
- `src/lib/hostSettingsAssetLifecycle.js`
- `src/lib/hostSettingsAccessibility.js`
- `functions/index.js`

## Where the audit body of work actually paused

The project is past the pure-audit phase, but it has not finished the migration.

The work appears paused at this point:

1. The ownership model and bundle catalog exist.
2. Some high-value live surfaces have been consolidated.
3. The backend governance hooks exist for saves and audit entries.
4. The broader duplicate-toggle cleanup is still incomplete.
5. The formal accessibility and operator validation pass is still not closed as an executed audit artifact.

## Highest-signal duplicate areas still left

These remain the clearest follow-up targets from the original audit:

1. `popTriviaEnabled`
Current overlap: Night Setup modal, Admin `Night Setup`, Admin `Automation`, Top Chrome `Automation`, Top Chrome `Overlays`.

2. `chatShowOnTv`
Current overlap: Night Setup modal, Admin `Chat`, Admin `Screens + Playback`, Top Chrome `Overlays`.

3. `showScoring`
Current overlap: Night Setup modal, Admin `Night Setup`, Admin `Screens + Playback`, Top Chrome `Overlays`.

4. `marqueeEnabled`
Current overlap: Night Setup modal, Admin `Screens + Playback`, Top Chrome `Overlays`.

5. `readyCheckDurationSec`
Current overlap: Admin `Night Setup`, Admin `Automation`, Top Chrome `Room`.
This one is less severe now because it is correctly clustered with room flow, but it is still duplicated.

## Recommended next slice

If this body of work resumes, the next slice should be:

1. finish one more bundle-first consolidation around `crowd_mode`
Move crowd-TV and overlay toggles toward one practical live owner and one setup owner.

2. expose audit history in an actual host-facing admin surface
The write/read path exists, but the operator-facing review surface is still not the normal workflow.

3. execute the formal accessibility audit against the defined criteria
That should produce a dated pass/fail artifact, not just acceptance-criteria prose.

4. keep replacing raw toggle scatter with catalog-driven clusters
The catalog is only useful if new work keeps following it.

## Short version

The audit did not stall because there was no model.
It stalled after the model existed, after the first governance packet landed, and before the remaining duplicate live toggles were fully collapsed into their intended owner surfaces.
