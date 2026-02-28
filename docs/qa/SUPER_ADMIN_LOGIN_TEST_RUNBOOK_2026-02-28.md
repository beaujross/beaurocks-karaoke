# Super Admin Login + Test Runbook (2026-02-28)

Scope:
- Primary super admin account: `hello@beauross.com`
- Surfaces: marketing auth, host panel, moderation access, catalog/AI callables
- Environments: production first, local optional

## 1) Super Admin Gates (Must Pass)

Backend super admin is granted when either condition is true:
- UID is listed in `SUPER_ADMIN_UIDS`
- OR authenticated Firebase user email is:
  - in `SUPER_ADMIN_EMAILS` (default includes `hello@beauross.com`)
  - and `emailVerified === true`

Source in code:
- `functions/index.js`:
  - `SUPER_ADMIN_EMAIL_DEFAULT`
  - `SUPER_ADMIN_EMAILS`
  - `SUPER_ADMIN_UIDS`
  - `isSuperAdminUid(uid)`

Important:
- `isSuperAdminUid` result is cached for up to 10 minutes in-memory.
- If you fix email verification or env vars, allow cache to expire (or redeploy functions) before retesting.

## 2) One-Time Setup (Firebase Console)

1. Firebase Auth -> Users:
   - confirm `hello@beauross.com` exists
   - confirm email is verified

2. Functions runtime env:
   - ensure `SUPER_ADMIN_EMAILS` includes `hello@beauross.com` (or leave default behavior)
   - optional break-glass: add your UID to `SUPER_ADMIN_UIDS`

3. Firestore UI role doc (recommended for moderator UI visibility):
   - create/update `directory_roles/{yourUid}` with:

```json
{
  "roles": ["directory_admin"]
}
```

Why this matters:
- Backend treats super admin as moderator/admin automatically.
- Frontend moderator nav currently reads only `directory_roles/{uid}` to decide `session.isModerator`.
- Without this doc, moderation pages can be hidden even if backend would authorize you.

## 3) Production Login Flow

1. Open `https://beaurocks.app/host-access`
2. Sign in with `hello@beauross.com`
3. Confirm signed-in state appears in auth panel
4. Open host surface:
   - `https://host.beaurocks.app/?mode=host&hostUiVersion=v2`
5. Open marketing moderation route:
   - `https://beaurocks.app/admin/moderation`

## 4) Super Admin Smoke Test Checklist

Use this pass/fail checklist after login:

1. Host room creation
   - Action: Quick Start New Room in host panel
   - Pass: room creates successfully, no permission error

2. Catalog write permission
   - Action: queue a song/track path that triggers `ensureSong`/`ensureTrack`
   - Pass: no 403 from `ensureSong` or `ensureTrack`

3. AI generation permission
   - Action: trigger lyrics/content generation in host panel
   - Pass: no 403 from `geminiGenerate`

4. Moderation UI access
   - Action: open `/admin/moderation`
   - Pass: moderation interface loads (not access denied/hidden)

5. Private host access bypass (if private-host mode is enabled)
   - Action: attempt host onboarding action requiring private access
   - Pass: super admin account is not blocked by private-access server gate

## 5) Optional Automated QA

Run admin workspace smoke against production:

```powershell
npm run qa:admin:prod
```

Optional override:

```powershell
$env:QA_BASE_URL="https://beaurocks.app"
npm run qa:admin:prod
```

## 6) Troubleshooting

If you see `403` for `ensureSong`, `ensureTrack`, or `geminiGenerate`:
- verify you are signed in (correct account, not anonymous)
- verify `hello@beauross.com` is email-verified in Firebase Auth
- verify runtime env includes your super admin email/uid
- wait up to 10 minutes for super-admin cache to refresh (or redeploy functions)

If `/admin/moderation` is missing while signed in:
- add `directory_roles/{uid}` with `roles: ["directory_admin"]`
- hard refresh browser after the role doc is present

If host room creation fails with permission/auth errors:
- sign out/in again on host surface
- retest after confirming same UID/email in Firebase Auth
