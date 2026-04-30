# Host Room Runtime Regression Note

Date: 2026-04-29
Audience: CTO, Product, Engineering
Status: Fixed locally, regression test added, ready for human review

## Executive Summary

After the host startup/auth fix, the host room could still crash after login when the host room screen mounted. This was a client runtime regression, not a hosting outage:

- console error: `Uncaught ReferenceError` in the host bundle
- affected surface: host room screen, specifically the inbox workspace branch inside `HostQueueTab`

The code fix is small, but the durable lesson is larger: host tab-specific branches inside giant runtime modules need real mount coverage, not only source-shape tests.

## Customer Impact

- Marketing and app origins continued to return `200`.
- Host login could succeed, then fail when opening the host room workspace.
- From an operator perspective, this is event-blocking even though the site itself is up.

## Root Cause

`HostQueueTab` still rendered `HostInboxPanel` with `handleChatViewMode={handleChatViewMode}`, but the prop had been dropped from the `HostQueueTab` function signature during refactor cleanup.

That meant:

- the default queue workspace could still render
- the inbox branch crashed when it actually mounted
- existing source assertions and queue-default runtime tests did not cover the failing branch

## Fix

- Restored `handleChatViewMode = () => {}` in the `HostQueueTab` prop signature.
- Added a runtime regression test in `tests/unit/hostQueueTabRuntime.test.mjs` that forces the inbox workspace to mount.

## Why Existing Tests Missed It

- Existing host runtime tests rendered the queue shell successfully, but did not force the `Inbox` tab branch to mount.
- Existing source tests verified structure and imports, but not branch execution.

This matches the broader confidence gap already tracked in `docs/TECH_RISKS_PRIORITIES.md`: source-only checks on large UI modules can preserve strings while missing real runtime failures.

## Blast Radius To Consider

1. Queue workspace branch switching
- `Queue`, `Add To Queue`, `Inbox`, and `Run Of Show` are branch-selected inside the same large module.
- A prop omission, undefined derived value, or refactor typo can break one branch while leaving the default render intact.

2. Compact/mobile host tab paths
- The compact host rail has its own active-tab branch logic.
- A fix that stabilizes desktop inbox does not automatically prove compact inbox, add, or queue paths are safe.

3. Lazy-loaded host surfaces
- `HostQueueTab` is lazy-loaded from `HostApp`.
- Runtime faults inside lazily mounted host workspaces can stay invisible until a specific operator action reaches that branch.

4. Top-level render ordering in giant host modules
- Production stack traces can resemble temporal-dead-zone or initialization-order faults.
- Similar issues can also come from later-declared derived values, hook ordering mistakes, or branch-only references inside `HostApp.jsx` and `HostQueueTab.jsx`.

## Recommended Testing Follow-Up

1. Keep the new inbox runtime mount test.
2. Add one compact-viewport host workspace smoke that activates `inbox`.
3. Add one branch-switch smoke that touches `queue`, `add`, `inbox`, and `show` in the same harness.
4. Treat host workspace switching as release-gating for live-event rooms.

## CTO / Product Review Packet

- CTO focus: this was a branch-execution regression inside a large host module; the fix is correct, but the real corrective action is better runtime branch coverage.
- Product focus: host room launch reliability is part of the event-critical operator contract even if the rest of the site is healthy.
- Stability recommendation: approve the code fix, and track the additional host workspace smoke coverage as immediate follow-up rather than optional cleanup.
