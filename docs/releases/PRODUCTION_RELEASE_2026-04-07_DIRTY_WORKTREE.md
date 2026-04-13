# Production Release 2026-04-07

Dirty-worktree exception release from local workspace.

## Project
- Firebase project: `beaurocks-karaoke-v2`
- Live URL: `https://beaurocks.app`

## Deployed Targets
- `hosting`
- `functions`
- `firestore:rules`
- `storage`

## Verification
- `npm run build`
- `npm run test:unit`
- `npx firebase-tools emulators:exec --project demo-bross --only firestore,storage "node tests/security/rules.test.cjs"`
- `npx firebase-tools emulators:exec --project demo-bross --only firestore "node tests/integration/updateRoomAsHostCallable.test.cjs"`
- `npm run qa:release:core-night`

## Release Notes
- Host/audience/TV production smoke was updated to match the current host launch, playable quick-add flow, compact trivia UI, and host review queue visibility.
- Audience backing policy and host queue review contract changes were included in this release.
- Host review actions remain client-driven, but they now run through a shared command layer instead of inline `HostApp` mutations.

## Known Follow-Up
- Map this deploy to a committed SHA as soon as the current worktree is packaged cleanly.
- Remove or archive temporary QA artifacts before the release branch is finalized.
