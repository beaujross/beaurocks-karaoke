# App Check Cutover Runbook

Last updated: 2026-03-02

## Purpose

Safely transition production from App Check monitor mode to enforce mode with rollback-ready checkpoints.

This runbook is designed for project `beaurocks-karaoke-v2` and current repo scripts.

## Scope

- Backend enforcement toggle: `APP_CHECK_MODE` (Cloud Functions runtime env).
- Client tokening toggle: `VITE_APP_CHECK_ENABLED` (frontend build-time env).
- Optional strict client behavior: `VITE_REQUIRE_APP_CHECK`.

## Safety Principles

1. Do not flip backend enforcement and client tokening at the same time.
2. Enable client tokening first, observe, then enforce backend.
3. Keep a one-command rollback ready (`APP_CHECK_MODE=log` + functions deploy).

## Preflight

1. Confirm current backend mode:
   - File: `functions/.env.beaurocks-karaoke-v2`
   - Expected before cutover: `APP_CHECK_MODE=log`
2. Confirm production reCAPTCHA/App Check site key is valid for prod domains.
3. Ensure latest main is deployed and quality checks are green:
   - `npm test`
   - `npm run build`
4. Baseline monitor check (no App Check token):
   - `npm run qa:p0:appcheck`
   - Expected in monitor/log mode: status may be `200` and script should pass.

## Phase 1: Client Tokening On (No Backend Enforce Yet)

Set frontend env for production build:

- `VITE_APP_CHECK_ENABLED=true`
- `VITE_REQUIRE_APP_CHECK=false`
- `VITE_RECAPTCHA_V3_SITE_KEY=<prod-key>`

Deploy hosting only:

```powershell
npm run deploy:hosting
```

Checkpoints:

1. App loads normally on host/mobile/marketing flows.
2. Core callables still work.
3. App Check missing-token logs begin to trend down.

Useful monitoring:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ops/watch-launch-signals.ps1
```

Watch specifically for `[app-check]` missing-token signals/trend.

Suggested observation window: 24 hours.

## Phase 2: Backend Enforce

Update backend env in `functions/.env.beaurocks-karaoke-v2`:

- `APP_CHECK_MODE=enforce`

Deploy functions:

```powershell
npx firebase-tools deploy --only functions --project beaurocks-karaoke-v2 --non-interactive
```

Immediate verification:

1. No-token callable should now be rejected:

```powershell
$env:QA_APP_CHECK_EXPECT_REJECT='true'
node scripts/qa/app-check-gate-smoke.mjs
```

Expected:
- non-2xx status
- `FAILED_PRECONDITION`
- message similar to `App Check token required.`

2. Run high-signal smoke checks:

```powershell
npm run qa:p0:host-join
npm run qa:p0:users
```

3. Optional full P0 suite:

```powershell
npm run qa:p0
```

## Phase 3: Optional Strict Client Requirement

Only do this after Phase 2 is stable.

Set frontend env:

- `VITE_REQUIRE_APP_CHECK=true`

Then redeploy hosting:

```powershell
npm run deploy:hosting
```

This is stricter client behavior and can surface local/browser edge cases.

## Rollback

If error rates spike or user flows break:

1. Set backend mode back to monitor:
   - `APP_CHECK_MODE=log` in `functions/.env.beaurocks-karaoke-v2`
2. Deploy functions:

```powershell
npx firebase-tools deploy --only functions --project beaurocks-karaoke-v2 --non-interactive
```

3. Re-run smoke:

```powershell
node scripts/qa/app-check-gate-smoke.mjs
```

If needed, also set `VITE_APP_CHECK_ENABLED=false` and redeploy hosting.

## Release Checklist Snippet

1. `APP_CHECK_MODE` verified before deploy.
2. `VITE_APP_CHECK_ENABLED` and `VITE_RECAPTCHA_V3_SITE_KEY` verified in build env.
3. `app-check-gate-smoke` run before and after cutover.
4. `host-join` and `users-profile` smoke passed post-cutover.
5. Rollback command validated and ready.
