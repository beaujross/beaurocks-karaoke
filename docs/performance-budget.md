# Frontend Performance Budget

This document defines practical bundle-size guardrails for host, TV, and audience apps and a repeatable review workflow.

## Current Chunk Snapshot (from overnight run)

- `HostApp` chunk: ~633 KB (minified)
- `SingerApp` chunk: ~263 KB (minified)
- `PublicTV` chunk: ~182 KB (minified)
- `vendor-firebase` chunk: ~548 KB (minified)

## Budget Targets

1. `HostApp` initial chunk: target <= 500 KB
2. `SingerApp` initial chunk: target <= 300 KB
3. `PublicTV` initial chunk: target <= 250 KB
4. `vendor-firebase` shared chunk: target <= 500 KB

## Build Review Checklist

1. Run `npm run build`.
2. Capture chunk-size output in PR notes.
3. If any chunk exceeds target:
   - first split by route/surface (`Host` admin-only sections, game overlays, setup wizards),
   - then split optional subsystems (QA tools, heavy visualizer controls),
   - then evaluate dependency-level impact.
4. If change exceeds target without mitigation, mark as explicit temporary exception.

## Priority Split Candidates

1. `HostApp`: lazy-load admin/QA surfaces and setup wizard modules.
2. `SingerApp`: defer niche mode modules (doodle/selfie/trivia overlays) until needed.
3. `PublicTV`: isolate game preview/render branches by mode.

## Ownership

- Any PR that modifies `HostApp.jsx`, `SingerApp.jsx`, or `PublicTV.jsx` should include build output evidence.
- Use this file as baseline until a dedicated size-check script is added.
