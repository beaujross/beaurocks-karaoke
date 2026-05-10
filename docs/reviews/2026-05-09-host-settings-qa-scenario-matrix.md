# Host Settings QA Scenario Matrix

Date: 2026-05-09
Status: First operational QA packet for the host-settings migration

## Purpose

This matrix turns the host-settings migration into verifiable operator scenarios instead of only code-level correctness.

It is designed to support:

- `CTO`: regression and rollout confidence
- `CPO`: host-job completion checks
- `Chief Marketing Officer`: branded/workspace-template validation
- `Support + QA`: repeatable troubleshooting and release gating

## Core release principle

Every host-settings slice should be checked at three levels:

1. `contract`
2. `surface behavior`
3. `operator outcome`

## Core scenarios

| Scenario | Room format | Actor | Surface | Expected result | Validation path |
| --- | --- | --- | --- | --- | --- |
| apply crowd mode in setup | standard karaoke | host | `Tonight > Crowd mode` | room draft updates as one bundle and can be undone | unit + host manual QA |
| apply operating style in setup | standard karaoke | host | `Tonight > Operating style` | queue/ready-check/auto-play update together and can be undone | unit + host manual QA |
| apply crowd mode live | standard karaoke | host | `Live > Overlays + Guides` | room runtime writes immediately and can be undone live | manual QA |
| apply operating style live | standard karaoke | host | `Live > Room Settings` | runtime write succeeds with no stale local state | manual QA |
| save my default | standard karaoke | host | `Tonight` bundle card | save succeeds to host defaults and can be reused | callable integration + manual QA |
| save workspace template | standard karaoke | owner/admin | `Tonight` bundle card | save succeeds to workspace defaults and can be reused | callable integration + manual QA |
| workspace-template save denied | standard karaoke | workspace member | `Tonight` bundle card | action is blocked with correct message | callable integration |
| use my default | standard karaoke | host | `Tonight` bundle card | saved bundle reapplies correctly | manual QA |
| use workspace template | standard karaoke | owner/admin/member viewer of workspace setup | `Tonight` bundle card | saved workspace bundle reapplies correctly | manual QA |
| self-serve mode save restriction | self-serve | host | `Tonight` bundle card | host-default save is hidden or blocked per parity rules | unit + manual QA |
| run-of-show mode save restriction | run-of-show showcase | host | `Tonight` bundle card | save targets obey mode parity | unit + manual QA |
| sponsor/festival room prep | sponsor festival | host/admin | `Tonight` plus workspace assets | bundle setup does not conflict with brand/sponsor prep | manual QA |

## Existing script alignment

Use existing commands where possible:

- `npm run qa:release:core-night`
- `npm run qa:host:run-of-show`
- `npm run qa:host:run-of-show:app`
- `npm run qa:host:lobby-cohost`
- `npm run qa:audience:app`

Use emulator/callable checks for server-enforced permissions:

- `tests/integration/hostSettingsDefaultsCallable.test.cjs`

## Minimum pre-broadening checklist

### Contract

- relevant unit tests pass
- callable integration tests pass
- save target permissions match matrix

### Surface behavior

- setup bundle cards show expected actions
- undo works in setup and live for migrated bundles
- source reuse actions do not produce stale summaries

### Operator outcome

- a host can get to a show-ready room without opening advanced controls
- a workspace owner can save and reuse a template without support help
- a co-host or member cannot widen scope incorrectly

## Failure severity

| Severity | Meaning |
| --- | --- |
| `P0` | permission, rollback, or persistence defect |
| `P1` | host cannot complete normal setup or live correction |
| `P2` | copy, summary, or visibility issue with workaround |

## Final rule

No slice should broaden rollout if the QA evidence only proves storage correctness but not host-job completion.
