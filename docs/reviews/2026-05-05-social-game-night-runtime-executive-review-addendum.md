# Social Game Night Runtime Executive Review Addendum

Date: May 5, 2026

Audience: CEO, CPO, CTO, CMO

Reviewed artifact:

- [2026-05-05-social-game-night-runtime-phase-1-implementation-spec.md](<C:\Users\beauj\Desktop\beaurocks-karaoke\docs\reviews\2026-05-05-social-game-night-runtime-phase-1-implementation-spec.md:1>)

## Executive Readout

The phase-1 implementation spec is directionally approved, with constraints.

All three executive lenses agree on the main decision:

- proceed with the experimental runtime shell
- keep it additive, not replacement-driven
- preserve mode extensibility
- keep the visual ambition high
- do not let the host shell become another overloaded operations page

The approval is not unconditional.
It depends on maintaining clear product boundaries and a disciplined first slice.

## Chief Product Officer Review

### CPO Verdict

Approved with product guardrails.

### What The CPO Likes

- The plan now correctly distinguishes the host eye-line from deeper capabilities.
- The design no longer assumes every important function has to live in the visual center.
- The `hostLed`, `collaborative`, `audienceLed`, and `curatedShowcase` framing is the right product architecture.
- The performer ring remains a strong signature interaction without being treated as the whole product.
- The host shell is properly being framed as a runtime instrument, not a new admin dashboard.

### CPO Concerns

- The experimental shell could still drift into “pretty host shell” territory if the runtime model is not strict enough about `current`, `next`, and `attention`.
- `AudienceLed` support must remain real, not theoretical. If the phase-1 contracts hard-code host confirmation everywhere, we will have to unwind them later.
- The candidate pool can become muddy if it mixes too many object types without a clean ranking or grouping rule.

### CPO Required Adjustments

- Phase 1 should explicitly define the top three host questions the shell must answer at a glance:
  - who is live now
  - who or what is next
  - what needs intervention before the room can advance cleanly
- The runtime model should distinguish between:
  - `live object`
  - `next committed object`
  - `open candidates`
  - `attention / blockers`
- Audience-led and vote-driven decisions should remain transition-window concepts by default, not live-song interruptions.

### CPO Approval Condition

Approved if the first implementation keeps the host’s main eye-line brutally focused and avoids collapsing the candidate pool into a second queue UI.

## Chief Technology Officer Review

### CTO Verdict

Approved with architectural constraints.

### What The CTO Likes

- The spec correctly uses `HostQueueTab` as the integration seam.
- The plan avoids creating a second queue or second run-of-show system.
- `hostUiPrefs` is the right first persistence boundary for shell behavior.
- The proposed new modules are small and separable.
- The mode-extensibility requirement is structurally sound as long as it stays in the derived model rather than becoming branching business logic too early.

### CTO Concerns

- `HostQueueTab.jsx` is already large, so any new branch must be carefully isolated or it will worsen maintenance.
- If the runtime model starts pulling too much implicit logic into one helper without clear contracts, debugging will become harder instead of easier.
- A visually ambitious shell can accidentally duplicate state derivation already happening in queue, stage, and run-of-show utilities.
- There is still some risk that “candidate pool” becomes an ad hoc merger of queue, planner, and run-of-show objects without a stable type model.

### CTO Required Adjustments

- Keep the new model layer read-only and deterministic.
- Make `hostRuntimeShellModel.js` a pure derivation module with explicit inputs and outputs.
- Normalize object types early. At minimum, the shell model should distinguish:
  - `performance`
  - `scene`
  - `moment`
  - `attention`
- Avoid pushing orchestration logic into the experimental shell components.
- Add smoke coverage for classic mode and experiment mode so this does not regress the existing host runtime.

### CTO Approval Condition

Approved if phase 1 remains a render-layer experiment over existing behavior and the new derived model stays pure, typed-by-convention, and testable.

## Chief Marketing Officer Review

### CMO Verdict

Approved from a brand and design perspective, with one warning.

### What The CMO Likes

- `Social Game Night` is the first direction that feels ownable for this brand.
- The system now feels warm, social, and room-centric without becoming unserious.
- The performer ring remains a visually distinctive hero pattern.
- The split between host runtime, Public TV, and Audience App creates a marketable story instead of three unrelated interfaces.
- The mode architecture supports messaging across venue, party, and showcase use cases without changing the product’s identity every time.

### CMO Concerns

- The product can still lose its brand advantage if engineering ships a visually reduced first pass that feels like a wireframe with some gradients.
- The candidate-pool and rotation modules must feel intentionally designed, not like leftover admin trays.
- If the host shell gets too operational and loses the emotional energy of karaoke, the concept will flatten back into software.

### CMO Required Adjustments

- Preserve the `Social Game Night` tone in implementation:
  - warmth
  - playfulness
  - theatrical room energy
  - premium finish
- Treat the performer ring, applause state, and next-up transition as signature brand moments.
- Make sure Public TV and Audience App remain part of the design system story, even if host implementation lands first.
- Do not allow the first implementation to default back to generic enterprise panel styling.

### CMO Approval Condition

Approved if the experiment is implemented with enough fidelity that it still feels like a branded product direction rather than an internal tooling prototype.

## Consolidated Executive Decision

The plan is approved to move forward with three conditions:

1. Keep the host eye-line narrow and high-signal.
2. Keep the architecture additive and pure.
3. Keep the visual language recognizably `Social Game Night`.

## Required Additions To The Implementation Spec

Before coding starts in earnest, the team should treat these as binding:

- define the three primary host questions in the runtime model
- normalize candidate object types in the shell model
- keep audience-led support alive in contracts, even if phase 1 defaults to `hostLed`
- hold the design bar high enough that the first visible experiment still carries the brand direction

## Final Approval Summary

### CPO

Approved with guardrails.

### CTO

Approved with architectural constraints.

### CMO

Approved with fidelity and brand constraints.

## Recommendation

Proceed to implementation.

The next step should be to update the phase-1 implementation spec with these executive conditions folded in, then begin code with:

1. `hostUiPrefs.js`
2. `hostRuntimeShellModel.js`
3. `HostRuntimeShellExperimental.jsx`
4. `HostQueueTab.jsx` branch integration
