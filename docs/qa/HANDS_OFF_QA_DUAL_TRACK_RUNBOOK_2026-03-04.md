# Hands-Off QA Dual-Track Runbook (2026-03-04)

Purpose:
- Run deterministic golden-path QA as a release gate.
- Run exploratory Agent-mode QA to discover non-obvious breakage.
- Keep live production probes separate from deterministic release gating.

Current production assumption:
- Remote hands-off QA requires a registered `QA_APP_CHECK_DEBUG_TOKEN` because production callables are App Check protected.

## Track A: Scripted Golden Path (Gate)

Canonical release-gate run (no plaintext password in shell history):

```powershell
npm run qa:release:core-night
```

The secure runner:
- prompts for email
- prompts for password with hidden input
- injects credentials only into the child process
- blocks known super-admin emails by default
- expects a dedicated low-privilege QA host account, not a super admin

Required for remote production runs:

```powershell
setx QA_APP_CHECK_DEBUG_TOKEN "<registered-debug-token>"
setx QA_ALLOWED_HOST_EMAILS "qa-host@yourdomain.com"
```

Open a fresh shell after `setx`, then run the secure smoke.

Account policy:
- Keep one dedicated non-superadmin QA host account for production smoke.
- Store the email and password in your real secret store or password manager, not in repo markdown.
- Keep `QA_ALLOWED_HOST_EMAILS` aligned with that exact account email so the secure runner rejects drift back to super-admin testing.

Implementation note:
- `npm run qa:release:core-night` currently resolves to the secure host-room hands-off runner.

Optional policy hardening:
- set `QA_ALLOWED_HOST_EMAILS` to enforce dedicated QA-only account(s)
- set `QA_BLOCKED_HOST_EMAILS` for additional denylist

Example (persist allowlist only, no password):

```powershell
setx QA_ALLOWED_HOST_EMAILS "qa-host@yourdomain.com"
```

Legacy env-based run (less secure, avoid for shared terminals):

```powershell
$env:QA_HOST_EMAIL="host-account-email"
$env:QA_HOST_PASSWORD="host-account-password"
```

Run:

```powershell
npm run qa:golden:host-room-hands-off
```

Use the legacy command only when you explicitly want the direct runner surface. For release gating, prefer `npm run qa:release:core-night`.

## Marketing QA split

Use deterministic build-backed marketing QA for release confidence:

```powershell
npm run qa:release:marketing
```

Use live production marketing QA as an ops monitor:

```powershell
npm run ops:qa:marketing:prod
```

Operational rule:
- `qa:release:*` commands should stay deterministic and artifact-backed.
- `ops:*:prod` commands are live-environment probes and may fail because of production health, throttling, or data drift.

### QA Host Account Recovery

If the team forgets which QA host account is current:

1. Export Firebase Auth users for `beaurocks-karaoke-v2` and look for `qa.host.*` or other dedicated smoke accounts.

```powershell
firebase auth:export tmp/auth-users.json --format json
```

2. If the account email is found but the password is unknown, do not fall back to super-admin for routine smoke.
3. Create or reset a dedicated low-privilege QA host account instead.
4. Grant host access by writing the normal approval records:
   - `host_access_approvals/{uid}` with `hostApprovalEnabled=true`
   - `marketing_private_access/{uid}` with `privateHostAccessEnabled=true`
   - optional `users/{uid}.hostApproval.hostApprovalEnabled=true` for operator visibility
5. Update the secret store with the new email/password and refresh `QA_ALLOWED_HOST_EMAILS`.
6. Re-run `npm run qa:release:core-night`.

Operational rule:
- Do not commit the QA host password, temporary recovery password, or raw secret output into the repo.

What it validates:
1. Root-domain host login
2. Host room creation
3. Automations on
4. TV load + QR + room code
5. Audience join
6. Host request and sync to TV
7. Host request transitions into active performance
8. Audience surface shows the active performance state
9. Pop Trivia renders on audience during a performing song
10. Audience can lock one Pop Trivia answer
11. TV shows the Pop Trivia card and reflects locked answers
12. Audience request and sync to host + TV

If this fails: treat as release blocker.

Failure triage:
- `QA_APP_CHECK_DEBUG_TOKEN is required`: set or re-register the production App Check debug token.
- `QA host email ... blocked by super-admin policy`: use the dedicated QA host account or explicitly opt into break-glass mode.
- Host login succeeds but host-access CTA is wrong: check App Check warm-up and host approval status, not just auth.

## Track B: Agent-Mode Exploratory QA

Generate a ready-to-paste mission brief:

```powershell
npm run qa:agent:brief
```

Output file:
- `tmp/qa-agent-mode-brief.md`

Use it:
1. Open ChatGPT Agent mode.
2. Paste `tmp/qa-agent-mode-brief.md`.
3. Let agent browse and report findings in the required table format.

## Combined Workflow

Run scripted gate, then generate exploratory brief:

```powershell
npm run qa:dual:hands-off
```

## Severity Guidance

High:
- Broken login/create room
- Host/audience/TV queue desync
- Request accepted but disappears on another surface
- Blank/crash/deadlock in golden flow
- Pop Trivia missing on audience/TV once a song reaches `performing`

Medium:
- Recoverable UI state errors, broken toggles, stale state until refresh
- Pop Trivia answer lock works but TV tally lags or never updates

Low:
- Copy/layout inconsistencies without functional impact
