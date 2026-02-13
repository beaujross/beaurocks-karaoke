# P0 Verification Report (2026-02-12)

Scope: execute P0 backlog items in order and capture evidence.

## 1) Firebase production safety (storage rules + App Check + auth/upload smoke)

### Deploy actions (production)

```powershell
npx firebase-tools deploy --only storage --project beaurocks-karaoke-v2 --non-interactive
npx firebase-tools deploy --only functions --project beaurocks-karaoke-v2 --non-interactive
```

Result: both deploys succeeded.

### App Check enforcement

- Updated `functions/.env.beaurocks-karaoke-v2`:
  - `APP_CHECK_MODE=enforce`
- Verified with callable smoke:

```powershell
node scripts/qa/app-check-gate-smoke.mjs
```

Observed result:
- status `400`
- error `FAILED_PRECONDITION`
- message `App Check token required.`

### Rules/auth/upload smoke

```powershell
npm run test:rules
```

Observed result:
- `All 18 rules checks passed`
- Includes storage checks:
  - host can upload allowed audio/video
  - host can upload branding image
  - non-host denied upload access

Additional production auth/upload probe (REST-based):
- Anonymous auth: pass
- Firestore room write as host: pass
- Storage upload without App Check token: denied (`403`) as expected under enforcement.

## 2) Host create/join reliability playtest (guarded join flow)

```powershell
node scripts/qa/host-join-playtest.mjs
```

Observed scenarios:
- create room as authed host: pass (`200`)
- join existing room: pass (`200`)
- join missing room: pass (`404`)
- invalid token (re-auth needed): pass (`401`)
- join after re-auth token restored: pass (`200`)
- poor network transport failure simulation: pass (`network_error`)

## 3) VIP SMS auth reliability (reCAPTCHA + phone verification readiness + documentation)

```powershell
node scripts/qa/vip-sms-readiness.mjs
```

Observed checks:
- Runbook present and includes both:
  - test number flow
  - real number flow
- Runbook includes host smoke + App Check dashboard validation steps.
- App code contains:
  - dedicated reCAPTCHA containers for both VIP entry points
  - mapped auth error messaging (`too-many-requests`, `invalid-phone-number`)
  - `/users/{uid}` writes for phone/vip fields
- `.env.local` contains `VITE_RECAPTCHA_V3_SITE_KEY`.

Note:
- Automated CLI execution cannot complete an end-to-end real SMS verification handshake (browser reCAPTCHA + live phone interaction). The runbook remains the operational path for that final live validation step.

## 4) Firestore user writes production smoke (`/users/{uid}`)

```powershell
node scripts/qa/users-profile-smoke.mjs
```

Observed checks:
- own user doc create: pass (`200`)
- own user doc profile edit update: pass (`200`)
- own user doc readback: pass (`200`)
- cross-user write denied: pass (`403`)

## Added QA scripts

- `scripts/qa/app-check-gate-smoke.mjs`
- `scripts/qa/host-join-playtest.mjs`
- `scripts/qa/vip-sms-readiness.mjs`
- `scripts/qa/users-profile-smoke.mjs`

## 5) Automated rerun evidence (2026-02-12)

```powershell
npm run qa:p0
```

Observed result:
- `qa:p0:firebase-safety`: pass
  - `npm run test:rules` => `All 18 rules checks passed`
  - `qa:p0:appcheck` => callable denied without App Check (`FAILED_PRECONDITION`)
- `qa:p0:host-join`: pass (all guarded join scenarios passed)
- `qa:p0:vip-readiness`: pass (all readiness checks passed)
- `qa:p0:users`: pass (own create/update/read pass, cross-user write denied)

Conclusion:
- All automatable P0 validation checks are green.
- Remaining blocker is the manual live SMS verification handshake in browser (reCAPTCHA + OTP interaction).

## 6) Final manual sign-off checklist (VIP SMS live)

Run these two manual checks in production web app and append outcome:

1. Test number flow (Firebase test number)
- reCAPTCHA challenge renders and completes
- phone verification succeeds
- `/users/{uid}` contains expected phone/VIP fields

2. Real number flow (non-test number)
- reCAPTCHA challenge renders and completes
- SMS OTP received and accepted
- onboarding/profile flow completes without auth errors
- `/users/{uid}` write confirmed
