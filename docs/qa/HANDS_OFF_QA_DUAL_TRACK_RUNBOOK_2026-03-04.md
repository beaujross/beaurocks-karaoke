# Hands-Off QA Dual-Track Runbook (2026-03-04)

Purpose:
- Run deterministic golden-path QA as a release gate.
- Run exploratory Agent-mode QA to discover non-obvious breakage.

Current production assumption:
- Remote hands-off QA requires a registered `QA_APP_CHECK_DEBUG_TOKEN` because production callables are App Check protected.

## Track A: Scripted Golden Path (Gate)

Recommended secure run (no plaintext password in shell history):

```powershell
npm run qa:golden:host-room-hands-off:secure
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

What it validates:
1. Root-domain host login
2. Host room creation
3. Automations on
4. TV load + QR + room code
5. Audience join
6. Host request and sync to TV
7. Audience request and sync to host + TV
8. Pop Trivia renders on audience during a performing song
9. Audience can lock one Pop Trivia answer
10. TV shows the Pop Trivia card and reflects locked answers

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
