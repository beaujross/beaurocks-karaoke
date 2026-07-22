# Public Vibe Index Trust Boundary

Date: 2026-07-17  
Status: deployed and production-verified; rollout remains off  
Owner lens: CTO, Chief Product Officer, Chief Marketing Officer

## Bounded outcome

Only trusted server operations can create, change, or roll back a public BeauRocks Vibe Index projection. Public discovery and static SEO may sanitize a persisted projection, but they cannot derive a publishable score from raw entity fields.

This slice does not approve the current `vibe_v1` scoring model for public launch, enable scoring, grant an operator role, write production scores, or deploy Hosting.

## Trust contract

- `directory_profiles.publicVibeIndex`, `publicVibeIndexRollupVersion`, and `publicVibeIndexUpdatedAt` are server-managed Firestore fields.
- Public display uses `buildPublicVibeIndexProjection` only to sanitize a persisted projection.
- Trusted rollup code uses `derivePublicVibeIndexProjection`; an existing document score is never accepted as derivation input.
- Preview requires a directory moderator and remains read-only.
- Apply and rollback require a directory administrator plus a valid App Check token.
- Apply is blocked unless `PUBLIC_VIBE_INDEX_ROLL_MODE` is `canary` or `all`.
- Canary mode requires one exact `type:id` target that is present in the server-owned allowlist.
- An empty or invalid canary allowlist writes nothing.
- The legacy `PUBLIC_VIBE_INDEX_ROLLUP_ENABLED` switch is no longer an authorization path.

## Runtime controls

- `PUBLIC_VIBE_INDEX_ROLL_MODE=off|canary|all` defaults to `off`.
- `PUBLIC_VIBE_INDEX_CANARY_TARGETS` accepts at most 25 comma-separated targets such as `venue:venue_id`.
- `PUBLIC_VIBE_INDEX_ROLLUP_PAGE_SIZE` defaults to 250 and is capped at 500.
- `PUBLIC_VIBE_INDEX_MAX_TARGETS_PER_TYPE` defaults to 5,000 and is capped at 10,000.
- Apply fails before writes if any target collection exceeds the bounded, fully paginated scan.

## Audit and rollback

Every apply attempt that reaches mutation creates `public_vibe_index_jobs/{jobId}` with actor, rollout mode, target, versions, scan counts, status, and timestamps. Each changed target receives a server-only `changes` record containing the before and after projections plus prior rollup metadata.

`rollbackPublicVibeIndexJob` restores those before-images in deterministic batches. Rollback is admin-only, App Check protected, retry-safe, and records its actor and outcome on the original job. Firestore clients cannot write job or change records; moderators may read them for review.

## Operator workflow

Use `scripts/qa/public-vibe-index-rollout.mjs` with a dedicated directory administrator or approved operator identity. The low-privilege QA Host must not be promoted for this task.

1. Run `preview` first.
2. Configure the server in `canary` mode with one reviewed target.
3. Require `VIBE_ROLLOUT_ALLOW_WRITE=1`, an exact target, and a registered `QA_APP_CHECK_DEBUG_TOKEN` for apply.
4. Record the returned non-secret `jobId`.
5. Verify the target, discovery response, audit job, and static SEO output.
6. Exercise `rollback` using that job ID before considering broader rollout.

Operational security note: secret-bearing environment variables must be removed from emulator test processes because verbose Firebase CLI output can echo the child environment. Revoke and replace any debug token that appears in captured logs.

## Verification evidence

- Focused Vibe unit tests: 10 passed.
- Complete unit suite: 288 files / 1,021 tests passed.
- Directory callable emulator suite: 40 checks passed.
- Firestore and Storage rules suite: 110 checks passed.
- Targeted lint across every trust-boundary file: zero errors.
- Production build: passed with 134 prerendered routes and 131 social cards.
- Built static HTML contains zero Vibe Index mentions while production has no persisted qualifying score.
- Source-wide lint exceeded a 300-second command window without returning an error; complete Functions/scripts lint and targeted changed-source lint completed successfully.

## Production release evidence

Released on 2026-07-17 without a Hosting deployment or score canary.

- The QA App Check automation credential was replaced and verified without printing the secret. Both older QA-only debug-token registrations were revoked.
- Firestore ruleset `ffc82b56-9ba8-463f-9d9d-a62d586424e0` is live.
- `refreshPublicVibeIndexes`, `rollbackPublicVibeIndexJob`, `rollPublicVibeIndexes`, and `listDirectoryDiscover` deployed successfully; Firebase reported four deployed and zero errored.
- All four Functions reported `ACTIVE`. `PUBLIC_VIBE_INDEX_ROLL_MODE` is absent, which exercises the tested fail-closed `off` default.
- A forced scheduler verification run logged `rollout_disabled`, zero canary targets, and no rollup work.
- Anonymous discovery returned all 114 listings, with 0 published scores, 114 `not_enough_data` projections, 0 protected raw-metric leaks, and 0 invalid published projections.
- An unauthenticated apply probe was rejected with HTTP 401 before mutation.

The next product slice is `vibe_v2` evidence integrity: unique authenticated evidence, a truthful time window, entity-specific attribution, and removal of self-declared or paid-status boosts from the numerical score. Its initial pure evidence contract is implemented and tested, but it is not wired to production reads, writes, rollups, or public output.
